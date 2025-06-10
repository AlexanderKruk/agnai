import { Component } from 'solid-js'
import { Card } from '../../../shared/Card'
import { Toggle } from '../../../shared/Toggle'
import Select from '../../../shared/Select'
import VoicePicker from './VoicePicker'
import { CultureCodes } from '../../../shared/CultureCodes'

export interface VoiceTabProps {
  editor: any // CharEditor type
}

export const VoiceTab: Component<VoiceTabProps> = (props) => {
  return (
    <div class="flex flex-col gap-2">
      <Card class="flex flex-col gap-3">
        <h4 class="text-md font-bold">Voice</h4>
        <Toggle
          fieldName="voiceDisabled"
          value={props.editor.state.voiceDisabled}
          label="Disable Character's Voice"
          helperText="Toggle on to disable this character from automatically speaking"
          onChange={(ev) => props.editor.update('voiceDisabled', ev)}
        />

        <VoicePicker
          value={props.editor.state.voice}
          culture={props.editor.state.culture}
          onChange={(voice) => props.editor.update('voice', voice)}
        />

        <Select
          fieldName="culture"
          label="Language"
          helperText={`The language this character speaks and understands.${
            props.editor.state.culture.startsWith('en') ?? true
              ? ''
              : ' NOTE: You need to also translate the preset gaslight to use a non-english language.'
          }`}
          value={props.editor.state.culture}
          items={CultureCodes}
          onChange={(option) => props.editor.update('culture', option.value)}
        />
      </Card>
    </div>
  )
}