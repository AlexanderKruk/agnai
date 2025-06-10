import { Component, createSignal, Show } from 'solid-js'
import { AppSchema } from '../../common/types/schema'
import Button from './Button'
import TextInput from './TextInput'
import { userStore } from '../store'
import { SupportedService, getServiceDisplayName } from './api-key-manager'

/**
 * Reusable API Key Management Component
 * 
 * This component provides a standardized UI for managing API keys across
 * all services, eliminating duplicate code in settings pages.
 * 
 * Features:
 * - Secure password input with masked display
 * - Show/hide API key functionality  
 * - Delete key with confirmation
 * - Service-specific labeling and help text
 * - Conditional delete button visibility
 * - Support for both button and link delete styles
 */

export interface ApiKeyManagerProps {
  /** Service identifier (e.g., 'openai', 'claude', 'novel') */
  service: SupportedService
  
  /** Current user state containing API key values */
  user: AppSchema.User
  
  /** Function to update user state */
  setter: (key: string, value: string) => void
  
  /** API key field name in user state (e.g., 'oaiKey', 'claudeApiKey') */
  keyField: string
  
  /** Optional: Field indicating if key is set (e.g., 'oaiKeySet') */
  setField?: string
  
  /** Optional: Field indicating if key is verified (e.g., 'novelVerified') */
  verifiedField?: string
  
  /** Helper text to display below input */
  helperText?: string
  
  /** Placeholder example for when no key is set */
  placeholder?: string
  
  /** Show delete button as link instead of button */
  deleteAsLink?: boolean
  
  /** Always show delete button (don't check if key is set) */
  alwaysShowDelete?: boolean
  
  /** Custom delete button text */
  deleteText?: string
}

/**
 * API Key Input Component
 * 
 * Handles the input field with proper masking and placeholder text.
 */
export const ApiKeyInput: Component<ApiKeyManagerProps> = (props) => {
  const keyValue = () => (props.user as any)[props.keyField] || ''
  const isKeySet = () => {
    if (props.setField) return (props.user as any)[props.setField]
    return Boolean(keyValue())
  }
  
  const placeholder = () => {
    if (isKeySet()) {
      return `${getServiceDisplayName(props.service)} key is set`
    }
    return props.placeholder || `Enter ${getServiceDisplayName(props.service)} API key`
  }
  
  return (
    <TextInput
      label={`${getServiceDisplayName(props.service)} API Key`}
      helperText={props.helperText}
      placeholder={placeholder()}
      type="password"
      value={keyValue()}
      onChange={(ev) => props.setter(props.keyField, ev.currentTarget.value)}
    />
  )
}

/**
 * API Key Delete Button Component
 * 
 * Handles delete functionality with proper conditional visibility.
 */
export const ApiKeyDeleteButton: Component<ApiKeyManagerProps> = (props) => {
  const keyValue = () => (props.user as any)[props.keyField] || ''
  const isKeySet = () => {
    if (props.setField) return (props.user as any)[props.setField]
    return Boolean(keyValue())
  }
  
  const isVerified = () => {
    if (props.verifiedField) return (props.user as any)[props.verifiedField]
    return false
  }
  
  const shouldShowDelete = () => {
    if (props.alwaysShowDelete) return true
    return isKeySet() || isVerified()
  }
  
  const deleteText = () => 
    props.deleteText || `Delete ${getServiceDisplayName(props.service)} Key`
  
  const handleDelete = () => {
    userStore.deleteKey(props.service)
  }
  
  return (
    <Show when={shouldShowDelete()}>
      {props.deleteAsLink ? (
        <a class="link" onClick={handleDelete}>
          {deleteText()}
        </a>
      ) : (
        <Button schema="red" class="w-max" onClick={handleDelete}>
          {deleteText()}
        </Button>
      )}
    </Show>
  )
}

/**
 * Complete API Key Manager Component
 * 
 * Combines input field and delete functionality into a single component.
 */
export const ApiKeyManager: Component<ApiKeyManagerProps> = (props) => {
  return (
    <div class="flex flex-col gap-2">
      <ApiKeyInput {...props} />
      <ApiKeyDeleteButton {...props} />
    </div>
  )
}

/**
 * API Key Reveal Button Component
 * 
 * Provides show/hide functionality for API keys (used in main settings).
 */
export interface ApiKeyRevealProps {
  /** Service name for display */
  service: SupportedService
  
  /** Current API key value */
  apiKey: string
  
  /** Callback when key should be revealed */
  onReveal: () => void
  
  /** Callback when key should be hidden */
  onHide?: () => void
}

export const ApiKeyRevealButton: Component<ApiKeyRevealProps> = (props) => {
  const [isRevealed, setIsRevealed] = createSignal(false)
  
  const isHidden = () => props.apiKey.includes('***') || !isRevealed()
  
  const handleReveal = () => {
    if (isHidden()) {
      props.onReveal()
      setIsRevealed(true)
    } else {
      props.onHide?.()
      setIsRevealed(false)
    }
  }
  
  return (
    <Show when={props.apiKey}>
      <div class="flex items-center gap-2">
        <TextInput
          label={`${getServiceDisplayName(props.service)} API Key`}
          value={props.apiKey}
          type="password"
          readonly
        />
        <Button size="pill" onClick={handleReveal}>
          {isHidden() ? 'Reveal Key' : 'Hide Key'}
        </Button>
      </div>
    </Show>
  )
}

export default ApiKeyManager