/**
 * API Performance Tests
 * 
 * Tests API endpoint performance under load with mocked AI responses
 */

import { expect } from 'chai'
import request from 'supertest'
import { createApp } from '../../srv/app'
import { setupTestEnvironment, teardownTestEnvironment } from '../integration/test-setup'
import { connect } from '../../srv/db/client'
import { cleanTestDatabase } from '../integration/database-cleanup'
import { mockAIService, PerformanceTestUtils } from './ai-mock-performance'

describe('API Performance Tests', () => {
  let app: any
  let server: any
  let authToken: string
  let testUser: any
  let characterId: string
  let chatId: string

  before(async function() {
    // Increase timeout for performance tests
    this.timeout(60000)

    await setupTestEnvironment()
    await connect()
    await cleanTestDatabase()

    const { app: expressApp, server: httpServer } = createApp()
    app = expressApp
    server = httpServer

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    // Create test user and resources
    const userData = {
      username: `perfuser_${Date.now()}`,
      password: 'securepass123',
      handle: 'Performance Test User'
    }

    const userResponse = await request(app)
      .post('/api/user/register')
      .send(userData)
      .expect(200)

    testUser = userResponse.body.user
    authToken = userResponse.body.token

    // Create test character
    const characterData = {
      name: 'Performance Test Character',
      description: 'A character for performance testing',
      persona: JSON.stringify({
        kind: 'text',
        attributes: {
          text: 'You are a helpful AI assistant for performance testing.'
        }
      }),
      scenario: 'Performance testing environment',
      greeting: 'Hello! Ready for performance testing.',
      sampleChat: 'User: Hi\nCharacter: Hello there!'
    }

    const charResponse = await request(app)
      .post('/api/character')
      .set('Authorization', `Bearer ${authToken}`)
      .send(characterData)
      .expect(200)

    characterId = charResponse.body._id

    // Create test chat
    const chatData = {
      name: 'Performance Test Chat',
      characterId: characterId,
      mode: 'standard'
    }

    const chatResponse = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send(chatData)
      .expect(200)

    chatId = chatResponse.body._id

    // Reset AI service metrics for clean testing
    mockAIService.resetMetrics()
  })

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
    await teardownTestEnvironment()
  })

  describe('Authentication Performance', () => {
    it('should handle rapid login attempts efficiently', async function() {
      this.timeout(30000)

      const credentials = {
        username: testUser.username,
        password: 'securepass123'
      }

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const response = await request(app)
            .post('/api/user/login')
            .send(credentials)
          
          expect(response.status).to.equal(200)
          expect(response.body).to.have.property('token')
          return response.body
        },
        5, // 5 concurrent requests
        25, // 25 total requests
        'Authentication Load Test'
      )

      // Performance assertions
      expect(metrics.averageResponseTime).to.be.below(1000) // < 1 second average
      expect(metrics.requestsPerSecond).to.be.above(5) // > 5 requests/sec
      expect(metrics.successCount).to.equal(25) // 100% success rate
    })

    it('should validate JWT tokens efficiently under load', async function() {
      this.timeout(30000)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const response = await request(app)
            .get('/api/user')
            .set('Authorization', `Bearer ${authToken}`)
          
          expect(response.status).to.equal(200)
          return response.body
        },
        10, // 10 concurrent requests
        50, // 50 total requests
        'JWT Validation Load Test'
      )

      expect(metrics.averageResponseTime).to.be.below(500) // < 500ms average
      expect(metrics.requestsPerSecond).to.be.above(20) // > 20 requests/sec
      expect(metrics.successCount).to.equal(50)
    })
  })

  describe('Character Management Performance', () => {
    it('should handle concurrent character creation efficiently', async function() {
      this.timeout(45000)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const characterData = {
            name: `Perf Character ${Math.random().toString(36).substr(2, 9)}`,
            description: 'Performance test character',
            persona: JSON.stringify({
              kind: 'text',
              attributes: { text: 'Performance testing persona' }
            }),
            scenario: 'Performance test scenario',
            greeting: 'Hello from performance test!',
            sampleChat: 'User: Hi\nCharacter: Hello!'
          }

          const response = await request(app)
            .post('/api/character')
            .set('Authorization', `Bearer ${authToken}`)
            .send(characterData)
          
          expect(response.status).to.equal(200)
          expect(response.body).to.have.property('_id')
          return response.body
        },
        3, // 3 concurrent requests
        15, // 15 total requests
        'Character Creation Load Test'
      )

      expect(metrics.averageResponseTime).to.be.below(2000) // < 2 seconds
      expect(metrics.requestsPerSecond).to.be.above(2) // > 2 requests/sec
      expect(metrics.successCount).to.equal(15)
    })

    it('should retrieve character lists efficiently under load', async function() {
      this.timeout(30000)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const response = await request(app)
            .get('/api/character')
            .set('Authorization', `Bearer ${authToken}`)
          
          expect(response.status).to.equal(200)
          expect(response.body).to.have.property('characters')
          return response.body
        },
        8, // 8 concurrent requests
        40, // 40 total requests
        'Character List Load Test'
      )

      expect(metrics.averageResponseTime).to.be.below(1000) // < 1 second
      expect(metrics.requestsPerSecond).to.be.above(10) // > 10 requests/sec
      expect(metrics.successCount).to.equal(40)
    })
  })

  describe('Chat Performance', () => {
    it('should handle concurrent chat creation efficiently', async function() {
      this.timeout(30000)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const chatData = {
            name: `Perf Chat ${Math.random().toString(36).substr(2, 9)}`,
            characterId: characterId,
            mode: 'standard'
          }

          const response = await request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${authToken}`)
            .send(chatData)
          
          expect(response.status).to.equal(200)
          expect(response.body).to.have.property('_id')
          return response.body
        },
        4, // 4 concurrent requests
        20, // 20 total requests
        'Chat Creation Load Test'
      )

      expect(metrics.averageResponseTime).to.be.below(1500) // < 1.5 seconds
      expect(metrics.requestsPerSecond).to.be.above(3) // > 3 requests/sec
      expect(metrics.successCount).to.equal(20)
    })

    it('should handle message sending under load with mocked AI', async function() {
      this.timeout(60000)

      // Configure mock AI for fast responses during load test
      mockAIService.simulateServiceType('fast')

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const messageData = {
            text: `Performance test message ${Date.now()}`,
            kind: 'send-noreply'
          }

          const response = await request(app)
            .post(`/api/chat/${chatId}/send`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(messageData)
          
          expect(response.status).to.equal(200)
          expect(response.body).to.have.property('success', true)
          return response.body
        },
        3, // 3 concurrent requests (limited due to AI processing)
        15, // 15 total requests
        'Message Sending Load Test'
      )

      // Reset AI service to balanced mode
      mockAIService.simulateServiceType('balanced')

      expect(metrics.averageResponseTime).to.be.below(3000) // < 3 seconds with AI
      expect(metrics.requestsPerSecond).to.be.above(1) // > 1 request/sec
      expect(metrics.successCount).to.equal(15)

      // Check AI service performance
      const aiMetrics = mockAIService.getAggregatedMetrics()
      expect(aiMetrics.totalRequests).to.be.above(0)
      expect(aiMetrics.averageResponseTime).to.be.below(2000) // Mock AI < 2s
    })
  })

  describe('Database Performance', () => {
    it('should handle rapid user profile updates', async function() {
      this.timeout(30000)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const response = await request(app)
            .post('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .field('handle', `Updated Handle ${Date.now()}`)
          
          expect(response.status).to.equal(200)
          return response.body
        },
        5, // 5 concurrent requests
        25, // 25 total requests
        'Profile Update Load Test'
      )

      expect(metrics.averageResponseTime).to.be.below(1000) // < 1 second
      expect(metrics.requestsPerSecond).to.be.above(5) // > 5 requests/sec
      expect(metrics.successCount).to.equal(25)
    })

    it('should efficiently retrieve chat lists with many chats', async function() {
      this.timeout(30000)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const response = await request(app)
            .get('/api/chat')
            .set('Authorization', `Bearer ${authToken}`)
          
          expect(response.status).to.equal(200)
          expect(response.body).to.have.property('chats')
          return response.body
        },
        6, // 6 concurrent requests
        30, // 30 total requests
        'Chat List Retrieval Load Test'
      )

      expect(metrics.averageResponseTime).to.be.below(800) // < 800ms
      expect(metrics.requestsPerSecond).to.be.above(8) // > 8 requests/sec
      expect(metrics.successCount).to.equal(30)
    })
  })

  describe('Memory and Resource Performance', () => {
    it('should not leak memory during intensive operations', async function() {
      this.timeout(45000)

      const initialMemory = process.memoryUsage()

      // Perform intensive operations
      for (let i = 0; i < 5; i++) {
        await PerformanceTestUtils.runConcurrentTest(
          async () => {
            // Mix of operations
            const operations = [
              () => request(app).get('/api/user').set('Authorization', `Bearer ${authToken}`),
              () => request(app).get('/api/character').set('Authorization', `Bearer ${authToken}`),
              () => request(app).get('/api/chat').set('Authorization', `Bearer ${authToken}`)
            ]
            
            const operation = operations[Math.floor(Math.random() * operations.length)]
            const response = await operation()
            expect(response.status).to.equal(200)
            return response.body
          },
          3,
          9,
          `Memory Test Iteration ${i + 1}`
        )

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 50MB)
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      expect(memoryIncrease).to.be.below(50 * 1024 * 1024) // 50MB limit
    })
  })

  describe('AI Service Mock Performance', () => {
    it('should demonstrate AI service performance characteristics', async function() {
      this.timeout(30000)

      const serviceTypes: ('fast' | 'balanced' | 'quality' | 'slow')[] = ['fast', 'balanced', 'quality', 'slow']
      const results: Record<string, any> = {}

      for (const serviceType of serviceTypes) {
        mockAIService.resetMetrics()
        mockAIService.simulateServiceType(serviceType)

        const { metrics } = await PerformanceTestUtils.runConcurrentTest(
          async () => {
            const response = await mockAIService.generateResponse(
              'This is a test prompt for performance measurement',
              { temperature: 0.7, maxTokens: 150 }
            )
            return response
          },
          2, // 2 concurrent
          10, // 10 total
          `AI Service Performance Test (${serviceType})`
        )

        const aiMetrics = mockAIService.getAggregatedMetrics()
        results[serviceType] = {
          ...metrics,
          aiMetrics
        }
      }

      // Verify performance characteristics
      expect(results.fast.averageResponseTime).to.be.below(results.balanced.averageResponseTime)
      expect(results.balanced.averageResponseTime).to.be.below(results.quality.averageResponseTime)
      expect(results.quality.averageResponseTime).to.be.below(results.slow.averageResponseTime)

      console.log('🤖 AI Service Performance Summary:')
      for (const [type, result] of Object.entries(results)) {
        console.log(`   ${type}: ${result.averageResponseTime.toFixed(0)}ms avg, ${result.requestsPerSecond.toFixed(1)} req/s`)
      }
    })
  })
})