/**
 * Standardized Validation Schemas
 * 
 * This module provides reusable validation schemas to ensure
 * consistency across API endpoints and reduce duplication.
 */

/** Common parameter validations */
export const params = {
  id: { id: 'string' },
  optionalId: { id: 'string?' }
} as const

/** Common query parameter validations */
export const query = {
  pagination: {
    page: 'number?',
    limit: 'number?'
  },
  
  search: {
    query: 'string?',
    page: 'number?',
    limit: 'number?'
  },
  
  filter: {
    enabled: 'boolean?',
    tags: 'string?'
  }
} as const

/** User-related validations */
export const user = {
  profile: {
    handle: 'string',
    avatar: 'string?'
  },
  
  search: {
    username: 'string?',
    page: 'number?',
    customerId: 'string?',
    subscribed: 'boolean?'
  }
} as const

/** Character-related validations */
export const character = {
  base: {
    name: 'string',
    description: 'string?',
    appearance: 'string?',
    culture: 'string?',
    scenario: 'string?',
    greeting: 'string?',
    sampleChat: 'string?',
    persona: 'string?',
    favorite: 'boolean?',
    voice: 'string?',
    tags: 'string?'
  },
  
  update: {
    name: 'string?',
    description: 'string?',
    appearance: 'string?',
    culture: 'string?',
    scenario: 'string?',
    greeting: 'string?',
    sampleChat: 'string?',
    persona: 'string?',
    favorite: 'boolean?',
    voice: 'string?',
    tags: 'string?'
  },
  
  form: {
    name: 'string?',
    description: 'string?',
    appearance: 'string?',
    culture: 'string?',
    visualType: 'string?',
    sprite: 'any?',
    avatar: 'string?',
    scenario: 'string?',
    greeting: 'string?',
    sampleChat: 'string?',
    persona: 'string?',
    favorite: 'boolean?',
    voice: 'string?',
    voiceDisabled: 'string?',
    tags: 'string?',
    json: 'any?',
    imageSettings: 'string?',
    alternateGreetings: 'string?',
    characterBook: 'any?',
    extensions: 'string?',
    systemPrompt: 'string?',
    postHistoryInstructions: 'string?',
    insert: 'string?',
    creator: 'string?',
    characterVersion: 'string?'
  }
} as const

/** Memory/book related validations */
const memoryEntry = {
  name: 'string',
  weight: 'number',
  priority: 'number',
  entry: 'string',
  enabled: 'boolean',
  keywords: ['string']
} as const

export const memory = {
  entry: memoryEntry,
  
  book: {
    name: 'string',
    description: 'string?',
    entries: [memoryEntry]
  }
} as const

/** Chat-related validations */
export const chat = {
  create: {
    name: 'string',
    greeting: 'string?',
    scenario: 'string?',
    sampleChat: 'string?',
    characterId: 'string?',
    mode: 'string?',
    preset: 'string?'
  },
  
  update: {
    name: 'string?',
    greeting: 'string?',
    scenario: 'string?',
    mode: 'string?'
  },
  
  message: {
    message: 'string',
    characterId: 'string?',
    temporary: 'boolean?',
    event: 'string?'
  }
} as const

/** Scenario validations */
const scenarioEntry = {
  name: 'string',
  requires: ['string'],
  assigns: ['string'],
  type: 'string',
  text: 'string',
  trigger: 'any'
} as const

export const scenario = {
  create: {
    name: 'string',
    states: ['string'],
    description: 'string?',
    text: 'string',
    overwriteCharacterScenario: 'boolean',
    instructions: 'string?',
    entries: [scenarioEntry]
  },
  
  update: {
    name: 'string?',
    states: ['string?'],
    description: 'string?',
    text: 'string?',
    overwriteCharacterScenario: 'boolean?',
    instructions: 'string?',
    entries: [scenarioEntry]
  }
} as const

/** Administrative validations */
export const admin = {
  userSearch: {
    username: 'string?',
    page: 'number?',
    customerId: 'string?',
    subscribed: 'boolean?'
  },
  
  configuration: {
    canAuth: 'boolean?',
    canSignup: 'boolean?',
    showDonations: 'boolean?',
    maintenance: 'boolean?'
  }
} as const

/** Image generation validations */
export const image = {
  generate: {
    user: 'string?',
    prompt: 'string',
    characterId: 'string?',
    chatId: 'string?',
    append: 'boolean?',
    source: 'string?',
    messageId: 'string?',
    ephemeral: 'boolean?'
  }
} as const