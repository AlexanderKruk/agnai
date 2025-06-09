import type { ImageSettings } from '../image-schema'
import type { TTSSettings } from '../texttospeech-schema'

/** Speech-to-text configuration */
export interface SpeechToTextSettings {
  /** Whether speech-to-text is enabled */
  enabled: boolean
  /** Whether to auto-submit transcribed text */
  autoSubmit: boolean
  /** Whether to auto-start recording */
  autoRecord: boolean
}

/** Image generation defaults */
export interface ImageDefaults {
  /** Use default size */
  size: boolean
  /** Use default affixes */
  affixes: boolean
  /** Use default negative prompts */
  negative: boolean
  /** Use default sampler */
  sampler: boolean
  /** Use default guidance */
  guidance: boolean
  /** Use default steps */
  steps: boolean
}

/** Image recommendation settings */
export type ImageRecommendation = 
  | 'all' 
  | 'except-size' 
  | 'except-affix' 
  | 'except-negative' 
  | 'none'

/** Complete user media configuration */
export interface UserMedia {
  /** Speech-to-text settings */
  speechtotext?: SpeechToTextSettings
  /** Text-to-speech settings */
  texttospeech?: TTSSettings
  /** Image generation settings */
  images?: ImageSettings & {}
  /** Image generation defaults */
  imageDefaults?: ImageDefaults
  /** Image recommendation usage */
  useRecommendedImages?: ImageRecommendation
}