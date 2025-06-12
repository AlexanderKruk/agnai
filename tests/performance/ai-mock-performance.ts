/**
 * AI Service Performance Mocks
 * 
 * High-performance mocks for AI services that simulate realistic response times
 * without making actual API calls for load testing
 */

import { AppSchema } from '../../common/types/schema'

export interface MockAIResponse {
  message: string
  delay: number // milliseconds
  tokens?: number
  model?: string
}

export interface PerformanceMetrics {
  responseTime: number
  tokensPerSecond?: number
  memoryUsage?: number
  cpuUsage?: number
}

/**
 * Mock AI Service for Performance Testing
 * Simulates realistic AI response patterns without external API calls
 */
export class MockAIService {
  private responses: MockAIResponse[] = []
  private currentIndex = 0
  private metrics: PerformanceMetrics[] = []

  constructor() {
    this.setupDefaultResponses()
  }

  private setupDefaultResponses() {
    // Realistic response patterns with varying lengths and delays
    this.responses = [
      {
        message: "Hello! How can I help you today?",
        delay: 800,
        tokens: 8,
        model: "mock-gpt-3.5"
      },
      {
        message: "That's an interesting question. Let me think about that for a moment. I believe the answer depends on several factors that we should consider carefully.",
        delay: 1200,
        tokens: 28,
        model: "mock-gpt-3.5"
      },
      {
        message: "I understand your concern. Here's what I would suggest: First, consider the context and background information. Second, evaluate the potential outcomes. Finally, make a decision based on the available evidence and your personal values.",
        delay: 1800,
        tokens: 42,
        model: "mock-gpt-4"
      },
      {
        message: "Yes, absolutely! That's a great idea. I think it would work well in this situation.",
        delay: 600,
        tokens: 18,
        model: "mock-gpt-3.5"
      },
      {
        message: "I'm not entirely sure about that. Could you provide more details or clarify what you mean? I want to make sure I give you the most accurate and helpful response possible.",
        delay: 1000,
        tokens: 32,
        model: "mock-gpt-4"
      }
    ]
  }

  /**
   * Simulate AI response with realistic delays and token generation
   */
  async generateResponse(prompt: string, options: {
    temperature?: number
    maxTokens?: number
    model?: string
  } = {}): Promise<{
    message: string
    metrics: PerformanceMetrics
  }> {
    const startTime = Date.now()
    const memoryBefore = process.memoryUsage()

    // Get next response in rotation
    const response = this.responses[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.responses.length

    // Simulate processing delay based on response complexity
    const baseDelay = response.delay
    const complexityMultiplier = Math.max(0.5, Math.min(2.0, prompt.length / 100))
    const actualDelay = baseDelay * complexityMultiplier

    // Add some realistic randomness (±20%)
    const randomFactor = 0.8 + (Math.random() * 0.4)
    const finalDelay = Math.round(actualDelay * randomFactor)

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, finalDelay))

    const endTime = Date.now()
    const memoryAfter = process.memoryUsage()

    const metrics: PerformanceMetrics = {
      responseTime: endTime - startTime,
      tokensPerSecond: response.tokens ? (response.tokens / (finalDelay / 1000)) : undefined,
      memoryUsage: memoryAfter.heapUsed - memoryBefore.heapUsed,
    }

    this.metrics.push(metrics)

    return {
      message: response.message,
      metrics
    }
  }

  /**
   * Get aggregated performance metrics
   */
  getAggregatedMetrics(): {
    averageResponseTime: number
    medianResponseTime: number
    p95ResponseTime: number
    totalRequests: number
    averageTokensPerSecond: number
    peakMemoryUsage: number
  } {
    if (this.metrics.length === 0) {
      return {
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        totalRequests: 0,
        averageTokensPerSecond: 0,
        peakMemoryUsage: 0
      }
    }

    const responseTimes = this.metrics.map(m => m.responseTime).sort((a, b) => a - b)
    const tokensPerSecond = this.metrics
      .filter(m => m.tokensPerSecond)
      .map(m => m.tokensPerSecond!)

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      medianResponseTime: responseTimes[Math.floor(responseTimes.length / 2)],
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
      totalRequests: this.metrics.length,
      averageTokensPerSecond: tokensPerSecond.length > 0 
        ? tokensPerSecond.reduce((a, b) => a + b, 0) / tokensPerSecond.length 
        : 0,
      peakMemoryUsage: Math.max(...this.metrics.map(m => m.memoryUsage || 0))
    }
  }

  /**
   * Reset metrics for new test run
   */
  resetMetrics() {
    this.metrics = []
  }

  /**
   * Add custom response patterns for specific test scenarios
   */
  addCustomResponses(responses: MockAIResponse[]) {
    this.responses = [...this.responses, ...responses]
  }

  /**
   * Simulate different AI service response patterns
   */
  simulateServiceType(serviceType: 'fast' | 'balanced' | 'quality' | 'slow') {
    switch (serviceType) {
      case 'fast':
        this.responses = this.responses.map(r => ({
          ...r,
          delay: Math.round(r.delay * 0.3) // 70% faster
        }))
        break
      case 'balanced':
        // Keep default delays
        break
      case 'quality':
        this.responses = this.responses.map(r => ({
          ...r,
          delay: Math.round(r.delay * 1.5), // 50% slower
          tokens: Math.round((r.tokens || 0) * 1.3) // 30% more tokens
        }))
        break
      case 'slow':
        this.responses = this.responses.map(r => ({
          ...r,
          delay: Math.round(r.delay * 2.5) // 150% slower
        }))
        break
    }
  }
}

/**
 * Mock Character Generation Service
 * Simulates character creation with AI assistance
 */
export class MockCharacterGenerator {
  private aiService: MockAIService

  constructor(aiService: MockAIService) {
    this.aiService = aiService
  }

  async generateCharacter(prompt: string): Promise<{
    character: Partial<AppSchema.Character>
    metrics: PerformanceMetrics
  }> {
    const startTime = Date.now()

    // Simulate multiple AI calls for character generation
    const [nameResponse, descResponse] = await Promise.all([
      this.aiService.generateResponse(`Generate a name for: ${prompt}`),
      this.aiService.generateResponse(`Generate a description for: ${prompt}`)
    ])

    const character: Partial<AppSchema.Character> = {
      name: nameResponse.message.split(' ')[0] || 'Generated Character',
      description: descResponse.message,
      scenario: 'A character generated for performance testing',
      greeting: 'Hello! I was generated for testing purposes.',
      sampleChat: 'User: Hi\nCharacter: Hello there!',
      persona: {
        kind: 'text',
        attributes: {}
      }
    }

    const endTime = Date.now()
    const metrics: PerformanceMetrics = {
      responseTime: endTime - startTime,
      memoryUsage: 0 // Simplified for character generation
    }

    return { character, metrics }
  }
}

/**
 * Performance Test Utilities
 */
export class PerformanceTestUtils {
  static async measureFunction<T>(
    fn: () => Promise<T>, 
    label: string
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = Date.now()
    const memoryBefore = process.memoryUsage()

    const result = await fn()

    const endTime = Date.now()
    const memoryAfter = process.memoryUsage()

    const metrics: PerformanceMetrics = {
      responseTime: endTime - startTime,
      memoryUsage: memoryAfter.heapUsed - memoryBefore.heapUsed
    }

    console.log(`${label}: ${metrics.responseTime}ms`)

    return { result, metrics }
  }

  static async runConcurrentTest<T>(
    fn: () => Promise<T>,
    concurrency: number,
    totalRequests: number,
    label: string
  ): Promise<{
    results: T[]
    metrics: {
      totalTime: number
      averageResponseTime: number
      requestsPerSecond: number
      successCount: number
      errorCount: number
    }
  }> {
    console.log(`🚀 Starting ${label}: ${totalRequests} requests with ${concurrency} concurrent`)
    
    const startTime = Date.now()
    const results: T[] = []
    const errors: Error[] = []
    const responseTimes: number[] = []

    const semaphore = Array(concurrency).fill(null)
    let requestIndex = 0

    const executeRequest = async (): Promise<void> => {
      if (requestIndex >= totalRequests) return

      requestIndex++
      const requestStart = Date.now()

      try {
        const result = await fn()
        results.push(result)
        responseTimes.push(Date.now() - requestStart)
      } catch (error) {
        errors.push(error as Error)
      }
    }

    // Run requests in batches with concurrency limit
    while (requestIndex < totalRequests) {
      const batch = semaphore.map(() => executeRequest())
      await Promise.all(batch)
    }

    const endTime = Date.now()
    const totalTime = endTime - startTime

    const metrics = {
      totalTime,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0,
      requestsPerSecond: totalRequests / (totalTime / 1000),
      successCount: results.length,
      errorCount: errors.length
    }

    console.log(`✅ ${label} completed:`)
    console.log(`   Total time: ${totalTime}ms`)
    console.log(`   Success rate: ${((results.length / totalRequests) * 100).toFixed(1)}%`)
    console.log(`   Requests/sec: ${metrics.requestsPerSecond.toFixed(1)}`)
    console.log(`   Avg response: ${metrics.averageResponseTime.toFixed(1)}ms`)

    return { results, metrics }
  }
}

// Export singleton instances for easy use in tests
export const mockAIService = new MockAIService()
export const mockCharacterGenerator = new MockCharacterGenerator(mockAIService)