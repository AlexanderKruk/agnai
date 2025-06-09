import { AppRequest } from '../wrap'
import { store } from '../../db'
import { GenRequest, MsgEntities } from './messageTypes'
import { sendMsg, sendMsgOne } from './communicationUtils'
import { newMessage } from './messageUtils'

export async function handleAuthedResponse(opts: {
  req: AppRequest<GenRequest>
  ents: MsgEntities
  responseText: string
  retries: string[]
  parent: string
  meta: any
  hydration: any
  adapter: string
  probs: any
}) {
  const { req, responseText, parent, meta, hydration, ents, adapter, retries, probs } = opts
  const { chatId, replyAs, requestId, senderId } = ents
  const body = req.body

  const updatedAt = new Date().toISOString()
  let treeLeafId = ''

  switch (body.kind) {
    case 'summary': {
      sendMsgOne(req, { type: 'chat-summary', chatId: ents.chatId, summary: responseText })
      break
    }

    case 'chat-query': {
      sendMsgOne(req, {
        type: 'chat-query',
        requestId: body.requestId,
        chatId,
        response: responseText,
      })
      break
    }

    case 'self':
    case 'request':
    case 'send-event:world':
    case 'send-event:character':
    case 'send-event:hidden':
    case 'send': {
      const msg = await store.msgs.createChatMessage({
        _id: requestId,
        chatId,
        characterId: replyAs._id,
        senderId,
        message: responseText,
        adapter,
        ooc: false,
        meta,
        retries,
        event: undefined,
        parent,
        json: hydration,
        name: replyAs.name,
      })

      msg.meta.probs = probs

      sendMsg(ents, {
        type: 'message-created',
        requestId,
        msg,
        chatId,
        adapter,
        generate: true,
        json: hydration,
      })
      treeLeafId = requestId
      break
    }

    case 'retry': {
      if (body.replacing) {
        const nextRetries = [body.replacing.msg]
          .concat(retries)
          .concat(body.replacing.retries || [])

        const next = await store.msgs.editMessage(body.replacing._id, {
          msg: responseText,
          adapter,
          meta,
          state: 'retried',
          retries: nextRetries,
          parent: body.parent,
          json: hydration ? hydration : (null as any),
        })
        treeLeafId = body.replacing._id
        meta.probs = probs
        sendMsg(ents, {
          type: 'message-retry',
          requestId,
          chatId,
          messageId: body.replacing._id,
          message: next?.msg,
          retries: next?.retries,
          adapter,
          generate: true,
          meta,
          updatedAt: next?.updatedAt,
          json: hydration,
        })
      } else {
        const msg = await store.msgs.createChatMessage({
          _id: requestId,
          chatId,
          characterId: replyAs._id,
          message: responseText,
          adapter,
          ooc: false,
          meta,
          retries,
          event: undefined,
          parent,
          json: hydration,
          name: replyAs.name,
        })
        msg.meta.probs = probs
        treeLeafId = requestId
        sendMsg(ents, {
          type: 'message-created',
          requestId,
          msg,
          chatId,
          adapter,
          generate: true,
          json: hydration,
        })
      }
      break
    }

    case 'continue': {
      const next = await store.msgs.editMessage(body.continuing._id, {
        msg: responseText,
        adapter,
        meta,
        state: 'continued',
      })
      treeLeafId = body.continuing._id
      meta.probs = probs
      sendMsg(ents, {
        type: 'message-retry',
        requestId,
        chatId,
        messageId: body.continuing._id,
        message: responseText,
        adapter,
        generate: true,
        retries: next?.retries,
        meta,
        updatedAt,
      })
      break
    }
  }

  if (treeLeafId) {
    await store.chats.update(chatId, { treeLeafId, updatedAt })
  } else {
    await store.chats.update(chatId, { updatedAt })
  }
}

export async function handleGuestResponse(opts: {
  req: AppRequest<GenRequest>
  ents: MsgEntities
  responseText: string
  retries: string[]
  parent: string
  meta: any
  hydration: any
  adapter: string
}) {
  const { req, responseText, parent, meta, hydration, ents } = opts
  const body = req.body
  let retries = opts.retries.slice()
  if (body.kind === 'retry' && body.replacing) {
    retries = [body.replacing.msg].concat(retries).concat(body.replacing.retries || [])
  }

  const response = newMessage(ents.messageId, ents.chatId, responseText, {
    characterId: ents.replyAs._id,
    userId: ents.senderId,
    ooc: false,
    meta,
    event: undefined,
    retries,
    parent,
    json: hydration,
  })

  switch (body.kind) {
    case 'summary':
      sendMsgOne(req, { type: 'chat-summary', chatId: ents.chatId, summary: responseText })
      return

    case 'continue':
    case 'request':
    case 'retry':
    case 'self':
    case 'send':
    case 'send-event:world':
    case 'send-event:character':
    case 'send-event:hidden':
      sendMsgOne(req, {
        type: 'guest-message-created',
        requestId: ents.requestId,
        msg: response,
        chatId: ents.chatId,
        adapter: opts.adapter,
        continue: body.kind === 'continue',
        generate: true,
        meta,
        json: hydration,
      })
      return
  }
}