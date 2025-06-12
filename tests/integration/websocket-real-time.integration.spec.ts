/**
 * WebSocket Real-Time Integration Tests
 * 
 * Tests WebSocket connectivity, authentication, message broadcasting, and real-time features
 */

import { expect } from 'chai'
import WebSocket from 'ws'
import request from 'supertest'
import { createApp } from '../../srv/app'
import { setupTestEnvironment, teardownTestEnvironment } from './test-setup'
import { connect } from '../../srv/db/client'
import { cleanTestDatabase } from './database-cleanup'

interface WebSocketMessage {
  type: string
  [key: string]: any
}

class TestWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private messages: WebSocketMessage[] = []
  private messagePromises: Map<string, (message: WebSocketMessage) => void> = new Map()

  constructor(port: number) {
    this.url = `ws://localhost:${port}`
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)
      
      this.ws.on('open', () => {
        resolve()
      })

      this.ws.on('error', (error) => {
        reject(error)
      })

      this.ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString())
          this.messages.push(message)
          
          // Resolve any waiting promises for this message type
          const promise = this.messagePromises.get(message.type)
          if (promise) {
            promise(message)
            this.messagePromises.delete(message.type)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      })
    })
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  async waitForMessage(type: string, timeout: number = 5000): Promise<WebSocketMessage> {
    // Check if message already received
    const existingMessage = this.messages.find(msg => msg.type === type)
    if (existingMessage) {
      return existingMessage
    }

    // Wait for new message
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.messagePromises.delete(type)
        reject(new Error(`Timeout waiting for WebSocket message type: ${type}`))
      }, timeout)

      this.messagePromises.set(type, (message) => {
        clearTimeout(timeoutId)
        resolve(message)
      })
    })
  }

  getMessages(): WebSocketMessage[] {
    return [...this.messages]
  }

  clearMessages(): void {
    this.messages = []
  }

  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

describe('WebSocket Real-Time Integration Tests', () => {
  let app: any
  let server: any
  let port: number
  let authToken: string
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
        port = server.address().port
        resolve()
      })
    })

    // Create test user and character for WebSocket tests
    const userData = {
      username: `wsuser_${Date.now()}`,
      password: 'securepass123',
      handle: 'WebSocket Test User'
    }

    const userResponse = await request(app)
      .post('/api/user/register')
      .send(userData)
      .expect(200)

    authToken = userResponse.body.token

    // Create a character for testing
    const characterData = {
      name: 'WebSocket Test Character',
      description: 'A character for WebSocket testing',
      persona: JSON.stringify({
        kind: 'text',
        attributes: {
          text: 'You are a helpful AI assistant for WebSocket testing purposes.'
        }
      }),
      scenario: 'You are in a WebSocket test environment.',
      greeting: 'Hello! I am a WebSocket test character.',
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
      name: 'WebSocket Test Chat',
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

  describe('WebSocket Connection Management', () => {
    let client: TestWebSocketClient

    beforeEach(() => {
      client = new TestWebSocketClient(port)
    })

    afterEach(() => {
      if (client) {
        client.close()
      }
    })

    it('should establish WebSocket connection successfully', async () => {
      await client.connect()
      
      expect(client.isConnected()).to.be.true
      
      // Should receive connection confirmation
      const connectionMsg = await client.waitForMessage('connected')
      expect(connectionMsg).to.have.property('type', 'connected')
      expect(connectionMsg).to.have.property('uid')
      expect(connectionMsg.uid).to.be.a('string')
    })

    it('should handle WebSocket authentication', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Send login message
      client.send({
        type: 'login',
        token: authToken
      })

      // Should receive login success
      const loginMsg = await client.waitForMessage('login')
      expect(loginMsg).to.have.property('type', 'login')
      expect(loginMsg).to.have.property('success', true)
    })

    it('should reject invalid authentication tokens', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Send login with invalid token
      client.send({
        type: 'login',
        token: 'invalid-token'
      })

      // Should receive login failure
      const loginMsg = await client.waitForMessage('login')
      expect(loginMsg).to.have.property('type', 'login')
      expect(loginMsg).to.have.property('success', false)
    })

    it('should handle logout properly', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Login first
      client.send({
        type: 'login',
        token: authToken
      })
      await client.waitForMessage('login')

      // Send logout
      client.send({
        type: 'logout'
      })

      // Should receive logout confirmation
      const logoutMsg = await client.waitForMessage('logout')
      expect(logoutMsg).to.have.property('type', 'logout')
      expect(logoutMsg).to.have.property('success', true)
    })

    it('should handle ping/pong heartbeat', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Send ping
      client.send({
        type: 'ping'
      })

      // Should receive pong
      const pongMsg = await client.waitForMessage('pong')
      expect(pongMsg).to.have.property('type', 'pong')
    })
  })

  describe('Real-Time Message Broadcasting', () => {
    let client1: TestWebSocketClient
    let client2: TestWebSocketClient

    beforeEach(async () => {
      client1 = new TestWebSocketClient(port)
      client2 = new TestWebSocketClient(port)

      // Connect both clients
      await client1.connect()
      await client2.connect()

      // Wait for connection messages
      await client1.waitForMessage('connected')
      await client2.waitForMessage('connected')

      // Authenticate both clients
      client1.send({ type: 'login', token: authToken })
      client2.send({ type: 'login', token: authToken })

      await client1.waitForMessage('login')
      await client2.waitForMessage('login')

      // Clear initial messages
      client1.clearMessages()
      client2.clearMessages()
    })

    afterEach(() => {
      if (client1) client1.close()
      if (client2) client2.close()
    })

    it('should broadcast message creation to connected clients', async () => {
      // Create a message via HTTP API
      const messageData = {
        text: 'Hello from WebSocket test!',
        kind: 'send-noreply'
      }

      await request(app)
        .post(`/api/chat/${chatId}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200)

      // Both clients should receive the message-created event
      const msg1 = await client1.waitForMessage('message-created', 3000)
      const msg2 = await client2.waitForMessage('message-created', 3000)

      expect(msg1).to.have.property('type', 'message-created')
      expect(msg1).to.have.property('chatId', chatId)
      expect(msg1).to.have.property('msg')
      expect(msg1.msg).to.have.property('msg', messageData.text)

      expect(msg2).to.have.property('type', 'message-created')
      expect(msg2).to.have.property('chatId', chatId)
      expect(msg2).to.have.property('msg')
      expect(msg2.msg).to.have.property('msg', messageData.text)
    })

    it('should broadcast chat deletion to connected clients', async () => {
      // Create a chat to delete
      const chatData = {
        name: 'Chat to Delete via WebSocket',
        characterId: characterId,
        mode: 'standard'
      }

      const chatResponse = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatData)
        .expect(200)

      const testChatId = chatResponse.body._id

      // Delete the chat
      await request(app)
        .delete(`/api/chat/${testChatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      // Both clients should receive the chat-deleted event
      const deleteMsg1 = await client1.waitForMessage('chat-deleted', 3000)
      const deleteMsg2 = await client2.waitForMessage('chat-deleted', 3000)

      expect(deleteMsg1).to.have.property('type', 'chat-deleted')
      expect(deleteMsg1).to.have.property('chatId', testChatId)

      expect(deleteMsg2).to.have.property('type', 'chat-deleted')
      expect(deleteMsg2).to.have.property('chatId', testChatId)
    })
  })

  describe('Multi-User Chat Scenarios', () => {
    let user1Client: TestWebSocketClient
    let user2Client: TestWebSocketClient
    let user2Token: string

    before(async () => {
      // Create second user
      const user2Data = {
        username: `wsuser2_${Date.now()}`,
        password: 'securepass123',
        handle: 'WebSocket Test User 2'
      }

      const user2Response = await request(app)
        .post('/api/user/register')
        .send(user2Data)
        .expect(200)

      user2Token = user2Response.body.token

      // For multi-user testing we use the existing chat since member management is complex
    })

    beforeEach(async () => {
      user1Client = new TestWebSocketClient(port)
      user2Client = new TestWebSocketClient(port)

      // Connect and authenticate both users
      await user1Client.connect()
      await user2Client.connect()

      await user1Client.waitForMessage('connected')
      await user2Client.waitForMessage('connected')

      user1Client.send({ type: 'login', token: authToken })
      user2Client.send({ type: 'login', token: user2Token })

      await user1Client.waitForMessage('login')
      await user2Client.waitForMessage('login')

      // Clear initial messages
      user1Client.clearMessages()
      user2Client.clearMessages()
    })

    afterEach(() => {
      if (user1Client) user1Client.close()
      if (user2Client) user2Client.close()
    })

    it('should handle multiple authenticated users simultaneously', async () => {
      // Both users should be able to send ping and receive pong
      user1Client.send({ type: 'ping' })
      user2Client.send({ type: 'ping' })

      const pong1 = await user1Client.waitForMessage('pong')
      const pong2 = await user2Client.waitForMessage('pong')

      expect(pong1).to.have.property('type', 'pong')
      expect(pong2).to.have.property('type', 'pong')
    })

    it('should maintain separate message queues for different users', async () => {
      // Send different versions to each client
      user1Client.send({ type: 'version', version: 100 })
      user2Client.send({ type: 'version', version: 200 })

      // Verify clients don't receive each other's version messages
      // (version messages don't generate responses, so we test with ping/pong)
      user1Client.send({ type: 'ping' })
      user2Client.send({ type: 'ping' })

      await user1Client.waitForMessage('pong')
      await user2Client.waitForMessage('pong')

      // Check that each client only got their own pong
      const user1Messages = user1Client.getMessages()
      const user2Messages = user2Client.getMessages()

      expect(user1Messages.length).to.equal(1) // Only pong
      expect(user2Messages.length).to.equal(1) // Only pong
    })
  })

  describe('WebSocket Error Handling', () => {
    let client: TestWebSocketClient

    beforeEach(() => {
      client = new TestWebSocketClient(port)
    })

    afterEach(() => {
      if (client) {
        client.close()
      }
    })

    it('should handle malformed JSON messages gracefully', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Send malformed JSON directly to WebSocket
      if (client.isConnected()) {
        const ws = (client as any).ws
        ws.send('{ invalid json }')
        
        // Server should not crash, connection should remain open
        await new Promise(resolve => setTimeout(resolve, 100))
        expect(client.isConnected()).to.be.true
      }
    })

    it('should handle invalid message types gracefully', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Send message with invalid type
      client.send({
        type: 'invalid-message-type',
        data: 'test'
      })

      // Server should not crash, connection should remain open
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(client.isConnected()).to.be.true
    })

    it('should handle connection cleanup on client disconnect', async () => {
      await client.connect()
      await client.waitForMessage('connected')

      // Authenticate
      client.send({ type: 'login', token: authToken })
      await client.waitForMessage('login')

      // Force disconnect
      client.close()

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Reconnect should work fine
      const newClient = new TestWebSocketClient(port)
      await newClient.connect()
      await newClient.waitForMessage('connected')
      
      expect(newClient.isConnected()).to.be.true
      newClient.close()
    })
  })

  describe('WebSocket Performance and Reliability', () => {
    it('should handle rapid connection establishment', async () => {
      const clients: TestWebSocketClient[] = []
      const connectionPromises: Promise<void>[] = []

      // Create multiple clients rapidly
      for (let i = 0; i < 5; i++) {
        const client = new TestWebSocketClient(port)
        clients.push(client)
        connectionPromises.push(client.connect())
      }

      // All should connect successfully
      await Promise.all(connectionPromises)

      // Verify all are connected
      for (const client of clients) {
        expect(client.isConnected()).to.be.true
        await client.waitForMessage('connected')
      }

      // Cleanup
      for (const client of clients) {
        client.close()
      }
    })

    it('should handle rapid message sending', async () => {
      const client = new TestWebSocketClient(port)
      await client.connect()
      await client.waitForMessage('connected')

      // Authenticate
      client.send({ type: 'login', token: authToken })
      await client.waitForMessage('login')

      client.clearMessages()

      // Send multiple ping messages rapidly
      const messageCount = 10
      for (let i = 0; i < messageCount; i++) {
        client.send({ type: 'ping' })
      }

      // Should receive all pong responses
      const pongMessages: WebSocketMessage[] = []
      for (let i = 0; i < messageCount; i++) {
        const pong = await client.waitForMessage('pong', 1000)
        pongMessages.push(pong)
      }

      expect(pongMessages.length).to.equal(messageCount)
      pongMessages.forEach(msg => {
        expect(msg).to.have.property('type', 'pong')
      })

      client.close()
    })
  })
})