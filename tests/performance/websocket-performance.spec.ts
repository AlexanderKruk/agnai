/**
 * WebSocket Performance Tests
 * 
 * Tests real-time WebSocket performance under load with multiple concurrent connections
 */

import { expect } from 'chai'
import request from 'supertest'
import WebSocket from 'ws'
import { createApp } from '../../srv/app'
import { setupTestEnvironment, teardownTestEnvironment } from '../integration/test-setup'
import { connect } from '../../srv/db/client'
import { cleanTestDatabase } from '../integration/database-cleanup'
import { PerformanceTestUtils } from './ai-mock-performance'

interface WebSocketMetrics {
  connectionTime: number
  messageLatency: number[]
  messagesReceived: number
  messagesSent: number
  errors: number
}

class PerformanceWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private authToken: string
  private metrics: WebSocketMetrics
  private messagePromises: Map<string, (message: any) => void> = new Map()
  private messages: any[] = []

  constructor(port: number, authToken: string) {
    this.url = `ws://localhost:${port}/ws`
    this.authToken = authToken
    this.metrics = {
      connectionTime: 0,
      messageLatency: [],
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0
    }
  }

  async connect(): Promise<void> {
    const startTime = Date.now()
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)
      
      this.ws.on('open', () => {
        this.metrics.connectionTime = Date.now() - startTime
        
        // Send authentication
        this.send({
          type: 'auth',
          token: this.authToken
        })
        
        resolve()
      })

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString())
          this.messages.push({
            ...message,
            receivedAt: Date.now()
          })
          this.metrics.messagesReceived++

          // Calculate latency if message has timestamp
          if (message.sentAt) {
            const latency = Date.now() - message.sentAt
            this.metrics.messageLatency.push(latency)
          }

          // Resolve any waiting promises
          const resolver = this.messagePromises.get(message.type)
          if (resolver) {
            resolver(message)
            this.messagePromises.delete(message.type)
          }
        } catch (error) {
          this.metrics.errors++
        }
      })

      this.ws.on('error', (error) => {
        this.metrics.errors++
        reject(error)
      })

      this.ws.on('close', () => {
        // Connection closed
      })
    })
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        sentAt: Date.now()
      }))
      this.metrics.messagesSent++
    }
  }

  async waitForMessage(type: string, timeout: number = 5000): Promise<any> {
    // Check if message already received
    const existingMessage = this.messages.find(msg => msg.type === type)
    if (existingMessage) return existingMessage

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.messagePromises.delete(type)
        reject(new Error(`Timeout waiting for message type: ${type}`))
      }, timeout)

      this.messagePromises.set(type, (message) => {
        clearTimeout(timeoutId)
        resolve(message)
      })
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  getMetrics(): WebSocketMetrics {
    return { ...this.metrics }
  }
}

describe('WebSocket Performance Tests', () => {
  let app: any
  let server: any
  let port: number
  let authToken: string
  let characterId: string

  before(async function() {
    this.timeout(60000)

    await setupTestEnvironment()
    await connect()
    await cleanTestDatabase()

    const { app: expressApp, server: httpServer } = createApp()
    app = expressApp
    server = httpServer

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address()
        port = address.port
        resolve()
      })
    })

    // Create test user and resources
    const userData = {
      username: `wsperf_${Date.now()}`,
      password: 'securepass123',
      handle: 'WebSocket Performance User'
    }

    const userResponse = await request(app)
      .post('/api/user/register')
      .send(userData)
      .expect(200)

    authToken = userResponse.body.token

    // Create test character
    const characterData = {
      name: 'WS Performance Character',
      description: 'A character for WebSocket performance testing',
      persona: JSON.stringify({
        kind: 'text',
        attributes: {
          text: 'You are an AI assistant for WebSocket performance testing.'
        }
      }),
      scenario: 'WebSocket performance testing environment',
      greeting: 'Hello! Ready for WebSocket performance testing.',
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
      name: 'WS Performance Chat',
      characterId: characterId,
      mode: 'standard'
    }

    await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send(chatData)
      .expect(200)

    // Chat created for WebSocket testing context
  })

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
    await teardownTestEnvironment()
  })

  describe('Connection Performance', () => {
    it('should handle multiple concurrent WebSocket connections efficiently', async function() {
      this.timeout(30000)

      const connectionCount = 10
      const clients: PerformanceWebSocketClient[] = []

      console.log(`🔗 Testing ${connectionCount} concurrent WebSocket connections`)

      const { metrics } = await PerformanceTestUtils.runConcurrentTest(
        async () => {
          const client = new PerformanceWebSocketClient(port, authToken)
          clients.push(client)
          await client.connect()
          return client.getMetrics()
        },
        5, // 5 concurrent connection attempts
        connectionCount, // 10 total connections
        'WebSocket Connection Load Test'
      )

      // Analyze connection performance
      const connectionTimes = clients.map(c => c.getMetrics().connectionTime)
      const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length
      const maxConnectionTime = Math.max(...connectionTimes)

      console.log(`   Average connection time: ${avgConnectionTime.toFixed(0)}ms`)
      console.log(`   Max connection time: ${maxConnectionTime.toFixed(0)}ms`)

      // Performance assertions
      expect(avgConnectionTime).to.be.below(1000) // < 1 second average
      expect(maxConnectionTime).to.be.below(3000) // < 3 seconds max
      expect(metrics.successCount).to.equal(connectionCount)

      // Clean up connections
      clients.forEach(client => client.disconnect())
    })

    it('should maintain stable connections under message load', async function() {
      this.timeout(45000)

      const clientCount = 5
      const messagesPerClient = 10
      const clients: PerformanceWebSocketClient[] = []

      // Establish connections
      for (let i = 0; i < clientCount; i++) {
        const client = new PerformanceWebSocketClient(port, authToken)
        await client.connect()
        clients.push(client)
      }

      console.log(`📨 Testing message load: ${clientCount} clients × ${messagesPerClient} messages`)

      // Send messages concurrently from all clients
      const messagePromises = clients.map((client, clientIndex) => 
        PerformanceTestUtils.runConcurrentTest(
          async () => {
            const messageId = Math.random().toString(36).substr(2, 9)
            client.send({
              type: 'ping',
              messageId,
              clientIndex,
              payload: `Performance test message from client ${clientIndex}`
            })

            // Wait for pong response
            try {
              await client.waitForMessage('pong', 5000)
              return { success: true, messageId }
            } catch (error) {
              return { success: false, error: (error as Error).message, messageId }
            }
          },
          2, // 2 concurrent messages per client
          messagesPerClient, // messages per client
          `Client ${clientIndex} Message Test`
        )
      )

      await Promise.all(messagePromises)

      // Analyze results
      let totalMessages = 0
      let successfulMessages = 0
      let totalLatency = 0
      let latencyCount = 0

      clients.forEach((client, index) => {
        const metrics = client.getMetrics()
        totalMessages += metrics.messagesSent
        successfulMessages += metrics.messagesReceived
        
        if (metrics.messageLatency.length > 0) {
          const clientLatency = metrics.messageLatency.reduce((a, b) => a + b, 0)
          totalLatency += clientLatency
          latencyCount += metrics.messageLatency.length
        }

        console.log(`   Client ${index}: ${metrics.messagesSent} sent, ${metrics.messagesReceived} received, ${metrics.errors} errors`)
      })

      const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0
      const successRate = (successfulMessages / totalMessages) * 100

      console.log(`   Overall success rate: ${successRate.toFixed(1)}%`)
      console.log(`   Average message latency: ${avgLatency.toFixed(0)}ms`)

      // Performance assertions
      expect(successRate).to.be.above(80) // > 80% success rate
      expect(avgLatency).to.be.below(500) // < 500ms average latency

      // Clean up
      clients.forEach(client => client.disconnect())
    })
  })

  describe('Real-time Communication Performance', () => {
    it('should handle rapid bidirectional communication', async function() {
      this.timeout(30000)

      const client = new PerformanceWebSocketClient(port, authToken)
      await client.connect()

      const messageCount = 50
      const rapidMessages: Promise<any>[] = []

      console.log(`⚡ Testing rapid bidirectional communication: ${messageCount} messages`)

      // Send rapid-fire messages
      for (let i = 0; i < messageCount; i++) {
        const messagePromise = (async () => {
          const messageId = `rapid_${i}_${Date.now()}`
          const sendTime = Date.now()
          
          client.send({
            type: 'ping',
            messageId,
            testType: 'rapid',
            sendTime
          })

          try {
            await client.waitForMessage('pong', 3000)
            return {
              messageId,
              latency: Date.now() - sendTime,
              success: true
            }
          } catch (error) {
            return {
              messageId,
              latency: -1,
              success: false,
              error: (error as Error).message
            }
          }
        })()

        rapidMessages.push(messagePromise)

        // Small delay between messages to avoid overwhelming
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      const results = await Promise.all(rapidMessages)
      const metrics = client.getMetrics()

      // Analyze rapid communication performance
      const successfulMessages = results.filter(r => r.success)
      const latencies = successfulMessages.map(r => r.latency).filter(l => l > 0)
      
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
      const successRate = (successfulMessages.length / messageCount) * 100

      console.log(`   Success rate: ${successRate.toFixed(1)}%`)
      console.log(`   Average latency: ${avgLatency.toFixed(0)}ms`)
      console.log(`   Messages sent: ${metrics.messagesSent}`)
      console.log(`   Messages received: ${metrics.messagesReceived}`)
      console.log(`   Errors: ${metrics.errors}`)

      // Performance assertions
      expect(successRate).to.be.above(70) // > 70% success rate for rapid messages
      expect(avgLatency).to.be.below(1000) // < 1 second average latency
      expect(metrics.errors).to.be.below(5) // < 5 errors

      client.disconnect()
    })

    it('should handle WebSocket connection scaling', async function() {
      this.timeout(60000)

      const maxClients = 20
      const clients: PerformanceWebSocketClient[] = []
      const connectionResults: Array<{ success: boolean; time: number; error?: string }> = []

      console.log(`📈 Testing WebSocket scaling: up to ${maxClients} connections`)

      // Gradually increase connections
      for (let i = 0; i < maxClients; i++) {
        const startTime = Date.now()
        
        try {
          const client = new PerformanceWebSocketClient(port, authToken)
          await client.connect()
          clients.push(client)
          
          connectionResults.push({
            success: true,
            time: Date.now() - startTime
          })

          // Test message with this client
          client.send({ type: 'ping', testMessage: `scaling_test_${i}` })
          
        } catch (error) {
          connectionResults.push({
            success: false,
            time: Date.now() - startTime,
            error: (error as Error).message
          })
        }

        // Brief pause between connections
        if (i % 5 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      // Analyze scaling performance
      const successfulConnections = connectionResults.filter(r => r.success)
      const avgConnectionTime = successfulConnections.length > 0 
        ? successfulConnections.reduce((sum, r) => sum + r.time, 0) / successfulConnections.length
        : 0

      const connectionSuccessRate = (successfulConnections.length / maxClients) * 100

      console.log(`   Successful connections: ${successfulConnections.length}/${maxClients}`)
      console.log(`   Connection success rate: ${connectionSuccessRate.toFixed(1)}%`)
      console.log(`   Average connection time: ${avgConnectionTime.toFixed(0)}ms`)

      // Test concurrent messaging with all connected clients
      if (clients.length > 0) {
        const concurrentMessagePromises = clients.map(async (client, index) => {
          try {
            client.send({ 
              type: 'ping', 
              clientId: index,
              timestamp: Date.now()
            })
            await client.waitForMessage('pong', 5000)
            return { success: true, clientId: index }
          } catch (error) {
            return { success: false, clientId: index, error: (error as Error).message }
          }
        })

        const messageResults = await Promise.all(concurrentMessagePromises)
        const messageSuccessRate = (messageResults.filter(r => r.success).length / clients.length) * 100

        console.log(`   Concurrent messaging success rate: ${messageSuccessRate.toFixed(1)}%`)

        // Performance assertions for scaling
        expect(connectionSuccessRate).to.be.above(75) // > 75% connection success
        expect(messageSuccessRate).to.be.above(70) // > 70% message success with many clients
      }

      // Clean up all connections
      clients.forEach(client => client.disconnect())
    })
  })
})