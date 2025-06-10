import { AppRequest } from '../wrap'
import { sendGuest, sendMany, sendOne } from '../ws'
import { MsgEntities } from './messageTypes'

export async function sendMsg<T extends { type: string }>(ents: MsgEntities, payload: T) {
  if (ents.guest) {
    return sendGuest(ents.socketId, payload)
  }

  return sendMany(ents.members, payload)
}

export async function sendMsgOne<T extends { type: string }>(req: AppRequest, payload: T) {
  if (!req.userId) {
    return sendGuest(req.socketId, payload)
  }

  return sendOne(req.userId, payload)
}

export function isGuest(req: AppRequest) {
  return !req.userId
}