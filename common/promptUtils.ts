import type { GenerateRequestV2 } from '../srv/adapter/type'
import type { AppSchema, TokenCounter } from './types'
import { Memory } from './types'
import { ModelFormat } from './presets/templates'

// Core type definitions
export type PromptParts = {
  scenario?: string
  greeting?: string
  sampleChat?: string[]
  persona: string
  allPersonas: string[]
  ujb?: string
  post: string[]
  memory?: string
  systemPrompt?: string

  /** User's impersonated personality */
  impersonality?: string

  chatEmbeds: string[]
  userEmbeds: string[]
}

export type Prompt = {
  template: {
    parsed: string
    inserts: Map<number, string>
    linesAddedCount: number
  }
  lines: string[]
  parts: PromptParts
  shown: boolean
}

export type PromptConfig = {
  adapter: string
  model: string
  encoder: TokenCounter
  lines: string[]
}

export type PromptOpts = {
  kind?: GenerateRequestV2['kind']
  chat: AppSchema.Chat
  char: AppSchema.Character
  user: AppSchema.User
  members: AppSchema.Profile[]
  sender: AppSchema.Profile
  settings?: Partial<AppSchema.GenSettings>
  messages: AppSchema.ChatMessage[]
  retry?: AppSchema.ChatMessage
  continue?: string
  book?: AppSchema.MemoryBook
  replyAs: AppSchema.Character
  characters: GenerateRequestV2['characters']
  impersonate?: AppSchema.Character
  lastMessage: string
  trimSentences?: boolean
  chatEmbeds: Memory.UserEmbed<{ name: string }>[]
  userEmbeds: Memory.UserEmbed[]
  resolvedScenario: string
  modelFormat?: ModelFormat
  jsonValues: Record<string, any> | undefined
  contextBuffer?: number
}

export type BuildPromptOpts = {
  kind?: GenerateRequestV2['kind']
  chat: AppSchema.Chat
  char: AppSchema.Character
  replyAs: AppSchema.Character
  sender: AppSchema.Profile
  user: AppSchema.User
  retry?: AppSchema.ChatMessage
  continue?: string
  members: AppSchema.Profile[]
  characters: Record<string, AppSchema.Character>
  impersonate?: AppSchema.Character
  settings?: Partial<AppSchema.GenSettings>
  lastMessage: string
  chatEmbeds: Memory.UserEmbed<{ name: string }>[]
  userEmbeds: Memory.UserEmbed[]
  book?: AppSchema.MemoryBook
  jsonValues: Record<string, any>
  contextBuffer?: number
}

export type TrimOpts = {
  input: string | string[]

  /**
   * Which direction to start counting from.
   *
   * I.e.,
   * - If 'top', the bottom of the text will be trimmed
   * - If 'bottom', the top of the text will be trimed
   */
  start: 'top' | 'bottom'
  encoder: TokenCounter
  tokenLimit: number
}

// Constants
export const SAMPLE_CHAT_MARKER = `System: New conversation started. Previous conversations are examples only.`
export const SAMPLE_CHAT_PREAMBLE = `How {{char}} speaks:`

export const BOT_REPLACE = /(\{\{char\}\}|\{\{name\}\})/gi
export const SELF_REPLACE = /(\{\{user\}\})/gi
export const START_REPLACE = /(<START>)/gi

// Utility functions
export function placeholderReplace(value: string, charName: string, senderName: string) {
  return value.replace(BOT_REPLACE, charName).replace(SELF_REPLACE, senderName)
}

export function removeEmpty(value?: string) {
  return !!value
}

export function titlize(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
}

/**
 * Remove lines from a body of text that contains line breaks
 */
export async function trimTokens(opts: TrimOpts) {
  const text = Array.isArray(opts.input) ? opts.input.slice() : opts.input.split('\n')
  if (opts.start === 'bottom') text.reverse()

  let tokens = 0
  let output: string[] = []

  for (const line of text) {
    tokens += await opts.encoder(line)
    if (tokens > opts.tokenLimit) break

    if (opts.start === 'top') output.push(line)
    else output.unshift(line)
  }

  return output
}

/**
 * Resolve scenario for the chat based on chat, main character and scenario settings.
 */
export function resolveScenario(
  chat: AppSchema.Chat,
  mainChar: AppSchema.Character,
  books: AppSchema.ScenarioBook[]
) {
  if (chat.overrides) return chat.scenario || ''

  let result = mainChar.scenario

  for (const book of books) {
    if (book.overwriteCharacterScenario) {
      result = book.text || ''
      break
    }
  }

  for (const book of books) {
    if (!book.overwriteCharacterScenario) {
      result += `\n${book.text}`
    }
  }

  return result.trim()
}