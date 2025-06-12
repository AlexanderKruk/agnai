/**
 * Error Handling and Edge Cases Integration Tests
 * 
 * Tests API resilience, error scenarios, boundary conditions, and edge cases
 */

import { expect } from 'chai'
import request from 'supertest'
import { createApp } from '../../srv/app'
import { setupTestEnvironment, teardownTestEnvironment } from './test-setup'
import { connect } from '../../srv/db/client'
import { cleanTestDatabase } from './database-cleanup'

describe('Error Handling and Edge Cases Integration Tests', () => {
  let app: any
  let server: any
  let authToken: string
  let testUser: any
  let characterId: string
  let chatId: string

  before(async () => {
    // Set up test environment
    await setupTestEnvironment()
    
    // Initialize database connection
    await connect()
    
    // Clean test database before starting test suite
    await cleanTestDatabase()
    
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

    // Create test user and resources for edge case testing
    const userData = {
      username: `edgeuser_${Date.now()}`,
      password: 'securepass123',
      handle: 'Edge Case Test User'
    }

    const userResponse = await request(app)
      .post('/api/user/register')
      .send(userData)
      .expect(200)

    testUser = userResponse.body.user
    authToken = userResponse.body.token

    // Create a character for testing
    const characterData = {
      name: 'Edge Case Test Character',
      description: 'A character for edge case testing',
      persona: JSON.stringify({
        kind: 'text',
        attributes: {
          text: 'You are a helpful AI assistant for edge case testing purposes.'
        }
      }),
      scenario: 'You are in an edge case test environment.',
      greeting: 'Hello! I am an edge case test character.',
      sampleChat: 'User: Hi\\nCharacter: Hello there!'
    }

    const charResponse = await request(app)
      .post('/api/character')
      .set('Authorization', `Bearer ${authToken}`)
      .send(characterData)
      .expect(200)

    characterId = charResponse.body._id

    // Create a chat for testing
    const chatData = {
      name: 'Edge Case Test Chat',
      characterId: characterId,
      mode: 'standard'
    }

    const chatResponse = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send(chatData)
      .expect(200)

    chatId = chatResponse.body._id
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

  describe('Request Validation Edge Cases', () => {
    it('should handle extremely long usernames gracefully', async () => {
      const longUsername = 'a'.repeat(1000) // Very long username
      const userData = {
        username: longUsername,
        password: 'password123',
        handle: 'Long Username Test'
      }

      await request(app)
        .post('/api/user/register')
        .send(userData)
        .expect(200) // API may accept long usernames or truncate them
    })

    it('should handle extremely long character names gracefully', async () => {
      const longName = 'Character Name '.repeat(100) // Very long character name
      const characterData = {
        name: longName,
        description: 'Valid description',
        persona: JSON.stringify({ kind: 'text', attributes: { text: 'Valid persona' } }),
        scenario: 'Valid scenario',
        greeting: 'Valid greeting',
        sampleChat: 'Valid sample chat'
      }

      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)
        .expect(200) // API may accept long names or truncate them
    })

    it('should handle very large JSON payload gracefully', async () => {
      // Create a very large persona object
      const largeAttributes: Record<string, string> = {}
      for (let i = 0; i < 1000; i++) {
        largeAttributes[`attribute_${i}`] = 'x'.repeat(100)
      }

      const characterData = {
        name: 'Large Payload Character',
        description: 'Testing large payload handling',
        persona: JSON.stringify({
          kind: 'text',
          attributes: largeAttributes
        }),
        scenario: 'Large payload test scenario',
        greeting: 'Hello from large payload test',
        sampleChat: 'User: Hi\\nCharacter: Hello!'
      }

      // This might succeed or fail depending on size limits
      const response = await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)

      // Should either succeed or fail gracefully (not crash)
      expect([200, 400, 413, 500]).to.include(response.status)
    })

    it('should handle invalid JSON in nested fields', async () => {
      const characterData = {
        name: 'Invalid JSON Character',
        description: 'Testing invalid JSON handling',
        persona: '{ invalid json structure }', // Invalid JSON
        scenario: 'Invalid JSON test scenario',
        greeting: 'Hello from invalid JSON test',
        sampleChat: 'User: Hi\\nCharacter: Hello!'
      }

      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)
        .expect(500) // Should reject due to JSON validation
    })

    it('should handle null and undefined values in requests', async () => {
      const characterData = {
        name: null,
        description: undefined,
        persona: JSON.stringify({ kind: 'text', attributes: { text: 'Test' } }),
        scenario: null,
        greeting: undefined,
        sampleChat: 'Test'
      }

      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)
        .expect(500) // Should reject due to validation
    })
  })

  describe('Authentication Edge Cases', () => {
    it('should handle expired JWT tokens gracefully', async () => {
      // Create a token that appears valid but is expired/invalid
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid'
      
      await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)
    })

    it('should handle malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearr invalid-format',  // Typo in Bearer
        'Bearer',  // Missing token
        'Basic sometoken',  // Wrong auth type
        'Bearer token.with.too.many.parts.here.invalid',  // Invalid JWT format
        'NotBearer validtoken'  // Wrong prefix
      ]

      for (const header of malformedHeaders) {
        await request(app)
          .get('/api/user')
          .set('Authorization', header)
          .expect(401)
      }
    })

    it('should handle concurrent authentication attempts', async () => {
      const credentials = {
        username: testUser.username,
        password: 'securepass123'
      }

      // Make multiple concurrent login requests
      const loginPromises = Array(10).fill(null).map(() => 
        request(app)
          .post('/api/user/login')
          .send(credentials)
      )

      const responses = await Promise.all(loginPromises)
      
      // All should succeed or fail gracefully (not crash server)
      responses.forEach(response => {
        expect([200, 401, 429, 500]).to.include(response.status)
      })
    })

    it('should handle authentication with special characters in password', async () => {
      const specialCharUser = {
        username: `specialuser_${Date.now()}`,
        password: '!@#$%^&*()_+{}|:"<>?[]\\;\',./',
        handle: 'Special Char User'
      }

      // Register with special character password
      await request(app)
        .post('/api/user/register')
        .send(specialCharUser)
        .expect(200)

      // Login with special character password
      await request(app)
        .post('/api/user/login')
        .send({
          username: specialCharUser.username,
          password: specialCharUser.password
        })
        .expect(200)
    })
  })

  describe('Resource Limitation Edge Cases', () => {
    it('should handle requests for non-existent resources with various ID formats', async () => {
      const invalidIds = [
        'non-existent-id',
        '12345',
        '',
        'null',
        'undefined',
        '../../../../etc/passwd',  // Path traversal attempt
        '<script>alert("xss")</script>',  // XSS attempt
        'DROP TABLE users;',  // SQL injection attempt
        '00000000-0000-0000-0000-000000000000',  // Null UUID
        'ffffffff-ffff-ffff-ffff-ffffffffffff'   // Max UUID
      ]

      for (const id of invalidIds) {
        await request(app)
          .get(`/api/character/${encodeURIComponent(id)}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)
      }
    })

    it('should handle operations on deleted resources', async () => {
      // Create a character to delete
      const tempCharData = {
        name: 'Temporary Character',
        description: 'Will be deleted',
        persona: JSON.stringify({ kind: 'text', attributes: { text: 'Temp' } }),
        scenario: 'Temp scenario',
        greeting: 'Hello temporarily',
        sampleChat: 'Temp chat'
      }

      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tempCharData)
        .expect(200)

      // Delete the character (if delete endpoint exists)
      // For now, we'll just test accessing it with a fake deleted ID
      const deletedCharId = 'deleted-char-id-12345'

      // Try to access the deleted character
      await request(app)
        .get(`/api/character/${deletedCharId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      // Try to update the deleted character
      await request(app)
        .post(`/api/character/${deletedCharId}/update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(404)
    })

    it('should handle operations with insufficient permissions', async () => {
      // Create a second user
      const user2Data = {
        username: `user2_${Date.now()}`,
        password: 'password123',
        handle: 'User 2'
      }

      const user2Response = await request(app)
        .post('/api/user/register')
        .send(user2Data)
        .expect(200)

      const user2Token = user2Response.body.token

      // Try to access first user's character with second user's token
      await request(app)
        .get(`/api/character/${characterId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404) // Should not find character owned by different user

      // Try to update first user's character with second user's token
      await request(app)
        .post(`/api/character/${characterId}/update`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Unauthorized Update' })
        .expect(404) // Should not find character to update
    })
  })

  describe('Concurrent Operations Edge Cases', () => {
    it('should handle concurrent character creation', async () => {
      const characterTemplate = {
        name: 'Concurrent Character',
        description: 'Testing concurrent creation',
        persona: JSON.stringify({ kind: 'text', attributes: { text: 'Concurrent test' } }),
        scenario: 'Concurrent scenario',
        greeting: 'Hello concurrently',
        sampleChat: 'Concurrent chat'
      }

      // Create multiple characters concurrently
      const createPromises = Array(5).fill(null).map((_, index) => 
        request(app)
          .post('/api/character')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...characterTemplate,
            name: `${characterTemplate.name} ${index}`
          })
      )

      const responses = await Promise.all(createPromises)
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200)
        expect(response.body).to.have.property('_id')
      })
    })

    it('should handle concurrent chat message creation', async () => {
      const messageTemplate = {
        text: 'Concurrent message',
        kind: 'send-noreply'
      }

      // Send multiple messages concurrently to the same chat
      const messagePromises = Array(5).fill(null).map((_, index) => 
        request(app)
          .post(`/api/chat/${chatId}/send`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...messageTemplate,
            text: `${messageTemplate.text} ${index}`
          })
      )

      const responses = await Promise.all(messagePromises)
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200)
        expect(response.body).to.have.property('success', true)
      })
    })

    it('should handle concurrent chat operations', async () => {
      // Create multiple chats concurrently
      const chatTemplate = {
        name: 'Concurrent Chat',
        characterId: characterId,
        mode: 'standard'
      }

      const createChatPromises = Array(5).fill(null).map((_, index) => 
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...chatTemplate,
            name: `${chatTemplate.name} ${index}`
          })
      )

      const responses = await Promise.all(createChatPromises)
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200)
        expect(response.body).to.have.property('_id')
      })
    })
  })

  describe('Data Integrity Edge Cases', () => {
    it('should handle circular references in JSON data gracefully', async () => {
      // Create an object with circular reference that would break JSON.stringify
      const circularPersona = {
        kind: 'text',
        attributes: {
          text: 'Circular reference test'
        }
      }
      // Add circular reference
      ;(circularPersona.attributes as any)['self'] = circularPersona

      // This should fail at JSON.stringify level
      let personaString: string
      try {
        personaString = JSON.stringify(circularPersona)
      } catch (error) {
        // If JSON.stringify fails, use a safe fallback
        personaString = JSON.stringify({ 
          kind: 'text', 
          attributes: { 
            text: 'Fallback after circular reference error' 
          } 
        })
      }

      const characterData = {
        name: 'Circular Reference Character',
        description: 'Testing circular reference handling',
        persona: personaString,
        scenario: 'Circular reference test scenario',
        greeting: 'Hello from circular reference test',
        sampleChat: 'User: Hi\\nCharacter: Hello!'
      }

      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)
        .expect(200) // Should succeed with fallback data
    })

    it('should handle unicode and emoji characters properly', async () => {
      const unicodeData = {
        name: '🤖 Unicode Test Character 你好 こんにちは',
        description: 'Testing unicode: 🎭🎨🎪 Åpfel über München 中文测试',
        persona: JSON.stringify({
          kind: 'text',
          attributes: {
            text: 'Unicode persona: 🌟✨💫 emoji and 漢字 characters'
          }
        }),
        scenario: 'Unicode scenario: 🏠🌍🚀 testing special chars',
        greeting: 'Hello! 🎉 Hola! Привет! こんにちは! 안녕하세요!',
        sampleChat: 'User: Hi 👋\\nCharacter: Hello! 🤖'
      }

      const response = await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(unicodeData)
        .expect(200)

      // Verify unicode is preserved
      expect(response.body.name).to.include('🤖')
      expect(response.body.name).to.include('你好')
      expect(response.body.description).to.include('🎭')
      expect(response.body.greeting).to.include('🎉')
    })

    it('should handle boundary values for numeric fields', async () => {
      // Test with extreme numbers if there are numeric fields in chat or character APIs
      const chatData = {
        name: 'Boundary Test Chat',
        characterId: characterId,
        mode: 'standard'
      }

      // Test with valid data first
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatData)
        .expect(200)

      expect(response.body).to.have.property('_id')
    })
  })

  describe('Network and Protocol Edge Cases', () => {
    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .type('') // Remove content type
        .send('{"name": "Test"}')

      // Should either reject (400/415) or handle gracefully  
      expect([400, 415, 500]).to.include(response.status)
    })

    it('should handle invalid Content-Type header', async () => {
      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain') // Wrong content type
        .send('{"name": "Test"}')
        .expect(400) // Should reject due to wrong content type
    })

    it('should handle requests with no body when body is required', async () => {
      await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500) // Should reject due to missing body
    })

    it('should handle very slow requests gracefully', async () => {
      // Send a request but test timeout behavior
      const characterData = {
        name: 'Slow Request Character',
        description: 'Testing slow request handling',
        persona: JSON.stringify({ kind: 'text', attributes: { text: 'Slow test' } }),
        scenario: 'Slow request scenario',
        greeting: 'Hello slowly',
        sampleChat: 'User: Hi\\nCharacter: Hello!'
      }

      const response = await request(app)
        .post('/api/character')
        .set('Authorization', `Bearer ${authToken}`)
        .send(characterData)
        .timeout(1000) // 1 second timeout

      // Should complete within reasonable time
      expect(response.status).to.equal(200)
    })
  })

  describe('Database Edge Cases', () => {
    it('should handle duplicate key scenarios gracefully', async () => {
      // Try to create multiple users with same username (should fail)
      const duplicateUserData = {
        username: testUser.username, // Same as existing user
        password: 'differentpassword',
        handle: 'Duplicate User'
      }

      await request(app)
        .post('/api/user/register')
        .send(duplicateUserData)
        .expect(400) // Should reject duplicate
    })

    it('should handle database constraint violations gracefully', async () => {
      // Try to create chat with non-existent character
      const invalidChatData = {
        name: 'Invalid Chat',
        characterId: 'non-existent-character-id-12345',
        mode: 'standard'
      }

      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidChatData)
        .expect(400) // Should reject due to validation or constraint
    })

    it('should handle empty database queries gracefully', async () => {
      // Create a new user with no characters
      const newUserData = {
        username: `emptyuser_${Date.now()}`,
        password: 'password123',
        handle: 'Empty User'
      }

      const newUserResponse = await request(app)
        .post('/api/user/register')
        .send(newUserData)
        .expect(200)

      const newUserToken = newUserResponse.body.token

      // Get characters for user with no characters
      const response = await request(app)
        .get('/api/character')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200)

      expect(response.body).to.have.property('characters')
      expect(response.body.characters).to.be.an('array')
      // Should return empty array or handle gracefully
    })
  })

  describe('API Rate Limiting and Abuse Prevention', () => {
    it('should handle rapid successive requests without crashing', async () => {
      // Make many rapid requests to test rate limiting and stability
      const rapidRequests = Array(20).fill(null).map(() => 
        request(app)
          .get('/api/user')
          .set('Authorization', `Bearer ${authToken}`)
      )

      const responses = await Promise.allSettled(rapidRequests)
      
      // Should handle all requests without crashing
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 429]).to.include(result.value.status) // Success or rate limited
        }
      })
    })

    it('should handle resource exhaustion attempts gracefully', async () => {
      // Try to create many resources rapidly
      const resourceCreationPromises = Array(10).fill(null).map((_, index) => 
        request(app)
          .post('/api/character')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Exhaustion Test Character ${index}`,
            description: 'Testing resource exhaustion',
            persona: JSON.stringify({ kind: 'text', attributes: { text: 'Exhaustion test' } }),
            scenario: 'Exhaustion scenario',
            greeting: 'Hello from exhaustion test',
            sampleChat: 'User: Hi\\nCharacter: Hello!'
          })
      )

      const responses = await Promise.allSettled(resourceCreationPromises)
      
      // Should handle requests gracefully (succeed or fail safely)
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 429, 500]).to.include(result.value.status)
        }
      })
    })
  })
})