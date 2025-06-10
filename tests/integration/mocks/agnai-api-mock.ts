/**
 * Mock Agnaistic Subscriber API
 * 
 * Provides controllable mock responses for testing without external API calls
 */

import { EventEmitter } from 'events'

// Mock API Response Types
export interface MockChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: 'stop' | 'length' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface MockStreamChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
    }
    finish_reason?: 'stop' | 'length' | 'content_filter'
  }>
}

export interface MockErrorResponse {
  error: {
    message: string
    type: string
    code: string
  }
}

// Mock Response Scenarios
export const MOCK_RESPONSES = {
  // Successful responses
  success: {
    simple: 'Hello! How can I help you today?',
    long: 'This is a longer response that tests how the system handles more extensive AI-generated content. It includes multiple sentences and various punctuation marks to ensure proper parsing and display.',
    withCharacterName: 'Test Character: Hello there! I\'m happy to chat with you.',
    multiline: 'This is a response\nwith multiple lines\nto test formatting.',
  },

  // Error scenarios
  errors: {
    invalidApiKey: {
      error: {
        message: 'Invalid API key provided',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    },
    rateLimited: {
      error: {
        message: 'Rate limit exceeded',
        type: 'rate_limit_error', 
        code: 'rate_limit_exceeded'
      }
    },
    serverError: {
      error: {
        message: 'Internal server error',
        type: 'api_error',
        code: 'internal_error'
      }
    },
    timeout: 'TIMEOUT', // Special marker for timeout simulation
    networkError: 'NETWORK_ERROR', // Special marker for network errors
  }
}

// Mock API Server Class
export class MockAgnaisticAPI extends EventEmitter {
  private responses: Map<string, any> = new Map()
  private delays: Map<string, number> = new Map()
  private callHistory: Array<{ url: string; headers: any; body: any; timestamp: Date }> = []

  constructor() {
    super()
    this.setupDefaultResponses()
  }

  private setupDefaultResponses(): void {
    // Default successful response
    this.setResponse('/v1/chat/completions', this.createSuccessResponse(MOCK_RESPONSES.success.simple))
  }

  // Configure mock response for specific endpoint
  setResponse(endpoint: string, response: any): void {
    this.responses.set(endpoint, response)
  }

  // Set delay for specific endpoint (simulates network latency)
  setDelay(endpoint: string, ms: number): void {
    this.delays.set(endpoint, ms)
  }

  // Clear all mock responses
  clear(): void {
    this.responses.clear()
    this.delays.clear()
    this.callHistory = []
  }

  // Get call history for verification
  getCallHistory(): Array<{ url: string; headers: any; body: any; timestamp: Date }> {
    return [...this.callHistory]
  }

  // Get last call for quick verification
  getLastCall(): { url: string; headers: any; body: any; timestamp: Date } | undefined {
    return this.callHistory[this.callHistory.length - 1]
  }

  // Mock HTTP request handler
  async handleRequest(url: string, options: {
    method: string
    headers: any
    body: string
  }): Promise<any> {
    // Record the call
    this.callHistory.push({
      url,
      headers: options.headers,
      body: JSON.parse(options.body || '{}'),
      timestamp: new Date()
    })

    const endpoint = new URL(url).pathname
    const delay = this.delays.get(endpoint) || 0
    
    // Simulate network delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    const response = this.responses.get(endpoint)
    
    if (!response) {
      throw new Error(`No mock response configured for ${endpoint}`)
    }

    // Handle special error cases
    if (response === 'TIMEOUT') {
      throw new Error('Request timeout')
    }
    
    if (response === 'NETWORK_ERROR') {
      throw new Error('Network connection failed')
    }

    // Handle error responses
    if (response.error) {
      const error = new Error(response.error.message) as any
      error.status = this.getErrorStatusCode(response.error.type)
      error.response = { data: response }
      throw error
    }

    return response
  }

  // Mock streaming response handler
  async* handleStreamRequest(url: string, options: {
    method: string
    headers: any
    body: string
  }): AsyncGenerator<MockStreamChunk> {
    // Record the call
    this.callHistory.push({
      url,
      headers: options.headers,
      body: JSON.parse(options.body || '{}'),
      timestamp: new Date()
    })

    const endpoint = new URL(url).pathname
    const response = this.responses.get(endpoint)
    
    if (!response) {
      throw new Error(`No mock response configured for ${endpoint}`)
    }

    // Handle error cases in streaming
    if (typeof response === 'string' && response.startsWith('ERROR')) {
      throw new Error(response)
    }

    if (response.error) {
      throw new Error(response.error.message)
    }

    // Generate streaming chunks from response
    const content = response.choices?.[0]?.message?.content || MOCK_RESPONSES.success.simple
    const words = content.split(' ')
    
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)) // Simulate streaming delay
      
      const isFirst = i === 0
      const isLast = i === words.length - 1
      const wordWithSpace = i < words.length - 1 ? words[i] + ' ' : words[i]
      
      yield {
        id: `chatcmpl-test-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'test-model',
        choices: [{
          index: 0,
          delta: {
            role: isFirst ? 'assistant' : undefined,
            content: wordWithSpace
          },
          finish_reason: isLast ? 'stop' : undefined
        }]
      }
    }
  }

  private getErrorStatusCode(errorType: string): number {
    switch (errorType) {
      case 'invalid_request_error': return 400
      case 'rate_limit_error': return 429
      case 'api_error': return 500
      default: return 500
    }
  }

  private createSuccessResponse(content: string): MockChatCompletionResponse {
    return {
      id: `chatcmpl-test-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'test-model',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: content.split(' ').length,
        total_tokens: 10 + content.split(' ').length
      }
    }
  }

  // Helper methods for common scenarios
  setSuccessResponse(content: string, endpoint = '/v1/chat/completions'): void {
    this.setResponse(endpoint, this.createSuccessResponse(content))
  }

  setErrorResponse(errorType: keyof typeof MOCK_RESPONSES.errors, endpoint = '/v1/chat/completions'): void {
    this.setResponse(endpoint, MOCK_RESPONSES.errors[errorType])
  }

  setNetworkError(endpoint = '/v1/chat/completions'): void {
    this.setResponse(endpoint, 'NETWORK_ERROR')
  }

  setTimeout(endpoint = '/v1/chat/completions'): void {
    this.setResponse(endpoint, 'TIMEOUT')
  }

  // Verify that API was called with expected parameters
  verifyLastCall(expectedParams: {
    endpoint?: string
    method?: string
    headers?: Partial<any>
    body?: Partial<any>
  }): boolean {
    const lastCall = this.getLastCall()
    if (!lastCall) return false

    if (expectedParams.endpoint && !lastCall.url.includes(expectedParams.endpoint)) {
      return false
    }

    if (expectedParams.headers) {
      for (const [key, value] of Object.entries(expectedParams.headers)) {
        if (lastCall.headers[key] !== value) {
          return false
        }
      }
    }

    if (expectedParams.body) {
      for (const [key, value] of Object.entries(expectedParams.body)) {
        if (lastCall.body[key] !== value) {
          return false
        }
      }
    }

    return true
  }
}

// Export singleton instance for tests
export const mockAgnaisticAPI = new MockAgnaisticAPI()

// Utility functions for tests
export const MockUtils = {
  // Reset mock to clean state
  reset(): void {
    mockAgnaisticAPI.clear()
    mockAgnaisticAPI.setSuccessResponse(MOCK_RESPONSES.success.simple)
  },

  // Setup common test scenarios
  setupSuccessScenario(content = MOCK_RESPONSES.success.simple): void {
    mockAgnaisticAPI.setSuccessResponse(content)
  },

  setupErrorScenario(errorType: keyof typeof MOCK_RESPONSES.errors): void {
    mockAgnaisticAPI.setErrorResponse(errorType)
  },

  setupSlowResponse(delayMs = 1000): void {
    mockAgnaisticAPI.setDelay('/v1/chat/completions', delayMs)
    mockAgnaisticAPI.setSuccessResponse(MOCK_RESPONSES.success.simple)
  },

  // Verification helpers
  wasApiCalled(): boolean {
    return mockAgnaisticAPI.getCallHistory().length > 0
  },

  getApiCallCount(): number {
    return mockAgnaisticAPI.getCallHistory().length
  },

  wasCalledWith(params: any): boolean {
    return mockAgnaisticAPI.verifyLastCall(params)
  }
}