import { Component, Show, Switch, Match } from 'solid-js'
import { Send } from 'lucide-solid'
import Button from '../../../shared/Button'
import { SpeechRecognitionRecorder } from './SpeechRecognitionRecorder'

export interface VoiceRecorderProps {
  hasText: boolean
  listening: boolean
  culture?: string
  speechToTextEnabled?: boolean
  onText: (value: string) => void
  onSubmit: () => void
  onListeningChange: (listening: boolean) => void
  cleared: number
}

const VoiceRecorder: Component<VoiceRecorderProps> = (props) => {
  return (
    <Switch>
      <Match when={props.speechToTextEnabled && (!props.hasText || props.listening)}>
        <div class="flex h-full items-center">
          <SpeechRecognitionRecorder
            culture={props.culture}
            onText={props.onText}
            onSubmit={props.onSubmit}
            cleared={props.cleared}
            listening={props.onListeningChange}
            class="h-full bg-[var(--bg-800)]"
          />
        </div>
      </Match>

      <Match when>
        <Button schema="clear" onClick={props.onSubmit} class="mt-1">
          <Send class="icon-button" size={18} />
        </Button>
      </Match>
    </Switch>
  )
}

export default VoiceRecorder