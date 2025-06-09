import type { AIAdapter, ThirdPartyFormat } from '../../adapters'

/** NovelAI service configuration */
export interface NovelAIConfig {
  /** NovelAI API key */
  novelApiKey: string
  /** NovelAI model selection */
  novelModel: string
  /** Whether NovelAI key is verified */
  novelVerified?: boolean
}

/** OpenAI service configuration */
export interface OpenAIConfig {
  /** OpenAI API key */
  oaiKey: string
  /** Whether OpenAI key is set */
  oaiKeySet?: boolean
}

/** Kobold/Text Generation WebUI configuration */
export interface KoboldConfig {
  /** Kobold API URL */
  koboldUrl: string
  /** Oobabooga URL */
  oobaUrl: string
  /** Third-party format for communication */
  thirdPartyFormat: ThirdPartyFormat
  /** Third-party password */
  thirdPartyPassword: string
  /** Whether third-party password is set */
  thirdPartyPasswordSet?: boolean
}

/** Horde AI configuration */
export interface HordeConfig {
  /** User's Horde API key */
  userHordeKey?: string
  /** Horde API key */
  hordeKey: string
  /** Horde model selection */
  hordeModel: string | string[]
  /** Horde username */
  hordeName?: string
  /** Whether to use trusted workers only */
  hordeUseTrusted?: boolean
  /** Specific workers to use */
  hordeWorkers?: string[]
}

/** Scale API configuration */
export interface ScaleConfig {
  /** Scale API URL */
  scaleUrl?: string
  /** Scale API key */
  scaleApiKey?: string
  /** Whether Scale API key is set */
  scaleApiKeySet?: boolean
}

/** Claude API configuration */
export interface ClaudeConfig {
  /** Claude API key */
  claudeApiKey?: string
  /** Whether Claude API key is set */
  claudeApiKeySet?: boolean
}

/** Mistral AI configuration */
export interface MistralConfig {
  /** Mistral API key */
  mistralKey?: string
  /** Whether Mistral key is set */
  mistralKeySet?: boolean
}

/** ElevenLabs TTS configuration */
export interface ElevenLabsConfig {
  /** ElevenLabs API key */
  elevenLabsApiKey?: string
  /** Whether ElevenLabs key is set */
  elevenLabsApiKeySet?: boolean
}

/** Featherless API configuration */
export interface FeatherlessConfig {
  /** Featherless API key */
  featherlessApiKey?: string
  /** Whether Featherless key is set */
  featherlessApiKeySet?: boolean
}

/** Arli API configuration */
export interface ArliConfig {
  /** Arli API key */
  arliApiKey?: string
  /** Whether Arli key is set */
  arliApiKeySet?: boolean
}

/** AI service defaults */
export interface AIServiceDefaults {
  /** Default AI adapter */
  defaultAdapter: AIAdapter
  /** Default presets per adapter */
  defaultPresets?: { [key in AIAdapter]?: string }
  /** Default preset ID */
  defaultPreset?: string
  /** Character generation preset */
  chargenPreset?: string
  /** Local pipeline usage */
  useLocalPipeline: boolean
  /** Adapter-specific configuration */
  adapterConfig?: { [key in AIAdapter]?: Record<string, any> }
}

/** Complete AI services configuration */
export interface UserAIServices extends
  NovelAIConfig,
  OpenAIConfig,
  KoboldConfig,
  HordeConfig,
  ScaleConfig,
  ClaudeConfig,
  MistralConfig,
  ElevenLabsConfig,
  FeatherlessConfig,
  ArliConfig,
  AIServiceDefaults {}