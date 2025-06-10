/**
 * Integration Test Setup
 * 
 * Configures test environment, database, and utilities for integration testing
 */

import { AppSchema } from '../../common/types/schema'

// Test Environment Configuration
export const TEST_CONFIG = {
  // Use in-memory database for tests
  database: {
    type: 'memory' as const,
    name: 'agnai-test',
  },
  
  // Test server configuration  
  server: {
    port: 0, // Use random available port
    host: 'localhost',
  },
  
  // Mock API URLs
  apis: {
    agnaistic: 'http://localhost:mock-agnai-api',
  },
  
  // Test JWT secret
  jwtSecret: 'test-jwt-secret-key-for-integration-tests',
}

// Test Data Fixtures
export const TEST_FIXTURES = {
  users: {
    admin: {
      _id: 'test-admin-id',
      username: 'testadmin',
      hash: 'hashedpassword123', // Use hash instead of password
      email: 'admin@test.com',
      kind: 'user' as const,
      admin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    regularUser: {
      _id: 'test-user-id',
      username: 'testuser',
      hash: 'hashedpassword123', // Use hash instead of password
      email: 'user@test.com', 
      kind: 'user' as const,
      admin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    guest: {
      _id: 'test-guest-id',
      username: 'guest',
      kind: 'user' as const,
      admin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },

  characters: {
    testCharacter: {
      _id: 'test-character-id',
      userId: 'test-user-id',
      name: 'Test Character',
      description: 'A test character for integration tests',
      personality: 'Helpful and friendly',
      scenario: 'Test scenario',
      greeting: 'Hello! I am a test character.',
      sampleChat: 'User: Hi\\nTest Character: Hello there!',
      persona: { kind: 'text', attributes: {} }, // Required field
      kind: 'character' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },

  chats: {
    testChat: {
      _id: 'test-chat-id',
      userId: 'test-user-id',
      characterId: 'test-character-id',
      name: 'Test Chat',
      scenario: 'Test chat scenario',
      memberIds: [], // Required field
      messageCount: 0, // Required field
      kind: 'chat' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },

  messages: {
    userMessage: {
      _id: 'test-message-user-id',
      chatId: 'test-chat-id',
      userId: 'test-user-id',
      kind: 'chat-message' as const,
      msg: 'Hello test character!',
      adapter: 'agnai-subscriber',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    characterMessage: {
      _id: 'test-message-char-id', 
      chatId: 'test-chat-id',
      userId: 'test-user-id',
      characterId: 'test-character-id',
      kind: 'chat-message' as const,
      msg: 'Hello! How can I help you today?',
      adapter: 'agnai-subscriber',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
}

// Test Database Interface
export interface TestDatabase {
  setup(): Promise<void>
  teardown(): Promise<void>
  clear(): Promise<void>
  seed(fixtures?: Partial<typeof TEST_FIXTURES>): Promise<void>
}

// Memory Database Implementation for Tests
export class MemoryTestDatabase implements TestDatabase {
  private data: {
    users: Map<string, AppSchema.User>
    characters: Map<string, AppSchema.Character>
    chats: Map<string, AppSchema.Chat>
    messages: Map<string, AppSchema.ChatMessage>
  } = {
    users: new Map(),
    characters: new Map(), 
    chats: new Map(),
    messages: new Map(),
  }

  async setup(): Promise<void> {
    // Initialize in-memory storage
    this.clear()
  }

  async teardown(): Promise<void> {
    // Clean up resources
    this.clear()
  }

  async clear(): Promise<void> {
    this.data.users.clear()
    this.data.characters.clear()
    this.data.chats.clear()
    this.data.messages.clear()
  }

  async seed(fixtures: Partial<typeof TEST_FIXTURES> = TEST_FIXTURES): Promise<void> {
    // Seed users
    if (fixtures.users) {
      for (const [key, user] of Object.entries(fixtures.users)) {
        this.data.users.set(user._id, user as AppSchema.User)
      }
    }

    // Seed characters
    if (fixtures.characters) {
      for (const [key, character] of Object.entries(fixtures.characters)) {
        this.data.characters.set(character._id, character as any)
      }
    }

    // Seed chats
    if (fixtures.chats) {
      for (const [key, chat] of Object.entries(fixtures.chats)) {
        this.data.chats.set(chat._id, chat as any)
      }
    }

    // Seed messages
    if (fixtures.messages) {
      for (const [key, message] of Object.entries(fixtures.messages)) {
        this.data.messages.set(message._id, message as AppSchema.ChatMessage)
      }
    }
  }

  // Accessor methods for tests
  getUser(id: string): AppSchema.User | undefined {
    return this.data.users.get(id)
  }

  getCharacter(id: string): AppSchema.Character | undefined {
    return this.data.characters.get(id)
  }

  getChat(id: string): AppSchema.Chat | undefined {
    return this.data.chats.get(id)
  }

  getMessage(id: string): AppSchema.ChatMessage | undefined {
    return this.data.messages.get(id)
  }

  getAllUsers(): AppSchema.User[] {
    return Array.from(this.data.users.values())
  }

  getAllChats(): AppSchema.Chat[] {
    return Array.from(this.data.chats.values())
  }

  getAllMessages(): AppSchema.ChatMessage[] {
    return Array.from(this.data.messages.values())
  }
}

// Export singleton instance for tests
export const testDb = new MemoryTestDatabase()

// Test Environment Setup Helper
export async function setupTestEnvironment(): Promise<void> {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = TEST_CONFIG.jwtSecret
  process.env.LOG_LEVEL = 'error' // Reduce log noise in tests
  
  // Initialize test database
  await testDb.setup()
  await testDb.seed()
}

// Test Environment Cleanup Helper
export async function teardownTestEnvironment(): Promise<void> {
  await testDb.teardown()
  
  // Clean up environment variables
  delete process.env.JWT_SECRET
  delete process.env.LOG_LEVEL
}

// Test Utilities
export const TestUtils = {
  // Generate test JWT token
  generateTestToken(user: AppSchema.User): string {
    const jwt = require('jsonwebtoken')
    return jwt.sign(
      { userId: user._id, username: user.username },
      TEST_CONFIG.jwtSecret,
      { expiresIn: '1h' }
    )
  },

  // Create test headers with auth
  createAuthHeaders(user: AppSchema.User): { Authorization: string } {
    return {
      Authorization: `Bearer ${this.generateTestToken(user)}`
    }
  },

  // Wait for async operations
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  // Generate random test IDs
  generateId(prefix = 'test'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
  }
}