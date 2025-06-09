import { assertValid } from '/common/valid'
import { store } from '../../db'
import { errors, handle } from '../wrap'
import { sendGuest, sendMany } from '../ws'
import { getScenarioEventType } from '/common/scenario'
import { v4 } from 'uuid'
import { AppSchema } from '../../../common/types/schema'
import { sendValidator } from './messageTypes'
import { newMessage } from './messageUtils'
import { ensureBotMembership } from './messageProcessing'

export const getMessages = handle(async ({ userId, params, query }) => {
  const chatId = params.id

  assertValid({ before: 'string' }, query)
  const before = query.before

  const messages = await store.msgs.getMessages(chatId, before)
  return { messages }
})

export const createMessage = handle(async (req) => {
  const { userId, body, params } = req
  const chatId = params.id
  assertValid(sendValidator, body)

  const impersonate: AppSchema.Character | undefined = body.impersonate

  if (!userId) {
    const guest = req.socketId
    const newMsg = newMessage(v4(), chatId, body.text, {
      userId: body.bot || impersonate ? undefined : 'anon',
      characterId: impersonate?._id,
      ooc: body.kind === 'ooc' || body.kind === 'send-event:ooc',
      event: getScenarioEventType(body.kind),
      parent: body.parent,
    })
    sendGuest(guest, { type: 'message-created', msg: newMsg, chatId })
  } else {
    const chat = await store.chats.getChatOnly(chatId)
    if (!chat) throw errors.NotFound
    const members = chat.memberIds.concat(chat.userId)

    await ensureBotMembership(chat, members, impersonate)

    const userMsg = await store.msgs.createChatMessage({
      chatId,
      message: body.text,
      characterId: impersonate?._id,
      senderId: body.bot ? undefined : userId,
      ooc: body.kind === 'ooc' || body.kind === 'send-event:ooc',
      event: getScenarioEventType(body.kind),
      parent: body.parent,
      name: impersonate?.name,
    })

    await store.chats.update(chatId, { treeLeafId: userMsg._id })

    sendMany(members, { type: 'message-created', msg: userMsg, chatId })
  }

  return { success: true }
})