import { AppSchema } from '../../../common/types/schema'
import { HydratedJson } from '/common/util'
import { GenRequest } from './messageTypes'

export function newMessage(
  messageId: string,
  chatId: string,
  text: string,
  props: {
    userId?: string
    characterId?: string
    ooc: boolean
    meta?: any
    event: undefined | AppSchema.ScenarioEventType
    retries?: string[]
    parent?: string
    json?: HydratedJson
  }
) {
  const userMsg: AppSchema.ChatMessage = {
    _id: messageId,
    chatId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    kind: 'chat-message',
    retries: props.retries || [],
    msg: text,
    ...props,
  }
  return userMsg
}

export function getNewMessageParent(body: GenRequest, userMsg: AppSchema.ChatMessage | undefined): string {
  switch (body.kind) {
    case 'continue': {
      return body.continuing?.parent
    }

    case 'summary':
    case 'chat-query':
      return ''

    case 'retry':
    case 'request':
      return body.parent || ''

    case 'ooc':
    case 'self':
    case 'send':
    case 'send-event:character':
    case 'send-event:hidden':
    case 'send-event:ooc':
    case 'send-event:world':
      return userMsg?._id || ''
  }
}

// Utility function to sanitize character data from request body for logging
export function sanitizeRequestForLogging(body: any) {
  const sanitized = { ...body }
  
  // Replace character objects with just their IDs to hide sensitive data
  if (sanitized.char && sanitized.char._id) {
    sanitized.char = { _id: sanitized.char._id, name: sanitized.char.name || 'Unknown' }
  }
  
  if (sanitized.replyAs && sanitized.replyAs._id) {
    sanitized.replyAs = { _id: sanitized.replyAs._id, name: sanitized.replyAs.name || 'Unknown' }
  }
  
  if (sanitized.impersonate && sanitized.impersonate._id) {
    sanitized.impersonate = { _id: sanitized.impersonate._id, name: sanitized.impersonate.name || 'Unknown' }
  }
  
  if (sanitized.characters) {
    const sanitizedChars: Record<string, any> = {}
    for (const [id, char] of Object.entries(sanitized.characters)) {
      if (char && typeof char === 'object' && '_id' in char) {
        sanitizedChars[id] = { _id: (char as any)._id, name: (char as any).name || 'Unknown' }
      } else {
        sanitizedChars[id] = char
      }
    }
    sanitized.characters = sanitizedChars
  }
  
  // Remove sensitive parts that contain character details
  if (sanitized.parts) {
    sanitized.parts = {
      ...sanitized.parts,
      // Core sensitive character fields
      persona: '[REDACTED]',
      scenario: '[REDACTED]',
      sampleChat: ['[REDACTED]'],
      allPersonas: ['[REDACTED]'],
      // Additional sensitive fields
      systemPrompt: '[REDACTED]',
      ujb: '[REDACTED]',
      memory: '[REDACTED]',
      greeting: '[REDACTED]',
      impersonality: '[REDACTED]',
      // Keep non-sensitive fields
      post: sanitized.parts.post || [],
      chatEmbeds: sanitized.parts.chatEmbeds || [],
      userEmbeds: sanitized.parts.userEmbeds || [],
    }
  }
  
  return sanitized
}

// Restore sensitive character data that was stripped from frontend request
export async function restoreSensitiveCharacterData(body: any, chat: AppSchema.Chat) {
  const { store } = await import('../../db/index.js')
  const restored = { ...body }
  
  // Helper function to check if character needs sensitive data restored
  const needsRestore = (char: any) => {
    return char && char._id && (!char.scenario || !char.sampleChat || !char.persona)
  }
  
  // Helper function to restore character data from database
  const restoreCharacter = async (char: any, userId: string) => {
    if (!needsRestore(char)) return char
    
    if (char._id.startsWith('temp-')) {
      // Temporary characters are passed in full, no need to restore
      return char
    }
    
    const fullChar = await store.characters.getCharacter(userId, char._id)
    if (!fullChar) return char
    
    // Merge the stripped character with full database data
    return { ...fullChar, ...char }
  }
  
  // Restore main character
  if (needsRestore(restored.char)) {
    restored.char = await restoreCharacter(restored.char, chat.userId)
  }
  
  // Restore reply-as character
  if (needsRestore(restored.replyAs)) {
    restored.replyAs = await restoreCharacter(restored.replyAs, chat.userId)
  }
  
  // Restore impersonate character
  if (needsRestore(restored.impersonate)) {
    restored.impersonate = await restoreCharacter(restored.impersonate, chat.userId)
  }
  
  // Restore characters map
  if (restored.characters) {
    for (const [id, char] of Object.entries(restored.characters)) {
      if (needsRestore(char)) {
        restored.characters[id] = await restoreCharacter(char, chat.userId)
      }
    }
  }
  
  // Restore settings object (preset data) if it was sanitized
  if (restored.settings && (
    restored.settings.systemPrompt === '[HIDDEN]' ||
    restored.settings.ultimeJailbreak === '[HIDDEN]' ||
    restored.settings.gaslight === '[HIDDEN]' ||
    restored.settings.thirdPartyKey === '[HIDDEN]' ||
    restored.settings.thirdPartyUrl === '[HIDDEN]' ||
    (restored.settings.registered && Object.values(restored.settings.registered).some((config: any) => 
      config.thirdPartyKey === '[HIDDEN]' || config.thirdPartyUrl === '[HIDDEN]'
    ))
  )) {
    if (restored.settings._id) {
      const fullSettings = await store.presets.getUserPreset(restored.settings._id, chat.userId)
      if (fullSettings) {
        // Merge sanitized settings with full database settings
        restored.settings = { ...fullSettings, ...restored.settings }
      }
    }
  }
  
  // Restore user object if API keys were sanitized
  if (restored.user && (
    restored.user.novelApiKey === '[HIDDEN]' ||
    restored.user.hordeKey === '[HIDDEN]' ||
    restored.user.oaiKey === '[HIDDEN]' ||
    restored.user.thirdPartyPassword === '[HIDDEN]'
  )) {
    const fullUser = await store.users.getUser(chat.userId)
    if (fullUser) {
      // Merge sanitized user with full database user, keeping non-sensitive updates
      restored.user = { 
        ...fullUser, 
        ...restored.user,
        // Only restore fields that were actually hidden
        novelApiKey: restored.user.novelApiKey === '[HIDDEN]' ? fullUser.novelApiKey : restored.user.novelApiKey,
        hordeKey: restored.user.hordeKey === '[HIDDEN]' ? fullUser.hordeKey : restored.user.hordeKey,
        oaiKey: restored.user.oaiKey === '[HIDDEN]' ? fullUser.oaiKey : restored.user.oaiKey,
        thirdPartyPassword: restored.user.thirdPartyPassword === '[HIDDEN]' ? fullUser.thirdPartyPassword : restored.user.thirdPartyPassword
      }
    }
  }
  
  // Restore chat object if greeting was sanitized  
  if (restored.chat && restored.chat.greeting === '[HIDDEN]') {
    // Chat object is already available from the parameter, use it
    restored.chat = { ...restored.chat, greeting: chat.greeting }
  }
  
  return restored
}