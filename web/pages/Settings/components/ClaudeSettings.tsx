import { Component } from 'solid-js'
import { SetStoreFunction } from 'solid-js/store'
import { ApiKeyManager } from '../../../shared/ApiKeyManager'
import { UserSettings } from '../util'

const ClaudeSettings: Component<{
  state: UserSettings
  setter: SetStoreFunction<UserSettings>
}> = (props) => {
  return (
    <ApiKeyManager
      service="claude"
      user={props.state}
      setter={props.setter}
      keyField="claudeApiKey"
      setField="claudeApiKeySet"
      helperText="Valid Claude Key."
      placeholder="E.g. sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    />
  )
}

export default ClaudeSettings
