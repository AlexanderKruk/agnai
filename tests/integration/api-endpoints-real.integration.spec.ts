/**
 * Real API Endpoints Integration Tests
 * 
 * Tests actual API endpoints with real Express server and HTTP requests
 */

import { expect } from 'chai'
import request from 'supertest'
import { createApp } from '../../srv/app'
import { setupTestEnvironment, teardownTestEnvironment, TEST_FIXTURES } from './test-setup'
import { MockUtils } from './mocks/agnai-api-mock'
import { connect } from '../../srv/db/client'

describe('Real API Endpoints Integration Tests', () => {
  let app: any
  let server: any
  let authToken: string
  let testUser: any

  before(async () => {
    // Set up test environment
    await setupTestEnvironment()
    
    // Initialize database connection
    await connect()
    
    // Create real Express app for testing
    const { app: expressApp, server: httpServer } = createApp()
    app = expressApp
    server = httpServer
    
    // Start server on random port for testing
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        resolve()
      })
    })
  })

  after(async () => {
    // Clean up server and environment
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
    await teardownTestEnvironment()
  })

  beforeEach(async () => {
    MockUtils.reset()
  })

  describe('Authentication API Endpoints', () => {
    describe('POST /api/user/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          username: `testuser_${Date.now()}`,
          password: 'securepass123',
          handle: 'Test User'
        }

        const response = await request(app)
          .post('/api/user/register')
          .send(userData)
          .expect(200)

        expect(response.body).to.have.property('user')
        expect(response.body.user).to.have.property('username', userData.username)
        expect(response.body.user).to.not.have.property('password') // Should be filtered out
        expect(response.body).to.have.property('token')
        expect(response.body.token).to.be.a('string')
        expect(response.body).to.have.property('profile')
        expect(response.body.profile).to.have.property('handle', userData.handle)

        // Store for other tests
        testUser = response.body.user
        authToken = response.body.token
      })

      it('should reject invalid registration data', async () => {
        const invalidData = [
          { username: 'ab', password: 'password123' }, // Username too short
          { username: 'validuser', password: 'short' }, // Password too short
          { password: 'password123' }, // Missing username
          { username: 'validuser' }, // Missing password
        ]

        for (const data of invalidData) {
          await request(app)
            .post('/api/user/register')
            .send(data)
            .expect(500) // Validation errors return 500 in this API
        }
      })

      it('should prevent duplicate usernames', async () => {
        const userData = {
          username: 'testuser123', // Same as above
          password: 'password123',
          handle: 'Duplicate User'
        }

        await request(app)
          .post('/api/user/register')
          .send(userData)
          .expect(400)
      })
    })

    describe('POST /api/user/login', () => {
      it('should login with valid credentials', async () => {
        const credentials = {
          username: testUser.username,
          password: 'securepass123'
        }

        const response = await request(app)
          .post('/api/user/login')
          .send(credentials)
          .expect(200)

        expect(response.body).to.have.property('user')
        expect(response.body.user.username).to.equal(credentials.username)
        expect(response.body).to.have.property('token')
        expect(response.body.token).to.be.a('string')

        // Update auth token for other tests
        authToken = response.body.token
      })

      it('should reject invalid credentials', async () => {
        const invalidCredentials = [
          { username: 'testuser123', password: 'wrongpassword' },
          { username: 'nonexistentuser', password: 'password123' },
          { username: '', password: 'password123' },
          { username: 'testuser123', password: '' },
        ]

        for (const creds of invalidCredentials) {
          await request(app)
            .post('/api/user/login')
            .send(creds)
            .expect(401)
        }
      })
    })
  })

  describe('Character Management API Endpoints', () => {
    describe('POST /api/character', () => {
      it('should create a new character', async () => {
        const characterData = {
          name: 'Test Character',
          description: 'A character for API testing',
          persona: JSON.stringify({
            kind: 'text',
            attributes: {
              text: 'You are a helpful AI assistant for testing purposes.'
            }
          }),
          scenario: 'You are in a test environment.',
          greeting: 'Hello! I am a test character.',
          sampleChat: 'User: Hi\nCharacter: Hello there!'
        }

        const response = await request(app)
          .post('/api/character')
          .set('Authorization', `Bearer ${authToken}`)
          .send(characterData)
          .expect(200)

        expect(response.body).to.have.property('_id')
        expect(response.body).to.have.property('name', characterData.name)
        expect(response.body).to.have.property('description', characterData.description)
        expect(response.body).to.have.property('userId', testUser._id)
        expect(response.body).to.have.property('persona')
        
        const expectedPersona = JSON.parse(characterData.persona)
        expect(response.body.persona.attributes.text).to.equal(expectedPersona.attributes.text)

        // Store character ID for other tests
        testUser.characterId = response.body._id
      })

      it('should require authentication', async () => {
        const characterData = {
          name: 'Unauthorized Character',
          description: 'Should not be created'
        }

        await request(app)
          .post('/api/character')
          .send(characterData)
          .expect(401)
      })

      it('should validate character data', async () => {
        const invalidCharacters = [
          {}, // Missing required fields
          { name: 'Valid Name' }, // Missing description
          { description: 'Valid description' }, // Missing name
          { name: '', description: 'Valid description' }, // Empty name
          { name: 'a'.repeat(100), description: 'Valid description' }, // Name too long
        ]

        for (const invalidChar of invalidCharacters) {
          await request(app)
            .post('/api/character')
            .set('Authorization', `Bearer ${authToken}`)
            .send(invalidChar)
            .expect(400)
        }
      })
    })

    describe('GET /api/character', () => {
      before(async () => {
        // Create additional characters for testing
        const characters = [
          { name: 'Character 1', description: 'First test character' },
          { name: 'Character 2', description: 'Second test character' },
          { name: 'Character 3', description: 'Third test character' }
        ]

        for (const char of characters) {
          await request(app)
            .post('/api/character')
            .set('Authorization', `Bearer ${authToken}`)
            .send(char)
        }
      })

      it('should list user characters', async () => {
        const response = await request(app)
          .get('/api/character')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body).to.have.property('characters')
        expect(response.body.characters).to.be.an('array')
        expect(response.body.characters.length).to.be.greaterThan(3)

        // All characters should belong to the authenticated user
        response.body.characters.forEach((char: any) => {
          expect(char.userId).to.equal(testUser._id)
        })
      })

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/character?limit=2&page=1')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body).to.have.property('characters')
        expect(response.body.characters).to.have.length(2)
        expect(response.body).to.have.property('pagination')
        expect(response.body.pagination).to.have.property('page', 1)
        expect(response.body.pagination).to.have.property('limit', 2)
      })

      it('should require authentication', async () => {
        await request(app)
          .get('/api/character')
          .expect(401)
      })
    })

    describe('GET /api/character/:id', () => {
      it('should retrieve specific character', async () => {
        const response = await request(app)
          .get(`/api/character/${testUser.characterId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body).to.have.property('_id', testUser.characterId)
        expect(response.body).to.have.property('name')
        expect(response.body).to.have.property('userId', testUser._id)
      })

      it('should return 404 for non-existent character', async () => {
        await request(app)
          .get('/api/character/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)
      })

      it('should require authentication', async () => {
        await request(app)
          .get(`/api/character/${testUser.characterId}`)
          .expect(401)
      })
    })

    describe('PUT /api/character/:id', () => {
      it('should update character properties', async () => {
        const updateData = {
          name: 'Updated Character Name',
          description: 'Updated character description'
        }

        const response = await request(app)
          .put(`/api/character/${testUser.characterId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200)

        expect(response.body).to.have.property('name', updateData.name)
        expect(response.body).to.have.property('description', updateData.description)
      })

      it('should validate update data', async () => {
        const invalidUpdates = [
          { name: '' }, // Empty name
          { name: 'a'.repeat(100) }, // Name too long
        ]

        for (const invalidUpdate of invalidUpdates) {
          await request(app)
            .put(`/api/character/${testUser.characterId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(invalidUpdate)
            .expect(400)
        }
      })

      it('should require authentication', async () => {
        await request(app)
          .put(`/api/character/${testUser.characterId}`)
          .send({ name: 'Unauthorized Update' })
          .expect(401)
      })
    })
  })

  describe('Chat Management API Endpoints', () => {
    let testChatId: string

    describe('POST /api/chat', () => {
      it('should create a new chat', async () => {
        const chatData = {
          name: 'Test Chat',
          characterId: testUser.characterId,
          mode: 'chat'
        }

        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send(chatData)
          .expect(200)

        expect(response.body).to.have.property('_id')
        expect(response.body).to.have.property('name', chatData.name)
        expect(response.body).to.have.property('userId', testUser._id)
        expect(response.body).to.have.property('characterId', testUser.characterId)

        testChatId = response.body._id
      })

      it('should require authentication', async () => {
        await request(app)
          .post('/api/chat')
          .send({ name: 'Unauthorized Chat' })
          .expect(401)
      })

      it('should validate chat data', async () => {
        const invalidChats = [
          {}, // Missing required fields
          { characterId: testUser.characterId }, // Missing name
          { name: 'Valid Chat' }, // Missing characterId
          { name: '', characterId: testUser.characterId }, // Empty name
        ]

        for (const invalidChat of invalidChats) {
          await request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${authToken}`)
            .send(invalidChat)
            .expect(400)
        }
      })
    })

    describe('GET /api/chat/:id', () => {
      it('should retrieve chat with messages', async () => {
        const response = await request(app)
          .get(`/api/chat/${testChatId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body).to.have.property('_id', testChatId)
        expect(response.body).to.have.property('name')
        expect(response.body).to.have.property('userId', testUser._id)
        expect(response.body).to.have.property('messages')
        expect(response.body.messages).to.be.an('array')
      })

      it('should return 404 for non-existent chat', async () => {
        await request(app)
          .get('/api/chat/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)
      })

      it('should require authentication', async () => {
        await request(app)
          .get(`/api/chat/${testChatId}`)
          .expect(401)
      })
    })

    describe('PUT /api/chat/:id', () => {
      it('should update chat properties', async () => {
        const updateData = {
          name: 'Updated Chat Name',
          mode: 'adventure'
        }

        const response = await request(app)
          .put(`/api/chat/${testChatId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200)

        expect(response.body).to.have.property('name', updateData.name)
        expect(response.body).to.have.property('mode', updateData.mode)
      })

      it('should require authentication', async () => {
        await request(app)
          .put(`/api/chat/${testChatId}`)
          .send({ name: 'Unauthorized Update' })
          .expect(401)
      })
    })

    describe('POST /api/chat/:id/message - Chat Generation Pipeline', () => {
      beforeEach(() => {
        // Set up mock AI response for each test
        MockUtils.setupSuccessScenario('Hello! This is a test AI response.')
      })

      it('should create user message and generate AI response', async () => {
        const messageData = {
          message: 'Hello, test character!',
          characterId: testUser.characterId
        }

        const response = await request(app)
          .post(`/api/chat/${testChatId}/message`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(messageData)
          .expect(200)

        // Verify user message was created
        expect(response.body).to.have.property('message')
        expect(response.body.message.msg).to.equal(messageData.message)
        expect(response.body.message.userId).to.equal(testUser._id)
        expect(response.body.message.chatId).to.equal(testChatId)

        // Verify AI response was generated
        expect(response.body).to.have.property('response')
        expect(response.body.response.msg).to.include('test AI response')
        expect(response.body.response.characterId).to.equal(testUser.characterId)

        // Verify API was called
        expect(MockUtils.wasApiCalled()).to.be.true
      })

      it('should handle AI service errors gracefully', async () => {
        MockUtils.setupErrorScenario('serverError')

        const messageData = {
          message: 'This should trigger an AI error',
          characterId: testUser.characterId
        }

        const response = await request(app)
          .post(`/api/chat/${testChatId}/message`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(messageData)
          .expect(500)

        expect(response.body).to.have.property('error')
        expect(MockUtils.wasApiCalled()).to.be.true
      })

      it('should validate message data', async () => {
        const invalidMessages = [
          {}, // Missing required fields
          { characterId: testUser.characterId }, // Missing message
          { message: 'Valid message' }, // Missing characterId
          { message: '', characterId: testUser.characterId }, // Empty message
          { message: 'a'.repeat(5000), characterId: testUser.characterId }, // Too long
        ]

        for (const invalidMsg of invalidMessages) {
          await request(app)
            .post(`/api/chat/${testChatId}/message`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(invalidMsg)
            .expect(400)
        }
      })

      it('should require authentication', async () => {
        await request(app)
          .post(`/api/chat/${testChatId}/message`)
          .send({ message: 'Unauthorized message', characterId: testUser.characterId })
          .expect(401)
      })

      it('should handle streaming responses', async () => {
        MockUtils.setupSuccessScenario('Streaming response content')

        const messageData = {
          message: 'Test streaming response',
          characterId: testUser.characterId,
          stream: true
        }

        const response = await request(app)
          .post(`/api/chat/${testChatId}/message`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(messageData)
          .expect(200)

        expect(response.body.response.msg).to.include('Streaming response')
      })
    })

    describe('DELETE /api/chat/:id', () => {
      it('should delete chat and associated data', async () => {
        // First, add a message to the chat
        await request(app)
          .post(`/api/chat/${testChatId}/message`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'Message to be deleted with chat',
            characterId: testUser.characterId
          })

        // Delete the chat
        await request(app)
          .delete(`/api/chat/${testChatId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        // Verify chat is gone
        await request(app)
          .get(`/api/chat/${testChatId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)
      })

      it('should require authentication', async () => {
        // Create a new chat for this test
        const chatResponse = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Chat to delete unauthorized',
            characterId: testUser.characterId
          })

        await request(app)
          .delete(`/api/chat/${chatResponse.body._id}`)
          .expect(401)
      })
    })
  })

  describe('User Profile API Endpoints', () => {
    describe('GET /api/user', () => {
      it('should retrieve user profile', async () => {
        const response = await request(app)
          .get('/api/user')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body).to.have.property('_id', testUser._id)
        expect(response.body).to.have.property('username')
        expect(response.body).to.not.have.property('password') // Should be filtered
      })

      it('should require authentication', async () => {
        await request(app)
          .get('/api/user')
          .expect(401)
      })
    })

    describe('POST /api/user/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          handle: 'Updated Handle',
          avatar: 'new-avatar-url.jpg'
        }

        const response = await request(app)
          .post('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200)

        expect(response.body.profile).to.have.property('handle', updateData.handle)
        expect(response.body.profile).to.have.property('avatar', updateData.avatar)
      })

      it('should validate profile data', async () => {
        const invalidUpdates = [
          { handle: '' }, // Empty handle
          { handle: 'a'.repeat(100) }, // Handle too long
        ]

        for (const invalidUpdate of invalidUpdates) {
          await request(app)
            .post('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send(invalidUpdate)
            .expect(400)
        }
      })

      it('should require authentication', async () => {
        await request(app)
          .post('/api/user/profile')
          .send({ handle: 'Unauthorized Update' })
          .expect(401)
      })
    })
  })

  describe('Error Handling and Security', () => {
    it('should handle malformed JSON requests', async () => {
      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400)
    })

    it('should handle invalid authorization tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'Bearer ',
        ''
      ]

      for (const token of invalidTokens) {
        await request(app)
          .get('/api/user')
          .set('Authorization', token)
          .expect(401)
      }
    })

    it('should sanitize HTML in character data', async () => {
      const characterData = {
        name: 'XSS Test Character',
        description: '<script>alert("xss")</script>Safe description',
        greeting: '<img src="x" onerror="alert(1)">Hello!'
      }

      const response = await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)
        .expect(200)

      // HTML should be sanitized
      expect(response.body.description).to.not.include('<script>')
      expect(response.body.description).to.include('Safe description')
      expect(response.body.greeting).to.not.include('onerror')
      expect(response.body.greeting).to.include('Hello!')
    })

    it('should handle rate limiting', async () => {
      // Make many rapid requests to trigger rate limiting
      const requests = []
      for (let i = 0; i < 20; i++) {
        const request_promise = request(app)
          .get('/api/user')
          .set('Authorization', `Bearer ${authToken}`)
        requests.push(request_promise)
      }

      const responses = await Promise.allSettled(requests)
      
      // Some requests should be rate limited
      const rateLimited = responses.some(r => 
        r.status === 'fulfilled' && (r.value as any).status === 429
      )
      expect(rateLimited).to.be.true
    })

    it('should prevent SQL injection in search', async () => {
      const maliciousSearch = "'; DROP TABLE characters; --"

      const response = await request(app)
        .get(`/api/character?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      // Should not crash and return safe results
      expect(response.body.characters).to.be.an('array')
    })
  })
})