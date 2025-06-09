import type { GenerateRequestV2 } from '../srv/adapter/type'
import type { AppSchema, TokenCounter } from './types'
import { formatCharacter } from './characters'
import { defaultTemplate } from './mode-templates'
import { buildMemoryPrompt } from './memory'
import { getFallbackPreset } from './presets'
import { parseTemplate } from './template-parser'
import { getMessageAuthor, getBotName, trimSentence, neat } from './util'
import { promptOrderToTemplate, SIMPLE_ORDER } from './prompt-order'
import { replaceTags } from './presets/templates'
import {
  TickHandler,
  InferenceState,
  JsonField,
  JsonType,
  JsonSchema,
  schema,
} from './jsonResponseHandler'
import {
  PromptParts,
  PromptOpts,
  BuildPromptOpts,
  SAMPLE_CHAT_MARKER,
  SAMPLE_CHAT_PREAMBLE,
  BOT_REPLACE,
  SELF_REPLACE,
  placeholderReplace,
  removeEmpty,
} from './promptUtils'
import {
  getContextLimit,
} from './adapterPrompts'

// Re-export types and constants from modules for backward compatibility
export type {
  TickHandler,
  InferenceState,
  JsonType,
  JsonSchema,
  JsonField,
} from './jsonResponseHandler'

export type {
  PromptParts,
  PromptOpts,
  BuildPromptOpts,
} from './promptUtils'

export {
  SAMPLE_CHAT_MARKER,
  SAMPLE_CHAT_PREAMBLE,
  BOT_REPLACE,
  SELF_REPLACE,
  START_REPLACE,
  placeholderReplace,
  removeEmpty,
} from './promptUtils'

export {
  schema,
  toJsonSchema,
  fromJsonResponse,
  tryJsonParseResponse,
  onJsonTickHandler,
} from './jsonResponseHandler'

export {
  getChatPreset,
  getAdapter,
  setContextLimitStrategy,
  getContextLimit,
  trimTokens,
  resolveScenario,
} from './adapterPrompts'

const HOLDER_NAMES = {
  ujb: 'ujb',
  sampleChat: 'example_dialogue',
  persona: 'personality',
  allPersonas: 'all_personalities',
  memory: 'memory',
  post: 'post',
  scenario: 'scenario',
  history: 'history',
  systemPrompt: 'system_prompt',
  linebreak: 'br',
  chatAge: 'chat_age',
  idleDuration: 'idle_duration',
  impersonating: 'impersonating',
  chatEmbed: 'chat_embed',
  userEmbed: 'user_embed',
}

export const HOLDERS = {
  chatAge: /{{chat_age}}/gi,
  idleDuration: /{{idle_duration}}/gi,
  ujb: /{{ujb}}/gi,
  sampleChat: /{{example_dialogue}}/gi,
  scenario: /{{scenario}}/gi,
  memory: /{{memory}}/gi,
  persona: /{{personality}}/gi,
  allPersonas: /{{all_personalities}}/gi,
  post: /{{post}}/gi,
  history: /{{history}}/gi,
  systemPrompt: /{{system_prompt}}/gi,
  linebreak: /{{(br|linebreak|newline)}}/gi,
  impersonating: /{{impersonating}}/gi,
  chatEmbed: /{{chat_embed}}/gi,
  userEmbed: /{{user_embed}}/gi,
}

const defaultFieldPrompt = neat`
{{prop}}:
{{value}}
`
export function buildModPrompt(opts: {
  prompt: string
  fields: string
  char: Partial<AppSchema.Character>
}) {
  const aliases: { [key in keyof AppSchema.Character]?: string } = {
    sampleChat: 'Example Dialogue',
    postHistoryInstructions: 'Character Jailbreak',
    systemPrompt: 'Character Instructions',
  }

  const props: Array<keyof AppSchema.Character> = [
    'name',
    'description',
    'appearance',
    'scenario',
    'greeting',
    'sampleChat',
    'systemPrompt',
    'postHistoryInstructions',
  ]

  const inject = (prop: string, value: string) =>
    (opts.fields || defaultFieldPrompt)
      .replace(/{{prop}}/gi, prop)
      .replace(/{{value}}/gi, value)
      .replace(/\n\n+/g, '\n')

  const fields = props
    .filter((f) => {
      const value = opts.char[f]
      if (typeof value !== 'string') return false
      return !!value.trim()
    })
    .map((f) => {
      const value = opts.char[f]
      if (typeof value !== 'string') return ''

      const prop = titlize(aliases[f] || f)
      return inject(prop, value)
    })

  for (const [attr, values] of Object.entries(opts.char.persona?.attributes || {})) {
    const value = values.join(', ')
    if (!value.trim()) continue

    fields.push(inject(`Attribute '${titlize(attr)}'`, value))
  }

  return opts.prompt.replace(/{{fields}}/gi, fields.join('\n\n'))
}

function titlize(str: string) {
  return `${str[0].toUpperCase()}${str.slice(1).toLowerCase()}`
}

/**
 * This is only ever invoked client-side
 * @param opts
 * @returns
 */
export async function createPromptParts(opts: PromptOpts, encoder: TokenCounter) {
  if (opts.trimSentences) {
    const nextMsgs = opts.messages.slice()
    for (let i = 0; i < nextMsgs.length; i++) {
      if (nextMsgs[i].userId) continue
      nextMsgs[i] = { ...nextMsgs[i], msg: trimSentence(nextMsgs[i].msg) || nextMsgs[i].msg }
    }

    opts.messages = nextMsgs

    if (opts.retry) {
      opts.retry = { ...opts.retry, msg: trimSentence(opts.retry.msg) || opts.retry.msg }
    }
  }

  const sortedMsgs = opts.messages
    .filter((msg) => msg.adapter !== 'image')
    .slice()
    .sort(sortMessagesDesc)

  opts.messages = sortedMsgs

  /**
   * The lines from `getLinesForPrompt` are returned in time-descending order
   */
  let template = getTemplate(opts)

  if (opts.modelFormat) {
    template = replaceTags(template, opts.modelFormat)
  }

  /**
   * It's important for us to pass in a max context that is _realistic-ish_ as the embeddings
   * are retrieved based on the number of history messages we return here.
   *
   * If we ambitiously include the entire history then embeddings will never be included.
   * The queryable embeddings are messages that are _NOT_ included in the context
   */
  const contextBuffer = opts.contextBuffer ?? 0
  const maxContext = opts.settings ? getContextLimit(opts.user, opts.settings) : undefined
  const lines = await getLinesForPrompt(opts, encoder, (maxContext || 0) + contextBuffer)
  const parts = await buildPromptParts(opts, lines, encoder)

  const prompt = await injectPlaceholders(template, {
    opts,
    parts,
    history: { lines, order: 'desc' },
    lastMessage: opts.lastMessage,
    characters: opts.characters,
    encoder,
    jsonValues: opts.jsonValues,
  })

  return { lines: lines.reverse(), parts, template: prompt }
}

export type AssembledPrompt = Awaited<ReturnType<typeof assemblePrompt>>

/**
 * This is only ever invoked server-side
 *
 * @param opts
 * @param parts
 * @param lines Always in time-ascending order (oldest to newest)
 * @returns
 */
export async function assemblePrompt(
  opts: GenerateRequestV2,
  parts: PromptParts,
  lines: string[],
  encoder: TokenCounter
) {
  const post = createPostPrompt(opts)
  const template = getTemplate(opts)

  const history = { lines, order: 'asc' } as const
  let { parsed, inserts, length, sections, linesAddedCount } = await injectPlaceholders(template, {
    opts,
    parts,
    history,
    characters: opts.characters,
    lastMessage: opts.lastMessage,
    encoder,
    jsonValues: opts.jsonValues,
  })

  return {
    lines: history.lines,
    prompt: parsed,
    inserts,
    parts,
    post,
    length,
    sections,
    linesAddedCount,
  }
}

export function getTemplate(opts: Pick<GenerateRequestV2, 'settings' | 'chat'>) {
  const fallback = getFallbackPreset(opts.settings?.service!)
  if (opts.settings?.useAdvancedPrompt === 'basic' || opts.settings?.presetMode === 'simple') {
    if (opts.settings.presetMode === 'simple') {
      const template = promptOrderToTemplate('Universal', SIMPLE_ORDER)
      return template
    }

    if (opts.settings.modelFormat && opts.settings.promptOrder) {
      const template = promptOrderToTemplate(opts.settings.modelFormat, opts.settings.promptOrder)
      return template
    }
  }

  const template = opts.settings?.gaslight || fallback?.gaslight || defaultTemplate

  if (opts.settings?.useAdvancedPrompt === 'no-validation') {
    return template
  }

  // Deprecated
  return ensureValidTemplate(template)
}

type InjectOpts = {
  opts: BuildPromptOpts
  parts: PromptParts
  lastMessage?: string
  characters: Record<string, AppSchema.Character>
  jsonValues: Record<string, any> | undefined
  history?: { lines: string[]; order: 'asc' | 'desc' }
  encoder: TokenCounter
}

export async function injectPlaceholders(template: string, inject: InjectOpts) {
  const { opts, parts, history: hist, encoder, ...rest } = inject

  template = replaceTags(template, opts.settings?.modelFormat || 'Alpaca')

  // Basic templates can exclude example dialogue
  const validate =
    opts.settings?.useAdvancedPrompt !== 'no-validation' &&
    opts.settings?.useAdvancedPrompt !== 'basic'

  // Automatically inject example conversation if not included in the prompt
  /** @todo assess whether or not this should be here -- it ignores 'unvalidated' prompt rules */
  const sender = opts.impersonate?.name || inject.opts.sender?.handle || 'You'
  const sampleChat = parts.sampleChat?.join('\n')
  if (!template.match(HOLDERS.sampleChat) && sampleChat && hist && validate) {
    const next = hist.lines.filter((line) => !line.includes(SAMPLE_CHAT_MARKER))

    const svc = opts.settings?.service
    const postSample =
      svc === 'openai' || svc === 'openrouter' || svc === 'scale' ? SAMPLE_CHAT_MARKER : '<START>'

    const msg = `${SAMPLE_CHAT_PREAMBLE}\n${sampleChat}\n${postSample}`
      .replace(BOT_REPLACE, opts.replyAs.name)
      .replace(SELF_REPLACE, sender)
    if (hist.order === 'asc') next.unshift(msg)
    else next.push(msg)

    hist.lines = next
  }

  const lines = !hist
    ? []
    : hist.order === 'desc'
    ? hist.lines.slice()
    : hist.lines.slice().reverse()

  const result = await parseTemplate(template, {
    ...opts,
    continue: opts.kind === 'continue',
    sender: inject.opts.sender,
    parts,
    lines,
    ...rest,
    limit: {
      context: getContextLimit(opts.user, opts.settings),
      encoder,
    },
  })
  return result
}

/**
 * Add conversation history and post-amble if they are missing from the template
 */
export function ensureValidTemplate(
  template: string,
  skip?: Array<'history' | 'post' | 'persona' | 'scenario' | 'userEmbed' | 'chatEmbed'>
) {
  const skips = new Set(skip || [])

  let hasHistory = !!template.match(HOLDERS.history) || !!template.match(/{{\#each msg}}/gi)
  let hasPost = !!template.match(HOLDERS.post)

  let modified = template

  if (!skips.has('post') && !skips.has('history') && !hasHistory && !hasPost) {
    modified += `\n{{history}}\n{{post}}`
  } else if (!skips.has('history') && !hasHistory && hasPost) {
    modified = modified.replace(HOLDERS.post, `{{${HOLDER_NAMES.history}}}\n{{post}}`)
  } else if (!skips.has('post') && hasHistory && !hasPost) {
    modified += `\n{{post}}`
  }

  return modified
}

type PromptPartsOptions = Pick<
  PromptOpts,
  | 'kind'
  | 'chat'
  | 'char'
  | 'sender'
  | 'members'
  | 'continue'
  | 'settings'
  | 'user'
  | 'book'
  | 'replyAs'
  | 'impersonate'
  | 'characters'
  | 'chatEmbeds'
  | 'userEmbeds'
  | 'resolvedScenario'
>

export async function buildPromptParts(
  opts: PromptPartsOptions,
  lines: string[],
  encoder: TokenCounter
) {
  const { chat, char, replyAs } = opts
  const sender = opts.impersonate ? opts.impersonate.name : opts.sender?.handle || 'You'

  const replace = (value: string) => placeholderReplace(value, opts.replyAs.name, sender)

  const parts: PromptParts = {
    systemPrompt: opts.settings?.systemPrompt || '',
    persona: formatCharacter(
      replyAs.name,
      replyAs._id === char._id ? chat.overrides ?? replyAs.persona : replyAs.persona
    ),
    post: [],
    allPersonas: [],
    chatEmbeds: [],
    userEmbeds: [],
  }

  const personalities = new Set([replyAs._id])

  if (opts.impersonate?.persona) {
    parts.impersonality = formatCharacter(
      opts.impersonate.name,
      opts.impersonate.persona,
      opts.impersonate.persona.kind
    )
  }

  for (const bot of Object.values(opts.characters || {})) {
    if (!bot) continue
    if (personalities.has(bot._id)) continue

    const temp = opts.chat.tempCharacters?.[bot._id]
    if (temp?.deletedAt || temp?.favorite === false) continue

    if (!bot._id.startsWith('temp-') && !chat.characters?.[bot._id]) {
      continue
    }

    personalities.add(bot._id)
    parts.allPersonas.push(
      `${bot.name}'s personality: ${formatCharacter(bot.name, bot.persona, bot.persona.kind)}`
    )
  }

  // we use the BOT_REPLACE here otherwise later it'll get replaced with the
  // replyAs instead of the main character
  // (we always use the main character's scenario, not replyAs)
  parts.scenario = opts.resolvedScenario.replace(BOT_REPLACE, char.name)

  parts.sampleChat = (
    replyAs._id === char._id && !!chat.overrides
      ? chat.sampleChat ?? replyAs.sampleChat
      : replyAs.sampleChat
  )
    .split('\n')
    .filter(removeEmpty)
    // This will use the 'replyAs' character "if present", otherwise it'll defer to the chat.character.name
    .map(replace)

  if (chat.greeting) {
    parts.greeting = replace(chat.greeting)
  } else {
    parts.greeting = replace(char.greeting)
  }

  const post = createPostPrompt(opts)

  if (opts.continue) {
    post.unshift(`${char.name}: ${opts.continue}`)
  }

  const linesForMemory = [...lines].reverse()
  const books: AppSchema.MemoryBook[] = []
  if (replyAs.characterBook) books.push(replyAs.characterBook)
  if (opts.book) books.push(opts.book)

  parts.memory = await buildMemoryPrompt({ ...opts, books, lines: linesForMemory }, encoder)

  const supplementary = getSupplementaryParts(opts, replyAs)
  parts.ujb = supplementary.ujb
  parts.systemPrompt = supplementary.system

  parts.post = post.map(replace)

  if (opts.userEmbeds) {
    const embeds = opts.userEmbeds.map((line) => line.text)
    const { adding: fit } = await fillPromptWithLines({
      encoder,
      tokenLimit: opts.settings?.memoryUserEmbedLimit || 500,
      context: '',
      lines: embeds,
    })
    parts.userEmbeds = fit
  }

  if (opts.chatEmbeds) {
    const embeds = opts.chatEmbeds.map((line) => `${line.name}: ${line.text}`)
    const { adding: fit } = await fillPromptWithLines({
      encoder,
      tokenLimit: opts.settings?.memoryChatEmbedLimit || 500,
      context: '',
      lines: embeds,
    })
    parts.chatEmbeds = fit
  }

  return parts
}

function getSupplementaryParts(opts: PromptPartsOptions, replyAs: AppSchema.Character) {
  const { settings, chat } = opts
  const parts = {
    ujb: '' as string | undefined,
    system: '' as string | undefined,
  }

  if (!settings?.service) return parts

  parts.ujb = settings.ultimeJailbreak
  parts.system = settings.systemPrompt

  if (replyAs.postHistoryInstructions && !settings.ignoreCharacterUjb) {
    parts.ujb = replyAs.postHistoryInstructions
  }

  if (replyAs.systemPrompt && !settings.ignoreCharacterSystemPrompt) {
    parts.system = replyAs.systemPrompt
  }

  if (chat.overrides && opts.char._id === opts.replyAs._id) {
    if (chat.systemPrompt) parts.system = chat.systemPrompt
    if (chat.postHistoryInstructions) parts.ujb = chat.postHistoryInstructions
  }

  parts.ujb = parts.ujb?.replace(/{{original}}/gi, settings.ultimeJailbreak || '')
  parts.system = parts.system?.replace(/{{original}}/gi, settings.systemPrompt || '')

  return parts
}

function createPostPrompt(
  opts: Pick<
    PromptOpts,
    | 'kind'
    | 'chat'
    | 'char'
    | 'members'
    | 'continue'
    | 'settings'
    | 'user'
    | 'book'
    | 'replyAs'
    | 'impersonate'
  >
) {
  const post = []

  if (opts.kind === 'chat-query') {
    post.push(`Query Response:`)
  } else {
    post.push(`${opts.replyAs.name}:`)
  }

  return post
}

// Helper functions moved to promptUtils.ts

/**
 * We 'optimistically' get enough tokens to fill up the entire prompt.
 * This is an estimate and will be pruned by the caller.
 *
 * In `createPrompt()`, we trim this down to fit into the context with all of the chat and character context
 */
export async function getLinesForPrompt(
  { settings, members, messages, continue: cont, book, ...opts }: PromptOpts,
  encoder: TokenCounter,
  maxContext?: number
) {
  maxContext = maxContext || getContextLimit(opts.user, settings)

  const profiles = new Map<string, AppSchema.Profile>()
  for (const member of members) {
    profiles.set(member.userId, member)
  }

  const formatMsg = (msg: AppSchema.ChatMessage, i: number, all: AppSchema.ChatMessage[]) => {
    const profile = msg.userId ? profiles.get(msg.userId) : opts.sender
    const sender = opts.impersonate
      ? opts.impersonate.name
      : profiles.get(msg.userId || opts.chat.userId)?.handle || 'You'

    const author = getMessageAuthor({
      chat: opts.chat,
      msg,
      chars: opts.characters,
      members: profiles,
      sender: opts.sender,
      impersonate: opts.impersonate,
    })
    const char = getBotName(
      opts.chat,
      msg,
      opts.characters,
      opts.replyAs,
      opts.char,
      profile || opts.sender,
      opts.impersonate
    )

    return fillPlaceholders({ msg, author, char, user: sender }).trim()
  }

  const history = messages.slice().sort(sortMessagesDesc).map(formatMsg)

  const { adding: lines } = await fillPromptWithLines({
    encoder,
    tokenLimit: maxContext,
    context: '',
    lines: history,
  })

  if (opts.trimSentences) {
    return lines.map(trimSentence)
  }

  return lines
}

/** This function is not used for Claude or Chat */
export function formatInsert(insert: string): string {
  return `${insert}\n`
}

/**
 * This function contains the inserts logic for all non-chat, non-Claude prompts
 * In other words, it should work:
 * - with #each msg
 * - with all non-chat models regardless of whether you use #each msg or not
 * This logic also exists in other places:
 * - srv/adapter/chat-completion.ts toChatCompletionPayload
 * - srv/adapter/claude.ts createClaudePrompt
 */
export async function fillPromptWithLines(opts: {
  encoder: TokenCounter
  tokenLimit: number
  context: string
  lines: string[]

  /** Nodes to be inserted at a particular depth in the `lines` */
  inserts?: Map<number, string>
  optional?: Array<{ id: string; content: string }>
  marker?: string
}) {
  const { encoder, tokenLimit, context, lines, inserts = new Map(), optional = [] } = opts
  const insertsCost = await encoder(Array.from(inserts.values()).join(' '))
  const tokenLimitMinusInserts = tokenLimit - insertsCost

  /**
   * Optional placeholders do not count towards token counts.
   * They are optional after everything else has been inserted therefore we remove them from the prompt
   */
  let cleanContext = optional.reduce((amble, { id }) => amble.replace(id, ''), context)
  if (opts.marker) {
    cleanContext.replace(opts.marker, '')
  }

  let count = await encoder(cleanContext)
  const adding: string[] = []

  let linesAddedCount = 0
  for (const line of lines) {
    const tokens = await encoder(line)
    if (tokens + count > tokenLimitMinusInserts) {
      break
    }
    const insert = inserts.get(linesAddedCount)
    if (insert) adding.push(formatInsert(insert))

    count += tokens
    adding.push(line)
    linesAddedCount++
  }

  // We don't omit inserts with depth > message count in context size
  // instead we put them at the top of the conversation history
  const remainingInserts = insertsDeeperThanConvoHistory(inserts, linesAddedCount)
  if (remainingInserts) {
    adding.push(formatInsert(remainingInserts))
  }

  const unusedTokens = tokenLimitMinusInserts - count
  return { adding, unusedTokens, linesAddedCount }
}

export function insertsDeeperThanConvoHistory(
  inserts: Map<number, string>,
  nonInsertLines: number
) {
  return [...inserts.entries()]
    .filter(([depth, _]) => depth >= nonInsertLines)
    .map(([_, prompt]) => prompt)
    .join('\n')
}

function fillPlaceholders(opts: {
  msg: AppSchema.ChatMessage
  author: string
  char: string
  user: string
}): string {
  const prefix = opts.msg.system ? 'System' : opts.author
  const text = opts.msg.json?.history || opts.msg.msg
  const msg = text.replace(BOT_REPLACE, opts.char).replace(SELF_REPLACE, opts.user)

  return `${prefix}: ${msg}`
}

function sortMessagesDesc(l: AppSchema.ChatMessage, r: AppSchema.ChatMessage) {
  return l.createdAt > r.createdAt ? -1 : l.createdAt === r.createdAt ? 0 : 1
}

// Chat preset functionality moved to adapterPrompts.ts

// Adapter functionality moved to adapterPrompts.ts

// Context limit strategy moved to adapterPrompts.ts

// Context limit functionality moved to adapterPrompts.ts

// Trim functionality moved to promptUtils.ts

// Scenario resolution moved to promptUtils.ts

// JSON schema functionality moved to jsonResponseHandler.ts
