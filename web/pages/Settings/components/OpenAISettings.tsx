import { Component } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'
import { ApiKeyManager } from '../../../shared/ApiKeyManager'
import { UserSettings } from '../util'

const OpenAISettings: Component<{
  state: UserSettings
  setter: SetStoreFunction<UserSettings>
}> = (props) => {
  return (
    <ApiKeyManager
      service="openai"
      user={props.state as any}
      setter={props.setter}
      keyField="oaiKey"
      setField="oaiKeySet"
      helperText="Valid OpenAI Key."
      placeholder="E.g. sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    />
  )
}

export default OpenAISettings
