import { AppRequest, StatusError } from '../wrap'
import { store } from '../../db'
import { getScenarioEventType } from '/common/scenario'
import { v4 } from 'uuid'
import { GenRequest, MsgEntities } from './messageTypes'
import { newMessage } from './messageUtils'
import { sendMsg } from './communicationUtils'
import { AppSchema } from '../../../common/types/schema'

export async function ensureBotMembership(
  chat: AppSchema.Chat,
  members: string[],
  impersonate: AppSchema.Character | undefined
) {
  const update: Partial<AppSchema.Chat> = {}

  // Ignore ownership of temporary characters
  const characters = chat.characters || {}
  if (
    impersonate &&
    characters[impersonate._id] === undefined &&
    !impersonate._id.startsWith('temp-')
  ) {
    const actual = await store.characters.getCharacter(impersonate.userId, impersonate._id)
    if (!actual) {
      throw new StatusError(
        'Could not create message: Impersonation character does not belong to you',
        403
      )
    }

    // Ensure the caller's character is up to date
    Object.assign(impersonate, actual)
    characters[impersonate._id] = false
    sendMsg({ members, guest: false } as MsgEntities, {
      type: 'chat-character-added',
      chatId: chat._id,
      character: actual,
      active: false,
    })
  }

  update.characters = characters
  await store.chats.update(chat._id, update)
}

export async function createUserMessage(req: AppRequest<GenRequest>, ents: MsgEntities) {
  const { body } = req
  const { chatId, replyAs, impersonate } = ents
  let userMsg: AppSchema.ChatMessage | undefined

  if (ents.guest) {
    if (req.body.kind === 'send' || req.body.kind === 'ooc') {
      userMsg = newMessage(v4(), chatId, req.body.text!, {
        userId: 'anon',
        characterId: req.body.impersonate?._id,
        ooc: body.kind === 'ooc',
        event: undefined,
        parent: body.parent,
      })
    } else if (body.kind.startsWith('send-event:')) {
      userMsg = newMessage(v4(), chatId, body.text!, {
        characterId: replyAs?._id,
        ooc: false,
        event: getScenarioEventType(body.kind),
        parent: body.parent,
      })
    }

    if (userMsg) {
      sendMsg(ents, { type: 'message-created', msg: userMsg, chatId })
    }

    return userMsg
  }

  if (body.kind === 'send' || body.kind === 'ooc') {
    userMsg = await store.msgs.createChatMessage({
      chatId,
      message: body.text!,
      characterId: impersonate?._id,
      senderId: req.userId,
      ooc: body.kind === 'ooc',
      event: undefined,
      parent: body.parent,
      name: impersonate?.name,
    })

    sendMsg(ents, { type: 'message-created', msg: userMsg, chatId })
  } else if (body.kind.startsWith('send-event:')) {
    userMsg = await store.msgs.createChatMessage({
      chatId,
      message: body.text!,
      characterId: replyAs?._id,
      senderId: undefined,
      ooc: false,
      event: getScenarioEventType(body.kind),
      parent: body.parent,
      name: replyAs?.name,
    })
    sendMsg(ents, { type: 'message-created', msg: userMsg, chatId })
  }

  if (userMsg) {
    await store.chats.update(chatId, { treeLeafId: userMsg._id, updatedAt: userMsg.updatedAt })
  }

  return userMsg
}