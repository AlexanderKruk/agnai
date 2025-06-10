import { store } from '../../db'
import { handle } from '../wrap'

/**
 * Security-focused API Key Management Utility
 * 
 * This utility provides a secure, generic way to manage API keys for various services.
 * 
 * SECURITY PRINCIPLES:
 * 1. Keys are never logged or exposed in error messages
 * 2. All operations require authenticated userId
 * 3. Users can only modify their own keys
 * 4. Keys are encrypted before database storage (handled by store layer)
 * 5. Frontend never receives actual key values unless explicitly requested
 */

/** Configuration for each service's API key fields */
type ServiceKeyConfig = {
  /** Primary API key field name */
  keyField: string
  /** Optional additional fields to clear/set when key is deleted */
  additionalFields?: Record<string, any>
}

/** Complete mapping of all supported services and their key configurations */
const SERVICE_KEY_CONFIGS: Record<string, ServiceKeyConfig> = {
  // AI Chat Services
  openai: {
    keyField: 'oaiKey',
    additionalFields: { oaiKeySet: false }
  },
  claude: {
    keyField: 'claudeApiKey',
    additionalFields: { claudeApiKeySet: false }
  },
  mistral: {
    keyField: 'mistralKey',
    additionalFields: { mistralKeySet: false }
  },
  novel: {
    keyField: 'novelApiKey',
    additionalFields: { novelVerified: false }
  },
  
  // Hosted Services
  scale: {
    keyField: 'scaleApiKey',
    additionalFields: { scaleApiKeySet: false }
  },
  featherless: {
    keyField: 'featherlessApiKey',
    additionalFields: { featherlessApiKeySet: false }
  },
  arli: {
    keyField: 'arliApiKey',
    additionalFields: { arliApiKeySet: false }
  },
  
  // Community Services
  horde: {
    keyField: 'hordeKey',
    additionalFields: { hordeName: '' }
  },
  
  // Voice Services
  elevenlabs: {
    keyField: 'elevenLabsApiKey',
    additionalFields: { elevenLabsApiKeySet: false }
  },
  
  // Generic Services
  'third-party': {
    keyField: 'thirdPartyPassword',
    additionalFields: { thirdPartyPasswordSet: false }
  }
} as const

/** Valid service names for type safety */
export type SupportedService = keyof typeof SERVICE_KEY_CONFIGS

/**
 * Generic API key deletion handler
 * 
 * @param service - The service name (must be in SERVICE_KEY_CONFIGS)
 * @returns Express handler function
 * 
 * @security This function:
 * - Validates service name against whitelist
 * - Requires authenticated userId
 * - Only allows users to delete their own keys
 * - Clears all related fields (e.g., verification flags)
 */
export function createDeleteKeyHandler(service: SupportedService) {
  const config = SERVICE_KEY_CONFIGS[service]
  
  if (!config) {
    throw new Error(`Unsupported service: ${service}. Must be one of: ${Object.keys(SERVICE_KEY_CONFIGS).join(', ')}`)
  }
  
  return handle(async ({ userId }) => {
    if (!userId) {
      throw new Error('Authentication required')
    }
    
    // Build update object - clear key and any additional fields
    const updateFields = {
      [config.keyField]: '',
      ...config.additionalFields
    }
    
    // Update user record with cleared fields
    await store.users.updateUser(userId, updateFields)
    
    return { success: true }
  })
}

/**
 * Utility to check if a service is supported
 */
export function isSupportedService(service: string): service is SupportedService {
  return service in SERVICE_KEY_CONFIGS
}

/**
 * Get all supported service names
 */
export function getSupportedServices(): SupportedService[] {
  return Object.keys(SERVICE_KEY_CONFIGS) as SupportedService[]
}

/**
 * Get key field configuration for a service
 */
export function getServiceConfig(service: SupportedService): ServiceKeyConfig {
  return SERVICE_KEY_CONFIGS[service]
}

/**
 * Validate that a service deletion request is properly formatted
 * 
 * @param service - Service name to validate
 * @throws Error if service is not supported
 */
export function validateService(service: string): asserts service is SupportedService {
  if (!isSupportedService(service)) {
    throw new Error(`Unsupported service: ${service}. Supported services: ${getSupportedServices().join(', ')}`)
  }
}