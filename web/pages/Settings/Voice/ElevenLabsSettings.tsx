import { Component } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'
import { ApiKeyManager } from '../../../shared/ApiKeyManager'
import { UserSettings } from '../util'

const ElevenLabsSettings: Component<{
  state: UserSettings
  setter: SetStoreFunction<UserSettings>
}> = (props) => {
  return (
    <>
      <div class="text-xl">ElevenLabs</div>
      
      <ApiKeyManager
        service="elevenlabs"
        user={props.state as any}
        setter={props.setter}
        keyField="elevenLabsApiKey"
        setField="elevenLabsApiKeySet"
        helperText="Your ElevenLabs API key for text-to-speech generation."
        placeholder="E.g. q1h66jyatguvhcglabosuywp1dc6blvg"
      />
    </>
  )
}

export default ElevenLabsSettings
