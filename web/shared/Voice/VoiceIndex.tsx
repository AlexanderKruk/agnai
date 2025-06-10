/**
 * Shared Voice Components
 * 
 * This module provides reusable voice and audio components for use
 * across the application, eliminating duplication and ensuring
 * consistent voice functionality.
 */

// Main VoicePicker component suite
export { VoicePicker } from './index'
export { VoiceServiceSelect } from './VoiceServiceSelect'
export { VoiceIdSelect } from './VoiceIdSelect'
export { VoicePreviewButton } from './VoicePreviewButton'

// Voice service-specific settings
export { ElevenLabsSettings, defaultElevenLabsSettings } from './ElevenLabsSettings'
export { WebSpeechSynthesisSettings } from './WebSpeechSynthesisSettings'
export { NovelTtsSettings } from './NovelTtsSettings'
export { AgnaisticTtsSettings } from './AgnaisticTtsSettings'

// Voice input/recording components
export { SpeechRecognitionRecorder } from './SpeechRecognitionRecorder'
export { default as VolumeControl } from './VolumeControl'