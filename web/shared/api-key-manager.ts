import { AppSchema } from '../../common/types/schema'
import { api } from '../store/api'
import { toastStore } from '../store/toasts'

/**
 * Secure Frontend API Key Manager
 * 
 * This utility provides secure frontend handling of API keys.
 * 
 * SECURITY PRINCIPLES:
 * 1. API keys are never stored in component state
 * 2. Keys are immediately cleared from memory after API calls
 * 3. Keys are only sent to server endpoints, never to external services
 * 4. Deletion requests only send service names, never key values
 * 5. UI shows masked values or "key is set" indicators
 */

/** Configuration for frontend key management */
type FrontendKeyConfig = {
  /** Display name for the service */
  displayName: string
  /** Field names that should be cleared when key is deleted */
  clearFields: {
    keyField: string
    additionalFields?: Record<string, any>
  }
}

/** Frontend configuration mapping - matches backend SERVICE_KEY_CONFIGS */
const FRONTEND_KEY_CONFIGS: Record<string, FrontendKeyConfig> = {
  // AI Chat Services
  openai: {
    displayName: 'OpenAI',
    clearFields: {
      keyField: 'oaiKey',
      additionalFields: { oaiKeySet: false }
    }
  },
  claude: {
    displayName: 'Claude',
    clearFields: {
      keyField: 'claudeApiKey',
      additionalFields: { claudeApiKeySet: false }
    }
  },
  mistral: {
    displayName: 'Mistral',
    clearFields: {
      keyField: 'mistralKey',
      additionalFields: { mistralKeySet: false }
    }
  },
  novel: {
    displayName: 'NovelAI',
    clearFields: {
      keyField: 'novelApiKey',
      additionalFields: { novelVerified: false }
    }
  },
  
  // Hosted Services
  scale: {
    displayName: 'Scale',
    clearFields: {
      keyField: 'scaleApiKey',
      additionalFields: { scaleApiKeySet: false }
    }
  },
  featherless: {
    displayName: 'Featherless',
    clearFields: {
      keyField: 'featherlessApiKey',
      additionalFields: { featherlessApiKeySet: false }
    }
  },
  arli: {
    displayName: 'Arli',
    clearFields: {
      keyField: 'arliApiKey',
      additionalFields: { arliApiKeySet: false }
    }
  },
  
  // Community Services
  horde: {
    displayName: 'AI Horde',
    clearFields: {
      keyField: 'hordeKey',
      additionalFields: { hordeName: '' }
    }
  },
  
  // Voice Services
  elevenlabs: {
    displayName: 'ElevenLabs',
    clearFields: {
      keyField: 'elevenLabsApiKey',
      additionalFields: { elevenLabsApiKeySet: false }
    }
  },
  
  // Generic Services
  'third-party': {
    displayName: 'Third Party',
    clearFields: {
      keyField: 'thirdPartyPassword',
      additionalFields: { thirdPartyPasswordSet: false }
    }
  }
} as const

/** Valid service names for type safety */
export type SupportedService = keyof typeof FRONTEND_KEY_CONFIGS

/**
 * Securely delete an API key
 * 
 * @param service - Service name (must be supported)
 * @param currentUser - Current user state for optimistic updates
 * @returns Updated user object with cleared fields
 * 
 * @security This function:
 * - Only sends service name to backend (never key values)
 * - Immediately clears key fields from local state
 * - Uses secure API endpoint with authentication
 * - Shows generic success/error messages (no key exposure)
 */
export async function deleteApiKey(
  service: SupportedService,
  currentUser?: AppSchema.User
): Promise<{ success: boolean; updatedUser?: AppSchema.User }> {
  
  const config = FRONTEND_KEY_CONFIGS[service]
  if (!config) {
    toastStore.error(`Unsupported service: ${service}`)
    return { success: false }
  }
  
  try {
    // Call backend delete endpoint (only sends service name, never key value)
    const res = await api.method('delete', `/user/config/${service}`)
    
    if (res.error) {
      toastStore.error(`Failed to delete ${config.displayName} key: ${res.error}`)
      return { success: false }
    }
    
    // Optimistically update local state to clear key fields
    if (currentUser) {
      const updates: Partial<AppSchema.User> = {
        [config.clearFields.keyField]: '',
        ...config.clearFields.additionalFields
      }
      
      const updatedUser = { ...currentUser, ...updates }
      
      toastStore.success(`${config.displayName} key removed`)
      return { success: true, updatedUser }
    }
    
    toastStore.success(`${config.displayName} key removed`)
    return { success: true }
    
  } catch (error) {
    // Generic error message - never expose key details
    toastStore.error(`Failed to delete ${config.displayName} key`)
    return { success: false }
  }
}

/**
 * Check if a service is supported
 */
export function isSupportedService(service: string): service is SupportedService {
  return service in FRONTEND_KEY_CONFIGS
}

/**
 * Get display name for a service
 */
export function getServiceDisplayName(service: SupportedService): string {
  return FRONTEND_KEY_CONFIGS[service].displayName
}

/**
 * Get all supported services
 */
export function getSupportedServices(): SupportedService[] {
  return Object.keys(FRONTEND_KEY_CONFIGS) as SupportedService[]
}

/**
 * Check if a key is set for display purposes
 * 
 * @param user - User object
 * @param service - Service to check
 * @returns true if key appears to be set
 * 
 * @security This never exposes actual key values
 */
export function isKeySet(user: AppSchema.User | undefined, service: SupportedService): boolean {
  if (!user) return false
  
  const config = FRONTEND_KEY_CONFIGS[service]
  const keyField = config.clearFields.keyField as keyof AppSchema.User
  const keyValue = user[keyField] as string
  
  return Boolean(keyValue && keyValue.trim() !== '')
}

/**
 * Get masked display value for UI
 * 
 * @param user - User object
 * @param service - Service to check
 * @returns Masked string for display
 * 
 * @security Never returns actual key values
 */
export function getMaskedKeyDisplay(user: AppSchema.User | undefined, service: SupportedService): string {
  const keySet = isKeySet(user, service)
  return keySet ? 'API key is set' : 'Enter API key...'
}

/**
 * Validate service for type safety
 */
export function validateService(service: string): asserts service is SupportedService {
  if (!isSupportedService(service)) {
    throw new Error(`Unsupported service: ${service}. Supported: ${getSupportedServices().join(', ')}`)
  }
}