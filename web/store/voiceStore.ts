import { AppSchema } from '../../common/types/schema'
import { createStore } from './create'
import { voiceApi } from './data/voice'
import { VoiceSettings, VoiceWebSynthesisSettings } from '../../common/types/texttospeech-schema'
import { defaultCulture } from '../shared/CultureCodes'
import { createSpeech, isNativeSpeechSupported, stopSpeech } from '../shared/Audio/speech'
import { toastStore } from './toasts'

export type VoiceState = 'generating' | 'playing'

export type VoiceStoreState = {
  speaking: { messageId: string; status: VoiceState } | undefined
}

const initState: VoiceStoreState = {
  speaking: undefined,
}

export const voiceStore = createStore<VoiceStoreState>(
  'voice',
  initState
)((getState, setState) => {
  return {
    stopSpeaking() {
      return { speaking: undefined }
    },

    async *textToSpeech(
      { speaking },
      messageId: string,
      text: string,
      voice: VoiceSettings,
      culture?: string,
      activeChatId?: string
    ) {
      if (!voice.service) {
        yield { speaking: undefined }
        return
      }

      yield { speaking: { messageId, status: 'generating' } }

      if (voice.service === 'webspeechsynthesis') {
        yield { speaking: { messageId, status: 'playing' } }

        try {
          await playVoiceFromBrowser(voice, text, culture ?? defaultCulture, messageId)
        } catch (ex: any) {
          toastStore.error(`Text-to-speech failed: ${ex.message}`)
        }
        return { speaking: undefined }
      }

      // Check if message already has cached voice URL
      const msg = await getMessageWithVoiceUrl(messageId)
      if (msg?.voiceUrl) {
        playVoiceFromUrl(activeChatId!, messageId, msg.voiceUrl, voice.rate)
        return { speaking: undefined }
      }

      const res = await voiceApi.chatTextToSpeech({
        chatId: activeChatId!,
        messageId,
        text,
        voice,
      })

      if (res.error) {
        toastStore.error(`Text-to-speech failed: ${res.error}`)
        return { speaking: undefined }
      }

      if (res.result) {
        const url = (res.result as any).url || ''
        playVoiceFromUrl(activeChatId!, messageId, url, voice.rate)
      }

      return { speaking: undefined }
    },
  }
})

async function getMessageWithVoiceUrl(messageId: string): Promise<{ voiceUrl?: string } | null> {
  // This would need to be implemented to fetch message from the appropriate store
  // For now, returning null to maintain existing behavior
  return null
}

function playVoiceFromUrl(chatId: string, messageId: string, url: string, rate?: number) {
  voiceStore.setState({ speaking: { messageId, status: 'playing' } })
  
  // Create audio element and play
  const audio = new Audio(url)
  if (rate) audio.playbackRate = rate
  
  audio.onended = () => {
    voiceStore.setState({ speaking: undefined })
  }
  
  audio.onerror = (error) => {
    console.error('Audio playback error:', error)
    voiceStore.setState({ speaking: undefined })
    toastStore.error('Failed to play voice message')
  }
  
  audio.play().catch(error => {
    console.error('Audio play error:', error)
    voiceStore.setState({ speaking: undefined })
    toastStore.error('Failed to play voice message')
  })
}

async function playVoiceFromBrowser(
  voice: VoiceWebSynthesisSettings,
  text: string, 
  culture: string,
  messageId: string
) {
  if (!isNativeSpeechSupported()) {
    throw new Error('Text-to-speech is not supported in this browser')
  }

  voiceStore.setState({ speaking: { messageId, status: 'playing' } })

  try {
    await createSpeech(voice as any)
  } finally {
    voiceStore.setState({ speaking: undefined })
  }
}

export function getMessageSpeechInfo(msg: AppSchema.ChatMessage, user?: AppSchema.User) {
  if (!user?.texttospeech?.enabled || msg.userId) return

  const voice = user.texttospeech
  const culture = (user.texttospeech as any)?.culture

  return {
    speaking: { messageId: msg._id, status: 'generating' as VoiceState },
    voice,
    culture,
  }
}

// Re-export stopSpeech for external use
export { stopSpeech }