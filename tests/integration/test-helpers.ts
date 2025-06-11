/**
 * Integration Test Helpers
 * 
 * Utilities for setting up and running integration tests
 */

import request from 'supertest'
import { Express } from 'express'
import { expect } from 'chai'
import { AppSchema } from '../../common/types/schema'
import { TEST_FIXTURES, TestUtils, testDb } from './test-setup'
import { MockUtils } from './mocks/agnai-api-mock'

// Test Application Interface
export interface TestApp {
  app: Express
  request: request.SuperTest<request.Test>
  server?: any
}

// API Test Helper Class
export class APITestHelper {
  private app: TestApp

  constructor(app: TestApp) {
    this.app = app
  }

  // Authentication helpers
  async loginUser(credentials: { username: string; password: string }): Promise<{
    token: string
    user: AppSchema.User
  }> {
    const response = await this.app.request
      .post('/api/auth/login')
      .send(credentials)
      .expect(200)

    return {
      token: response.body.token,
      user: response.body.user
    }
  }

  async registerUser(userData: {
    username: string
    password: string
    handle?: string
  }): Promise<{
    token: string
    user: AppSchema.User
  }> {
    const response = await this.app.request
      .post('/api/auth/register')
      .send({
        handle: userData.handle || userData.username,
        ...userData
      })
      .expect(200)

    return {
      token: response.body.token,
      user: response.body.user
    }
  }

  // Chat helpers
  async sendChatMessage(
    chatId: string,
    message: string,
    token: string,
    options?: {
      characterId?: string
      replyAs?: string
    }
  ): Promise<any> {
    return this.app.request
      .post('/api/chat/message')
      .set('Authorization', `Bearer ${token}`)
      .send({
        chatId,
        message,
        characterId: options?.characterId,
        replyAs: options?.replyAs
      })
  }

  async createChat(
    data: {
      characterId: string
      name?: string
      scenario?: string
    },
    token: string
  ): Promise<AppSchema.Chat> {
    const response = await this.app.request
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(200)

    return response.body
  }

  async getChat(chatId: string, token: string): Promise<AppSchema.Chat> {
    const response = await this.app.request
      .get(`/api/chat/${chatId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    return response.body
  }

  async getChatMessages(chatId: string, token: string): Promise<AppSchema.ChatMessage[]> {
    const response = await this.app.request
      .get(`/api/chat/${chatId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    return response.body
  }

  // Character helpers
  async createCharacter(
    data: {
      name: string
      description?: string
      personality?: string
      scenario?: string
      greeting?: string
    },
    token: string
  ): Promise<AppSchema.Character> {
    const response = await this.app.request
      .post('/api/character')
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(200)

    return response.body
  }

  async getCharacter(characterId: string, token: string): Promise<AppSchema.Character> {
    const response = await this.app.request
      .get(`/api/character/${characterId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    return response.body
  }

  async getUserCharacters(token: string): Promise<AppSchema.Character[]> {
    const response = await this.app.request
      .get('/api/character')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    return response.body
  }

  // User helpers
  async getUserProfile(token: string): Promise<AppSchema.Profile> {
    const response = await this.app.request
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    return response.body
  }

  async updateUserSettings(
    settings: Partial<AppSchema.UserGenPreset>,
    token: string
  ): Promise<any> {
    return this.app.request
      .put('/api/user/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(settings)
  }

  // Generic API helpers
  async makeRequest(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    options?: {
      token?: string
      body?: any
      query?: any
      expectedStatus?: number
    }
  ): Promise<request.Response> {
    let req = this.app.request[method](endpoint)

    if (options?.token) {
      req = req.set('Authorization', `Bearer ${options.token}`)
    }

    if (options?.query) {
      req = req.query(options.query)
    }

    if (options?.body) {
      req = req.send(options.body)
    }

    if (options?.expectedStatus) {
      req = req.expect(options.expectedStatus)
    }

    return req
  }
}

// WebSocket Test Helper
export class WebSocketTestHelper {
  private connections: Map<string, any> = new Map()

  async connect(url: string, token?: string): Promise<any> {
    // Mock WebSocket connection for testing
    const mockSocket = {
      connected: true,
      emit: () => {},
      on: () => {},
      disconnect: () => {},
      id: `test-socket-${Date.now()}`
    }

    this.connections.set(mockSocket.id, mockSocket)
    return mockSocket
  }

  disconnect(socketId: string): void {
    const socket = this.connections.get(socketId)
    if (socket) {
      socket.connected = false
      socket.disconnect()
      this.connections.delete(socketId)
    }
  }

  disconnectAll(): void {
    for (const [id] of this.connections) {
      this.disconnect(id)
    }
  }

  getConnection(socketId: string): any {
    return this.connections.get(socketId)
  }

  getAllConnections(): any[] {
    return Array.from(this.connections.values())
  }
}

// Database Test Helper
export class DatabaseTestHelper {
  async createUser(userData: Partial<AppSchema.User>): Promise<AppSchema.User> {
    const user = {
      ...TEST_FIXTURES.users.regularUser,
      ...userData,
      _id: userData._id || TestUtils.generateId('user'),
      hash: userData.hash || 'hashed-password-123', // Required field
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AppSchema.User

    // Add to test database
    testDb['data'].users.set(user._id, user)
    return user
  }

  async createCharacter(characterData: Partial<AppSchema.Character>): Promise<AppSchema.Character> {
    const character = {
      ...TEST_FIXTURES.characters.testCharacter,
      ...characterData,
      _id: characterData._id || TestUtils.generateId('character'),
      persona: characterData.persona || { kind: 'text', attributes: {} }, // Required field
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AppSchema.Character

    testDb['data'].characters.set(character._id, character)
    return character
  }

  async createChat(chatData: Partial<AppSchema.Chat>): Promise<AppSchema.Chat> {
    const chat = {
      ...TEST_FIXTURES.chats.testChat,
      ...chatData,
      _id: chatData._id || TestUtils.generateId('chat'),
      memberIds: chatData.memberIds || [], // Required field
      messageCount: chatData.messageCount || 0, // Required field
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AppSchema.Chat

    testDb['data'].chats.set(chat._id, chat)
    return chat
  }

  async createMessage(messageData: Partial<AppSchema.ChatMessage>): Promise<AppSchema.ChatMessage> {
    const message = {
      ...TEST_FIXTURES.messages.userMessage,
      ...messageData,
      _id: messageData._id || TestUtils.generateId('message'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    testDb['data'].messages.set(message._id, message)
    return message
  }

  async clearAll(): Promise<void> {
    await testDb.clear()
  }

  async cleanMongoDB(): Promise<void> {
    await testDb.cleanMongoDB?.()
  }

  async resetMongoDB(): Promise<void> {
    await testDb.resetMongoDB?.()
  }

  async seedDefaults(): Promise<void> {
    await testDb.seed()
  }
}

// Integration Test Suite Helper
export class IntegrationTestSuite {
  public api: APITestHelper
  public websocket: WebSocketTestHelper
  public database: DatabaseTestHelper
  public app: TestApp

  constructor(app: TestApp) {
    this.app = app
    this.api = new APITestHelper(app)
    this.websocket = new WebSocketTestHelper()
    this.database = new DatabaseTestHelper()
  }

  // Setup and teardown helpers
  async beforeEach(): Promise<void> {
    // Clear and seed database (both memory and MongoDB)
    await this.database.clearAll()
    await this.database.seedDefaults()
    
    // Reset mocks
    MockUtils.reset()
    
    // Clear WebSocket connections
    this.websocket.disconnectAll()
  }

  async afterEach(): Promise<void> {
    // Cleanup after each test
    await this.database.clearAll()
    MockUtils.reset()
    this.websocket.disconnectAll()
  }

  // Common test scenarios
  async setupAuthenticatedUser(): Promise<{
    user: AppSchema.User
    token: string
  }> {
    const user = await this.database.createUser({
      username: 'testuser',
      hash: 'hashedpassword123' // Use hash instead of password
    })

    const token = TestUtils.generateTestToken(user)
    return { user, token }
  }

  async setupChatWithCharacter(): Promise<{
    user: AppSchema.User
    token: string
    character: AppSchema.Character
    chat: AppSchema.Chat
  }> {
    const { user, token } = await this.setupAuthenticatedUser()
    
    const character = await this.database.createCharacter({
      userId: user._id,
      name: 'Test Character'
    })

    const chat = await this.database.createChat({
      userId: user._id,
      characterId: character._id,
      name: 'Test Chat'
    })

    return { user, token, character, chat }
  }

  // Assertion helpers
  assertValidUser(user: any): void {
    expect(user).to.have.property('_id')
    expect(user).to.have.property('username')
    expect(user).to.have.property('createdAt')
    expect(user).to.not.have.property('password') // Should be filtered out
  }

  assertValidCharacter(character: any): void {
    expect(character).to.have.property('_id')
    expect(character).to.have.property('name')
    expect(character).to.have.property('userId')
    expect(character).to.have.property('createdAt')
  }

  assertValidChat(chat: any): void {
    expect(chat).to.have.property('_id')
    expect(chat).to.have.property('userId')
    expect(chat).to.have.property('characterId')
    expect(chat).to.have.property('createdAt')
  }

  assertValidMessage(message: any): void {
    expect(message).to.have.property('_id')
    expect(message).to.have.property('chatId')
    expect(message).to.have.property('msg')
    expect(message).to.have.property('createdAt')
  }

  assertMockApiCalled(expectedParams?: any): void {
    expect(MockUtils.wasApiCalled()).to.equal(true)
    if (expectedParams) {
      expect(MockUtils.wasCalledWith(expectedParams)).to.equal(true)
    }
  }
}

// Export test runner function
export function createTestSuite(app: TestApp): IntegrationTestSuite {
  return new IntegrationTestSuite(app)
}