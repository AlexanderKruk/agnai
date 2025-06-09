import { UnwrapBody } from '/common/valid'

export type GenRequest = UnwrapBody<typeof genValidator>

// MsgEntities type definition
export interface MsgEntities {
  guest: boolean
  requestId: string
  messageId: string
  socketId: string
  user?: any
  chat: any
  preset: any
  chatId: string
  replyAs: any
  impersonate?: any
  members: string[]
  book?: any
  resolvedScenario?: any
  senderId?: string
  mainCharacter?: any
}

export const sendValidator = {
  kind: [
    'send-noreply',
    'ooc',
    'send-event:world',
    'send-event:character',
    'send-event:hidden',
    'send-event:ooc',
  ],
  text: 'string',
  impersonate: 'any?',
  parent: 'string?',
  bot: 'boolean?',
} as const

export const genValidator = {
  requestId: 'string?',
  parent: 'string?',
  kind: [
    'send',
    'send-event:world',
    'send-event:character',
    'send-event:hidden',
    'send-event:ooc',
    'ooc',
    'retry',
    'continue',
    'self',
    'summary',
    'request',
    'chat-query',
  ],
  char: 'any',
  sender: 'any',
  members: ['any'],
  user: 'any',
  chat: 'any',
  replacing: 'any?',
  replyAs: 'any?',
  continuing: 'any?',
  characters: 'any?',
  impersonate: 'any?',
  parts: {
    scenario: 'string?',
    persona: 'string',
    greeting: 'string?',
    memory: 'any?',
    sampleChat: ['string?'],
    post: ['string'],
    allPersonas: 'any?',
    chatEmbeds: 'any?',
    userEmbeds: 'any?',
  },
  lines: ['string'],
  linesCount: 'number?',
  text: 'string?',
  settings: 'any?',
  lastMessage: 'string?',
  chatEmbeds: 'any?',
  userEmbeds: 'any?',
  imageData: 'string?',
  jsonSchema: 'any?',
  jsonValues: 'any?',
  response: 'string?',
  eventStream: 'boolean?',
} as const

