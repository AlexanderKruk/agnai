import type { AppSchema } from './types'
import {
  GOOGLE_LIMITS,
  NOVEL_MODELS,
  OPENAI_CONTEXTS,
  THIRDPARTY_HANDLERS,
} from './adapters'
import { defaultPresets, getFallbackPreset, isDefaultPreset } from './presets'

type LimitStrategy = (
  user: AppSchema.User,
  gen: Partial<AppSchema.GenSettings> | undefined
) => { context: number; tokens: number } | void

let _strategy: LimitStrategy = () => {}

/**
 * Get the chat preset based on precedence rules
 * Order of precedence:
 * 1. chat.genPreset
 * 2. chat.genSettings (Deprecated)
 * 3. user.defaultPreset
 * 4. user.servicePreset -- Deprecated: Service presets are completely removed apart from users that already have them.
 * 5. built-in fallback preset (horde)
 */
export function getChatPreset(
  chat: AppSchema.Chat,
  user: AppSchema.User,
  userPresets: AppSchema.UserGenPreset[]
): Partial<AppSchema.UserGenPreset> {
  // #1
  if (chat.genPreset) {
    if (isDefaultPreset(chat.genPreset))
      return { _id: chat.genPreset, ...defaultPresets[chat.genPreset] }

    const preset = userPresets.find((preset) => preset._id === chat.genPreset)
    if (preset) return preset
  }

  // #2
  if (chat.genSettings) {
    return chat.genSettings
  }

  // #3
  const defaultId = user.defaultPreset
  if (defaultId) {
    if (isDefaultPreset(defaultId)) return { _id: defaultId, ...defaultPresets[defaultId] }
    const preset = userPresets.find((preset) => preset._id === defaultId)
    if (preset) return preset
  }

  // #4
  const { adapter, isThirdParty } = getAdapter(chat, user, undefined)
  const fallbackId = user.defaultPresets?.[isThirdParty ? 'kobold' : adapter]

  if (fallbackId) {
    if (isDefaultPreset(fallbackId)) return { _id: fallbackId, ...defaultPresets[fallbackId] }
    const preset = userPresets.find((preset) => preset._id === fallbackId)
    if (preset) return preset
  }

  // #5
  return getFallbackPreset(adapter || 'horde')
}

/**
 * Get adapter and model configuration
 * Order of Precedence:
 * 1. chat.genPreset -> service
 * 2. chat.genSettings -> service
 * 3. chat.adapter
 * 4. user.defaultAdapter
 */
export function getAdapter(
  chat: AppSchema.Chat,
  user: AppSchema.User,
  preset: Partial<AppSchema.GenSettings> | undefined
) {
  let adapter = preset?.service!

  const thirdPartyFormat = preset?.thirdPartyFormat || user.thirdPartyFormat
  const isThirdParty = thirdPartyFormat in THIRDPARTY_HANDLERS && adapter === 'kobold'

  if (adapter === 'kobold') {
    adapter = THIRDPARTY_HANDLERS[user.thirdPartyFormat]
  }

  let model = ''
  let presetName = 'Fallback Preset'

  if (adapter === 'replicate') {
    model = preset?.replicateModelType || 'llama'
  }

  if (adapter === 'novel') {
    model = user.novelModel
  }

  if (adapter === 'openai') {
    model = preset?.thirdPartyModel || preset?.oaiModel || defaultPresets.openai.oaiModel
  }

  if (chat.genPreset) {
    if (isDefaultPreset(chat.genPreset)) {
      presetName = 'Built-in Preset'
    } else presetName = 'User Preset'
  } else if (chat.genSettings) {
    presetName = 'Chat Settings'
  } else if (user.defaultPresets) {
    const servicePreset = user.defaultPresets[adapter]
    if (servicePreset) {
      presetName = `Service Preset`
    }
  }

  const contextLimit = getContextLimit(user, preset)

  return { adapter, model, preset: presetName, contextLimit, isThirdParty }
}

export function setContextLimitStrategy(strategy: LimitStrategy) {
  _strategy = strategy
}

/**
 * When we know the maximum context limit for a particular LLM, ensure that the context limit we use does not exceed it.
 */
export function getContextLimit(
  user: AppSchema.User,
  gen: Partial<AppSchema.GenSettings> | undefined
): number {
  const genAmount = gen?.maxTokens || getFallbackPreset(gen?.service || 'horde')?.maxTokens || 80
  const configuredMax =
    gen?.maxContextLength || getFallbackPreset(gen?.service || 'horde')?.maxContextLength || 4096

  if (!gen?.service) return configuredMax - genAmount

  switch (gen.service) {
    case 'agnaistic': {
      const stratMax = _strategy(user, gen)
      if (gen?.useMaxContext && stratMax) {
        return stratMax.context - genAmount
      }

      const max = Math.min(configuredMax, stratMax?.context ?? configuredMax)
      return max - genAmount
    }

    // Any LLM could be used here so don't max any assumptions
    case 'ooba':
    case 'petals':
    case 'horde':
      return configuredMax - genAmount

    case 'third-party':
    case 'kobold': {
      if (!gen.useMaxContext) return configuredMax - genAmount
      switch (gen.thirdPartyFormat) {
        case 'gemini': {
          const max = GOOGLE_LIMITS[gen.googleModel!] || GOOGLE_LIMITS.fallback
          return max ? max - genAmount : configuredMax - genAmount
        }

        default:
          return configuredMax - genAmount
      }
    }

    case 'novel': {
      const model = gen?.novelModel || NOVEL_MODELS.kayra_v1
      if (model === NOVEL_MODELS.clio_v1 || model === NOVEL_MODELS.kayra_v1) {
        return Math.min(8000, configuredMax) - genAmount
      }

      return configuredMax - genAmount
    }

    case 'openai': {
      const model = (gen?.service === 'openai' ? gen?.oaiModel! : gen?.thirdPartyModel) || ''
      const limit = OPENAI_CONTEXTS[model] || 128000
      return Math.min(configuredMax, limit) - genAmount
    }

    case 'replicate':
      return configuredMax - genAmount

    case 'scale':
      return configuredMax - genAmount

    case 'claude':
      return configuredMax - genAmount

    case 'goose':
      return Math.min(configuredMax, 2048) - genAmount

    case 'openrouter':
      if (gen?.openRouterModel) {
        if (gen.useMaxContext) return gen.openRouterModel.context_length - genAmount

        return Math.min(gen.openRouterModel.context_length, configuredMax) - genAmount
      }

      return Math.min(configuredMax, 4096) - genAmount

    case 'mancer':
      return Math.min(configuredMax, 8000) - genAmount

    case 'venus':
      return Math.min(configuredMax, 7800) - genAmount
    
    // Add a default case to handle 'a1111forge' and any other AIAdapter not explicitly listed
    default:
      // For unlisted adapters, or those where context limit isn't specialized (like image adapters),
      // fall back to the configuredMax minus generation amount, or just configuredMax if genAmount is not relevant.
      // For an image adapter like a1111forge, context limit for text prompts is less critical in the same way.
      // Returning configuredMax - genAmount is a safe default.
      return configuredMax - genAmount;
  }
}