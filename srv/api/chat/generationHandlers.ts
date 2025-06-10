import { assertValid } from '/common/valid'
import { store } from '../../db'
import { createChatStream, getGenerationSettings } from '../../adapter/generate'
import { AppRequest, StatusError, errors, handle } from '../wrap'
import { obtainLock, releaseLock } from './lock'
import { v4 } from 'uuid'
import { getAdapter, resolveScenario } from '/common/prompt'
import { mapPresetsToAdapter } from '/common/presets'
import { isDefaultTemplate, templates } from '/common/presets/templates'
import { Response } from 'express'
import { parsePartialJson, jsonHydrator, HydratedJson } from '/common/util'
import { AppSchema } from '../../../common/types/schema'
import { GenRequest, MsgEntities, genValidator } from './messageTypes'
import { 
  sanitizeRequestForLogging, 
  restoreSensitiveCharacterData, 
  getNewMessageParent 
} from './messageUtils'
import { 
  sendMsg, 
  sendMsgOne, 
  isGuest 
} from './communicationUtils'
import { createUserMessage, ensureBotMembership } from './messageProcessing'
import { handleAuthedResponse, handleGuestResponse } from './responseHandlers'

export const generateMessageV2 = handle(async (req, res) => {
  const { userId, body, params, log } = req
  const chatId = params.id
  assertValid(genValidator, body)

  // Log sanitized request data instead of full body
  log.debug({ sanitizedBody: sanitizeRequestForLogging(body) }, 'Generate message request')

  // Get chat first to restore sensitive character data
  const chat = await store.chats.getChatOnly(chatId)
  if (!chat) throw errors.ChatNotFound

  // Restore sensitive character data that was stripped from frontend request
  const restoredBody = await restoreSensitiveCharacterData(body, chat)
  req.body = restoredBody

  if (req.authed) {
    restoredBody.user = req.authed
  }

  const ents = await getMessageEntities(req)
  const { requestId, messageId, chat: entChat, replyAs, impersonate, members } = ents

  if (!ents.guest && restoredBody.kind === 'request' && entChat.userId !== userId) {
    throw errors.Forbidden
  }

  // For authenticated users we will verify parts of the payload
  let userMsg = await createUserMessage(req, ents)

  if (restoredBody.kind === 'ooc' || !replyAs) {
    return { success: true }
  }

  /**
   * For group chats we won't worry about lock integrity.
   * We still need to create the user message and broadcast it,
   * but if there is a lock in place do not attempt to generate a message.
   */
  if (!isGuest(req)) {
    // @todo consider locking for guests?
    try {
      await obtainLock(chatId)
    } catch (ex) {
      if (members.length <= 1) throw ex
      return res.json({
        requestId,
        success: true,
        generating: false,
        message: 'User message created',
        messageId,
        created: userMsg,
      })
    }
  }

  if (restoredBody.kind !== 'chat-query') {
    sendMsg(ents, {
      type: 'message-creating',
      chatId,
      mode: restoredBody.kind,
      senderId: userId,
      characterId: replyAs._id,
    })
  }

  const schema = ents.preset.jsonSource === 'character' ? replyAs.json : ents.preset.json
  const hydrator = ents.preset.jsonEnabled && schema ? jsonHydrator(schema) : undefined

  let hydration: HydratedJson | undefined
  let jsonPartial: any

  let generated = restoredBody.response || ''
  let retries: string[] = []
  let error = false
  let adapter = 'local'
  let meta: Record<string, any> = {}
  let probs: any
  let partial = ''

  // If body.response is defined, it's a "local request" which means the browser handled the generation.
  // When undefined, we'll generate the response
  let signal: AbortController | null = new AbortController()
  if (restoredBody.response === undefined) {
    const listener = () => {
      if (!signal) return
      if (generated) return

      signal.abort()

      sendMsg(ents, {
        type: 'message-error',
        error: 'inference cancelled by user',
        adapter,
        chatId,
        requestId,
      })

      res.status(499).end()
    }

    if (restoredBody.eventStream) {
      req.socket.on('end', listener)
    }

    setTextStreamHeaders(res, ents, restoredBody, userMsg)

    const chatStream = await createChatStream(
      {
        ...restoredBody,
        linesCount: restoredBody.linesCount,
        chat: entChat,
        replyAs,
        impersonate,
        requestId,
        settings: ents.preset,
        book: ents.book,
        resolvedScenario: ents.resolvedScenario,
        chatSchema: schema,
        signal,
      },
      log,
      isGuest(req) ? req.socketId : undefined
    ).catch((err) => ({ err }))

    if ('err' in chatStream) {
      req.log.error({ err: chatStream.err, chatId }, 'Chat stream failed to start')
      await releaseLock(chatId)

      if (restoredBody.eventStream) {
        const msg =
          chatStream.err?.message || 'Unexpected error occurred when initiating chat response'

        sendMsg(ents, {
          type: 'message-error',
          requestId,
          chatId,
          adapter,
          error: msg,
        })
        return
      } else {
        throw chatStream.err
      }
    }

    const { stream, ...metadata } = chatStream

    adapter = metadata.adapter

    meta = {
      ctx: metadata.settings.maxContextLength,
      char: metadata.size,
      len: metadata.length,
    }
    log.setBindings({ adapter })

    try {
      for await (const gen of stream) {
        if (!signal) {
          break
        }

        if (signal.signal.aborted) {
          log.warn(`Message aborted by user`)

          generated = partial
          // error = true
          break
        }

        if (typeof gen === 'string') {
          signal = null
          generated = gen
          continue
        }

        if ('gens' in gen) {
          retries = gen.gens
        }

        if ('tokens' in gen) {
          signal = null
          generated = gen.tokens as string
          break
        }

        if ('partial' in gen) {
          const prefix = restoredBody.kind === 'continue' ? `${restoredBody.continuing.msg} ` : ''
          if (metadata.json && hydrator) {
            jsonPartial = parsePartialJson(gen.partial) || jsonPartial
            hydration = hydrator(jsonPartial || {})
          }

          partial = `${prefix}${gen.partial}`

          sendMsg(ents, {
            requestId: restoredBody.requestId,
            type: 'message-partial',
            kind: restoredBody.kind,
            partial: hydration ? hydration.response : `${prefix}${gen.partial}`,
            json: hydration,
            adapter,
            chatId,
          })
          continue
        }

        if ('meta' in gen) {
          Object.assign(meta, gen.meta)
          continue
        }

        if ('prompt' in gen) {
          sendMsgOne(req, { type: 'service-prompt', id: messageId, prompt: gen.prompt })
          continue
        }

        if ('error' in gen) {
          error = true
          sendMsg(ents, { type: 'message-error', requestId, error: gen.error, adapter, chatId })
          continue
        }

        if ('warning' in gen) {
          sendMsgOne(req, { type: 'message-warning', requestId, warning: gen.warning })
        }
      }
    } catch (ex: any) {
      error = true

      if (ex instanceof StatusError) {
        log.warn({ err: ex }, `[${ex.status}] Stream handler exception`)
        sendMsg(ents, {
          type: 'message-error',
          requestId,
          error: `[${ex.status}] Message failed: ${ex?.message || ex}`,
          adapter,
          chatId,
        })
      } else {
        log.error({ err: ex }, 'Unhandled exception occurred during stream handler')
        sendMsg(ents, {
          type: 'message-error',
          requestId,
          error: `Unhandled exception: ${ex?.message || ex}`,
          adapter,
          chatId,
        })
      }
    }

    req.socket.removeAllListeners('end')
    signal = null

    if (restoredBody.eventStream) {
      res.write('data: [DONE]')
      res.end()
    }

    if (!ents.guest) {
      await releaseLock(chatId)
    }
  }

  if (error) {
    return
  }

  if (meta.probs) {
    probs = meta.probs
    delete meta.probs
  }

  let responseText = restoredBody.kind === 'continue' ? `${restoredBody.continuing.msg} ${generated}` : generated
  const parent = getNewMessageParent(restoredBody, userMsg)

  if (hydration?.response) {
    responseText = hydration.response
  }

  const payload = { req, ents, meta, probs, responseText, parent, hydration, adapter, retries }
  if (ents.guest) {
    await handleGuestResponse(payload)
  } else {
    await handleAuthedResponse(payload)
  }
})

async function getMessageEntities(req: AppRequest<GenRequest>) {
  const { body, userId } = req
  const requestId = body.requestId || v4()
  const messageId =
    body.kind === 'retry'
      ? body.replacing?._id ?? requestId
      : body.kind === 'continue'
      ? body.continuing?._id
      : requestId

  if (isGuest(req)) {
    const replyAs = body.replyAs || body.char
    const chat = body.chat
    if (!chat) throw errors.ChatNotFound
    const impersonate = body.impersonate

    return {
      guest: true,
      requestId,
      messageId,
      socketId: req.socketId,
      user: body.user,
      chat,
      chatId: req.params.id,
      mainCharacter: body.char,
      replyAs,
      impersonate,
      preset: body.settings,
      members: [] as string[],
      book: undefined,
      resolvedScenario: undefined,
      senderId: body.kind === 'self' ? 'anon' : undefined,
    }
  }

  const impersonateId: string | undefined = body.impersonate?._id
  const impersonate: AppSchema.Character | undefined = !impersonateId
    ? undefined
    : impersonateId.startsWith('temp-')
    ? body.impersonate
    : await store.characters.getCharacter(userId, impersonateId)

  const chat = await store.chats.getChatOnly(req.params.id)
  if (!chat) throw errors.ChatNotFound

  const mainCharacter = await store.characters.getCharacter(chat.userId, body.char._id)
  if (!mainCharacter) {
    throw errors.CharacterNotFound
  }

  const replyAs: AppSchema.Character = body.replyAs._id.startsWith('temp-')
    ? body.replyAs
    : await store.characters.getCharacter(chat.userId, body.replyAs._id || body.char._id)

  if (chat.userId !== userId) {
    const isAllowed = await store.chats.canViewChat(userId, chat)
    if (!isAllowed) throw errors.Forbidden
  }

  const user = await store.users.getUser(chat.userId)
  if (!user) {
    throw errors.Forbidden
  }

  const { adapter } = getAdapter(chat, user, body.settings)
  const settings = await getGenerationSettings(user, chat, adapter).then((gen) => {
    mapPresetsToAdapter(gen, adapter)
    return gen
  })

  if (settings.promptTemplateId) {
    if (isDefaultTemplate(settings.promptTemplateId)) {
      settings.gaslight = templates[settings.promptTemplateId]
    } else {
      const template = await store.presets.getTemplate(settings.promptTemplateId)
      if (template?.userId === chat.userId) {
        settings.gaslight = template.template
      }
    }
  }

  // `temporary` is client-side managed, so keep the value from the request
  settings.temporary = body.settings.temporary

  const members = chat.memberIds.concat(chat.userId)
  if (body.kind == 'send' || body.kind === 'ooc') {
    await ensureBotMembership(chat, members, impersonate)
  }

  if (body.kind === 'retry' && req.userId !== chat.userId) {
    throw errors.Forbidden
  }

  if (body.kind === 'continue' && req.userId !== chat.userId) {
    throw errors.Forbidden
  }

  const book = chat.memoryId ? await store.memory.getBook(chat.memoryId) : undefined
  const chatScenarios = chat.scenarioIds
    ? await store.scenario.getScenariosById(chat.scenarioIds)
    : []
  const resolvedScenario = resolveScenario(chat, mainCharacter, chatScenarios)

  return {
    guest: false,
    requestId,
    messageId,
    socketId: '',
    user,
    chat,
    preset: settings,
    chatId: req.params.id,
    replyAs,
    impersonate,
    members,
    book,
    resolvedScenario,
    senderId: body.kind === 'self' ? req.userId : undefined,
    mainCharacter,
  }
}

function setTextStreamHeaders(res: Response, ents: MsgEntities, body: GenRequest, userMsg?: any) {
  const success = {
    requestId: ents.requestId,
    success: true,
    generating: true,
    message: 'Generating message',
    messageId: ents.messageId,
    created: userMsg,
  }

  if (!body.eventStream) {
    res.json(success)
    return
  }

  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  res.write(`data: ${JSON.stringify(success)}`)
}