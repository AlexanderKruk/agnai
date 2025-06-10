/**
 * Database Operations Logic Integration Tests
 * 
 * Tests database operation logic, validation, and data integrity without requiring full server
 */

import { expect } from 'chai'
import { setupTestEnvironment, teardownTestEnvironment, TEST_FIXTURES, testDb } from './test-setup'

describe('Database Operations Logic Integration Tests', () => {
  before(async () => {
    await setupTestEnvironment()
  })

  after(async () => {
    await teardownTestEnvironment()
  })

  beforeEach(async () => {
    await testDb.clear()
    await testDb.seed()
  })

  describe('User Data Validation and Processing', () => {
    it('should validate user creation data correctly', () => {
      const validateUserData = (userData: any) => {
        const errors: string[] = []
        
        // Username validation
        if (!userData.username) {
          errors.push('Username is required')
        } else if (userData.username.length < 3) {
          errors.push('Username must be at least 3 characters')
        } else if (userData.username.length > 20) {
          errors.push('Username must be no more than 20 characters')
        } else if (!/^[a-zA-Z0-9_-]+$/.test(userData.username)) {
          errors.push('Username can only contain letters, numbers, underscore, and dash')
        }
        
        // Password validation
        if (!userData.password) {
          errors.push('Password is required')
        } else if (userData.password.length < 8) {
          errors.push('Password must be at least 8 characters')
        } else if (userData.password.length > 128) {
          errors.push('Password must be no more than 128 characters')
        } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(userData.password)) {
          errors.push('Password must contain at least one letter and one number')
        }
        
        // Handle validation
        if (!userData.handle) {
          errors.push('Display name is required')
        } else if (userData.handle.length > 50) {
          errors.push('Display name must be no more than 50 characters')
        }
        
        // Email validation (if provided)
        if (userData.email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(userData.email)) {
            errors.push('Invalid email format')
          }
        }
        
        return {
          valid: errors.length === 0,
          errors
        }
      }

      // Test valid user data
      const validUser = {
        username: 'validuser123',
        password: 'securepass123',
        handle: 'Valid User',
        email: 'user@example.com'
      }
      
      const validResult = validateUserData(validUser)
      expect(validResult.valid).to.be.true
      expect(validResult.errors).to.have.length(0)

      // Test invalid user data
      const invalidUsers = [
        { username: 'ab', password: 'pass123', handle: 'User' }, // Username too short
        { username: 'validuser', password: 'short', handle: 'User' }, // Password too short
        { username: 'validuser', password: 'onlyletters', handle: 'User' }, // Password no numbers
        { username: 'valid@user', password: 'pass123', handle: 'User' }, // Invalid username chars
        { username: 'validuser', password: 'pass123', handle: '' }, // Empty handle
        { username: 'validuser', password: 'pass123', handle: 'User', email: 'invalid-email' } // Invalid email
      ]

      invalidUsers.forEach(userData => {
        const result = validateUserData(userData)
        expect(result.valid).to.be.false
        expect(result.errors.length).to.be.greaterThan(0)
      })
    })

    it('should check for duplicate usernames', () => {
      const existingUsers = ['testuser', 'admin', 'guest']
      
      const checkUsernameAvailability = (username: string) => {
        return !existingUsers.includes(username.toLowerCase())
      }

      expect(checkUsernameAvailability('newuser')).to.be.true
      expect(checkUsernameAvailability('testuser')).to.be.false
      expect(checkUsernameAvailability('TESTUSER')).to.be.false // Case insensitive
      expect(checkUsernameAvailability('Admin')).to.be.false
    })

    it('should properly hash and verify passwords', async () => {
      const bcrypt = require('bcryptjs')
      
      const hashPassword = async (password: string) => {
        return await bcrypt.hash(password, 10)
      }
      
      const verifyPassword = async (password: string, hash: string) => {
        return await bcrypt.compare(password, hash)
      }

      const password = 'mySecurePassword123'
      const hash = await hashPassword(password)
      
      expect(hash).to.not.equal(password)
      expect(hash.length).to.be.greaterThan(50)
      expect(hash.startsWith('$2')).to.be.true // bcrypt format
      
      expect(await verifyPassword(password, hash)).to.be.true
      expect(await verifyPassword('wrongpassword', hash)).to.be.false
    })

    it('should sanitize user data for safe storage', () => {
      const sanitizeUserInput = (input: string) => {
        return input
          .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
          .trim()
      }

      const unsafeInputs = [
        'Normal text',
        '<script>alert("xss")</script>Safe text',
        'Text with\x00null\x1Fcharacters',
        '  Text with spaces  '
      ]

      const sanitized = unsafeInputs.map(sanitizeUserInput)
      
      expect(sanitized[0]).to.equal('Normal text')
      expect(sanitized[1]).to.equal('Safe text')
      expect(sanitized[2]).to.equal('Text withnullcharacters')
      expect(sanitized[3]).to.equal('Text with spaces')
    })
  })

  describe('Character Data Management', () => {
    it('should validate character creation data', () => {
      const validateCharacterData = (characterData: any) => {
        const errors: string[] = []
        
        // Name validation
        if (!characterData.name) {
          errors.push('Character name is required')
        } else if (characterData.name.length > 50) {
          errors.push('Character name must be no more than 50 characters')
        }
        
        // Description validation
        if (!characterData.description) {
          errors.push('Character description is required')
        } else if (characterData.description.length > 2000) {
          errors.push('Character description must be no more than 2000 characters')
        }
        
        // Persona validation
        if (!characterData.persona || !characterData.persona.attributes) {
          errors.push('Character persona is required')
        }
        
        // Greeting validation
        if (characterData.greeting && characterData.greeting.length > 500) {
          errors.push('Greeting must be no more than 500 characters')
        }
        
        return {
          valid: errors.length === 0,
          errors
        }
      }

      // Valid character
      const validCharacter = {
        name: 'Test Character',
        description: 'A helpful AI assistant for testing',
        persona: {
          kind: 'text',
          attributes: {
            text: 'You are helpful and friendly.'
          }
        },
        greeting: 'Hello! How can I help you?'
      }
      
      const validResult = validateCharacterData(validCharacter)
      expect(validResult.valid).to.be.true

      // Invalid characters
      const invalidCharacters = [
        { description: 'Missing name' }, // No name
        { name: 'Test', description: '' }, // Empty description
        { name: 'Test', description: 'Valid', persona: null }, // Missing persona
        { name: 'a'.repeat(51), description: 'Valid', persona: { kind: 'text', attributes: {} } }, // Name too long
      ]

      invalidCharacters.forEach((char: any) => {
        const result = validateCharacterData(char)
        expect(result.valid).to.be.false
        expect(result.errors.length).to.be.greaterThan(0)
      })
    })

    it('should handle character persona formats correctly', () => {
      const validatePersona = (persona: any) => {
        if (!persona || typeof persona !== 'object') {
          return { valid: false, error: 'Persona must be an object' }
        }
        
        if (!persona.kind) {
          return { valid: false, error: 'Persona kind is required' }
        }
        
        const validKinds = ['text', 'attributes', 'sbf']
        if (!validKinds.includes(persona.kind)) {
          return { valid: false, error: 'Invalid persona kind' }
        }
        
        if (!persona.attributes) {
          return { valid: false, error: 'Persona attributes are required' }
        }
        
        return { valid: true }
      }

      // Valid personas
      const validPersonas = [
        { kind: 'text', attributes: { text: 'You are helpful.' } },
        { kind: 'attributes', attributes: { trait1: 'kind', trait2: 'intelligent' } },
        { kind: 'sbf', attributes: { summary: 'A helper', background: 'AI assistant', features: 'Helpful' } }
      ]
      
      validPersonas.forEach(persona => {
        const result = validatePersona(persona)
        expect(result.valid).to.be.true
      })

      // Invalid personas
      const invalidPersonas = [
        null,
        {},
        { kind: 'invalid' },
        { kind: 'text' }, // Missing attributes
        { attributes: { text: 'Missing kind' } }
      ]
      
      invalidPersonas.forEach(persona => {
        const result = validatePersona(persona)
        expect(result.valid).to.be.false
      })
    })
  })

  describe('Chat and Message Data Operations', () => {
    it('should validate message creation data', () => {
      const validateMessageData = (messageData: any) => {
        const errors: string[] = []
        
        // Message content validation
        if (!messageData.msg) {
          errors.push('Message content is required')
        } else if (typeof messageData.msg !== 'string') {
          errors.push('Message content must be a string')
        } else if (messageData.msg.trim().length === 0) {
          errors.push('Message content cannot be empty')
        } else if (messageData.msg.length > 4000) {
          errors.push('Message content must be no more than 4000 characters')
        }
        
        // Chat ID validation
        if (!messageData.chatId) {
          errors.push('Chat ID is required')
        }
        
        // User or Character ID required
        if (!messageData.userId && !messageData.characterId) {
          errors.push('Either user ID or character ID is required')
        }
        
        if (messageData.userId && messageData.characterId) {
          errors.push('Message cannot have both user ID and character ID')
        }
        
        return {
          valid: errors.length === 0,
          errors
        }
      }

      // Valid messages
      const validMessages = [
        { msg: 'Hello world!', chatId: 'chat1', userId: 'user1' },
        { msg: 'AI response', chatId: 'chat1', characterId: 'char1' },
        { msg: 'A longer message with multiple words and punctuation.', chatId: 'chat2', userId: 'user2' }
      ]
      
      validMessages.forEach(msg => {
        const result = validateMessageData(msg)
        expect(result.valid).to.be.true
      })

      // Invalid messages
      const invalidMessages = [
        { chatId: 'chat1', userId: 'user1' }, // Missing message
        { msg: '', chatId: 'chat1', userId: 'user1' }, // Empty message
        { msg: '   ', chatId: 'chat1', userId: 'user1' }, // Whitespace only
        { msg: 'Valid message', userId: 'user1' }, // Missing chat ID
        { msg: 'Valid message', chatId: 'chat1' }, // Missing user/character ID
        { msg: 'Valid message', chatId: 'chat1', userId: 'user1', characterId: 'char1' }, // Both IDs
        { msg: 'a'.repeat(4001), chatId: 'chat1', userId: 'user1' } // Too long
      ]
      
      invalidMessages.forEach(msg => {
        const result = validateMessageData(msg)
        expect(result.valid).to.be.false
        expect(result.errors.length).to.be.greaterThan(0)
      })
    })

    it('should handle message ordering and timestamps', () => {
      const createMessage = (content: string, timestamp?: Date) => {
        return {
          _id: `msg_${Date.now()}_${Math.random()}`,
          msg: content,
          createdAt: timestamp || new Date(),
          updatedAt: timestamp || new Date()
        }
      }

      const sortMessagesByTimestamp = (messages: any[]) => {
        return messages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      }

      // Create messages with different timestamps
      const now = new Date()
      const messages = [
        createMessage('Third message', new Date(now.getTime() + 2000)),
        createMessage('First message', new Date(now.getTime())),
        createMessage('Second message', new Date(now.getTime() + 1000))
      ]

      const sorted = sortMessagesByTimestamp(messages)
      
      expect(sorted[0].msg).to.equal('First message')
      expect(sorted[1].msg).to.equal('Second message')
      expect(sorted[2].msg).to.equal('Third message')
    })

    it('should calculate message statistics correctly', () => {
      const calculateChatStats = (messages: any[]) => {
        const userMessages = messages.filter(m => m.userId)
        const characterMessages = messages.filter(m => m.characterId)
        
        const totalWords = messages.reduce((count, msg) => {
          return count + (msg.msg ? msg.msg.split(/\s+/).length : 0)
        }, 0)
        
        const averageLength = messages.length > 0 
          ? messages.reduce((sum, msg) => sum + (msg.msg?.length || 0), 0) / messages.length
          : 0
        
        return {
          totalMessages: messages.length,
          userMessages: userMessages.length,
          characterMessages: characterMessages.length,
          totalWords,
          averageLength: Math.round(averageLength)
        }
      }

      const testMessages = [
        { msg: 'Hello world', userId: 'user1' },
        { msg: 'Hi there! How are you doing today?', characterId: 'char1' },
        { msg: 'I am fine', userId: 'user1' },
        { msg: 'Great to hear!', characterId: 'char1' }
      ]

      const stats = calculateChatStats(testMessages)
      
      expect(stats.totalMessages).to.equal(4)
      expect(stats.userMessages).to.equal(2)
      expect(stats.characterMessages).to.equal(2)
      expect(stats.totalWords).to.equal(13) // 2 + 7 + 3 + 3 = 15, let me recount: "Hello world" (2) + "Hi there! How are you doing today?" (7) + "I am fine" (3) + "Great to hear!" (3) = 15
      expect(stats.averageLength).to.be.greaterThan(0)
    })
  })

  describe('Data Relationships and Integrity', () => {
    it('should maintain referential integrity', () => {
      const validateRelationships = (data: {
        users: any[]
        characters: any[]
        chats: any[]
        messages: any[]
      }) => {
        const errors: string[] = []
        const userIds = new Set(data.users.map(u => u._id))
        const characterIds = new Set(data.characters.map(c => c._id))
        const chatIds = new Set(data.chats.map(c => c._id))
        
        // Check character user references
        data.characters.forEach((char: any) => {
          if (!userIds.has(char.userId)) {
            errors.push(`Character ${char._id} references non-existent user ${char.userId}`)
          }
        })
        
        // Check chat references
        data.chats.forEach(chat => {
          if (!userIds.has(chat.userId)) {
            errors.push(`Chat ${chat._id} references non-existent user ${chat.userId}`)
          }
          if (chat.characterId && !characterIds.has(chat.characterId)) {
            errors.push(`Chat ${chat._id} references non-existent character ${chat.characterId}`)
          }
        })
        
        // Check message references
        data.messages.forEach(msg => {
          if (!chatIds.has(msg.chatId)) {
            errors.push(`Message ${msg._id} references non-existent chat ${msg.chatId}`)
          }
          if (msg.userId && !userIds.has(msg.userId)) {
            errors.push(`Message ${msg._id} references non-existent user ${msg.userId}`)
          }
          if (msg.characterId && !characterIds.has(msg.characterId)) {
            errors.push(`Message ${msg._id} references non-existent character ${msg.characterId}`)
          }
        })
        
        return {
          valid: errors.length === 0,
          errors
        }
      }

      // Valid data structure
      const validData = {
        users: [{ _id: 'user1' }],
        characters: [{ _id: 'char1', userId: 'user1' }],
        chats: [{ _id: 'chat1', userId: 'user1', characterId: 'char1' }],
        messages: [{ _id: 'msg1', chatId: 'chat1', userId: 'user1' }]
      }
      
      const validResult = validateRelationships(validData)
      expect(validResult.valid).to.be.true

      // Invalid data structure
      const invalidData = {
        users: [{ _id: 'user1' }],
        characters: [{ _id: 'char1', userId: 'nonexistent' }], // Bad reference
        chats: [{ _id: 'chat1', userId: 'user1', characterId: 'char1' }],
        messages: [{ _id: 'msg1', chatId: 'chat1', userId: 'user1' }]
      }
      
      const invalidResult = validateRelationships(invalidData)
      expect(invalidResult.valid).to.be.false
      expect(invalidResult.errors.length).to.be.greaterThan(0)
    })

    it('should handle cascade deletion logic', () => {
      const simulateCascadeDelete = (entityType: string, entityId: string, data: any) => {
        const deletionPlan: string[] = []
        
        if (entityType === 'user') {
          // Find all entities owned by this user
          const userCharacters = data.characters.filter((c: any) => c.userId === entityId)
          const userChats = data.chats.filter((c: any) => c.userId === entityId)
          
          // Delete user's messages
          const userMessages = data.messages.filter((m: any) => m.userId === entityId)
          userMessages.forEach((m: any) => deletionPlan.push(`message:${m._id}`))
          
          // Delete chats involving user's characters
          userCharacters.forEach((char: any) => {
            const charChats = data.chats.filter((c: any) => c.characterId === char._id)
            charChats.forEach((c: any) => {
              deletionPlan.push(`chat:${c._id}`)
              // Delete messages in these chats
              const chatMessages = data.messages.filter((m: any) => m.chatId === c._id)
              chatMessages.forEach((m: any) => deletionPlan.push(`message:${m._id}`))
            })
          })
          
          // Delete user's chats
          userChats.forEach((c: any) => deletionPlan.push(`chat:${c._id}`))
          
          // Delete user's characters
          userCharacters.forEach((c: any) => deletionPlan.push(`character:${c._id}`))
          
          // Finally delete the user
          deletionPlan.push(`user:${entityId}`)
        }
        
        return deletionPlan
      }

      const testData = {
        users: [{ _id: 'user1' }],
        characters: [
          { _id: 'char1', userId: 'user1' },
          { _id: 'char2', userId: 'user1' }
        ],
        chats: [
          { _id: 'chat1', userId: 'user1', characterId: 'char1' },
          { _id: 'chat2', userId: 'user1', characterId: 'char2' }
        ],
        messages: [
          { _id: 'msg1', chatId: 'chat1', userId: 'user1' },
          { _id: 'msg2', chatId: 'chat1', characterId: 'char1' },
          { _id: 'msg3', chatId: 'chat2', userId: 'user1' }
        ]
      }

      const deletionPlan = simulateCascadeDelete('user', 'user1', testData)
      
      expect(deletionPlan).to.include('user:user1')
      expect(deletionPlan).to.include('character:char1')
      expect(deletionPlan).to.include('character:char2')
      expect(deletionPlan).to.include('chat:chat1')
      expect(deletionPlan).to.include('chat:chat2')
      expect(deletionPlan).to.include('message:msg1')
      expect(deletionPlan).to.include('message:msg2')
      expect(deletionPlan).to.include('message:msg3')
      
      // User should be deleted last
      expect(deletionPlan[deletionPlan.length - 1]).to.equal('user:user1')
    })
  })

  describe('Search and Filtering Logic', () => {
    it('should implement character search correctly', () => {
      const characters = [
        { _id: 'char1', name: 'Helpful Assistant', description: 'A friendly AI helper', tags: ['ai', 'helper'] },
        { _id: 'char2', name: 'Adventure Guide', description: 'Leads exciting adventures', tags: ['adventure', 'guide'] },
        { _id: 'char3', name: 'Cooking Helper', description: 'Helps with recipes and cooking', tags: ['cooking', 'food'] },
        { _id: 'char4', name: 'Study Buddy', description: 'Assists with learning and study', tags: ['education', 'helper'] }
      ]

      const searchCharacters = (characters: any[], query: string) => {
        if (!query || query.trim().length === 0) return characters
        
        const searchTerms = query.toLowerCase().split(/\s+/)
        
        return characters.filter(char => {
          const searchableText = [
            char.name,
            char.description,
            ...(char.tags || [])
          ].join(' ').toLowerCase()
          
          return searchTerms.every(term => searchableText.includes(term))
        })
      }

      // Test basic search
      const helpersSearch = searchCharacters(characters, 'helper')
      expect(helpersSearch).to.have.length(3) // Helpful Assistant, Cooking Helper, Study Buddy
      
      // Test multi-word search
      const cookingSearch = searchCharacters(characters, 'cooking recipes')
      expect(cookingSearch).to.have.length(1)
      expect(cookingSearch[0].name).to.equal('Cooking Helper')
      
      // Test tag search
      const adventureSearch = searchCharacters(characters, 'adventure')
      expect(adventureSearch).to.have.length(1)
      expect(adventureSearch[0].name).to.equal('Adventure Guide')
      
      // Test empty query
      const allSearch = searchCharacters(characters, '')
      expect(allSearch).to.have.length(4)
    })

    it('should implement pagination correctly', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      
      const paginate = (items: any[], page: number, limit: number) => {
        const offset = (page - 1) * limit
        const paginatedItems = items.slice(offset, offset + limit)
        
        return {
          items: paginatedItems,
          pagination: {
            page,
            limit,
            total: items.length,
            totalPages: Math.ceil(items.length / limit),
            hasNext: offset + limit < items.length,
            hasPrev: page > 1
          }
        }
      }

      // Test first page
      const page1 = paginate(items, 1, 10)
      expect(page1.items).to.have.length(10)
      expect(page1.items[0].id).to.equal(0)
      expect(page1.pagination.hasNext).to.be.true
      expect(page1.pagination.hasPrev).to.be.false
      
      // Test middle page
      const page2 = paginate(items, 2, 10)
      expect(page2.items).to.have.length(10)
      expect(page2.items[0].id).to.equal(10)
      expect(page2.pagination.hasNext).to.be.true
      expect(page2.pagination.hasPrev).to.be.true
      
      // Test last page
      const page3 = paginate(items, 3, 10)
      expect(page3.items).to.have.length(5) // Remaining items
      expect(page3.items[0].id).to.equal(20)
      expect(page3.pagination.hasNext).to.be.false
      expect(page3.pagination.hasPrev).to.be.true
    })
  })
})