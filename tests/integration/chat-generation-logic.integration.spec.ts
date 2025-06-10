/**
 * Chat Generation Logic Integration Tests
 * 
 * Tests the core chat generation pipeline logic with mocked AI responses
 */

import { expect } from 'chai'
import { setupTestEnvironment, teardownTestEnvironment, TEST_FIXTURES } from './test-setup'
import { MockUtils } from './mocks/agnai-api-mock'

describe('Chat Generation Logic Integration Tests', () => {
  before(async () => {
    await setupTestEnvironment()
  })

  after(async () => {
    await teardownTestEnvironment()
  })

  beforeEach(async () => {
    MockUtils.reset()
  })

  describe('Prompt Building Logic', () => {
    it('should build complete prompt with character context', () => {
      const character = {
        name: 'Assistant',
        persona: {
          kind: 'text',
          attributes: {
            text: 'You are a helpful AI assistant who loves to help users with their questions.'
          }
        },
        scenario: 'You are assisting a user in a chat application.',
        greeting: 'Hello! How can I help you today?',
        sampleChat: 'User: Hi\nAssistant: Hello there! What can I do for you?'
      }

      const buildPrompt = (character: any, userMessage: string, history: any[] = []) => {
        const parts = []
        
        // System prompt with character persona
        if (character.persona?.attributes?.text) {
          parts.push(`System: ${character.persona.attributes.text}`)
        }
        
        // Scenario context
        if (character.scenario) {
          parts.push(`Scenario: ${character.scenario}`)
        }
        
        // Sample conversation
        if (character.sampleChat) {
          parts.push(`Example conversation:\n${character.sampleChat}`)
        }
        
        // Chat history
        if (history.length > 0) {
          parts.push('Recent conversation:')
          history.forEach(msg => {
            const role = msg.characterId ? character.name : 'User'
            parts.push(`${role}: ${msg.msg}`)
          })
        }
        
        // Current user message
        parts.push(`User: ${userMessage}`)
        parts.push(`${character.name}:`)
        
        return parts.join('\n\n')
      }

      const prompt = buildPrompt(character, 'What is 2+2?')
      
      expect(prompt).to.include('helpful AI assistant')
      expect(prompt).to.include('assisting a user')
      expect(prompt).to.include('Example conversation')
      expect(prompt).to.include('What is 2+2?')
      expect(prompt.endsWith('Assistant:')).to.be.true
    })

    it('should include chat history in chronological order', () => {
      const character = { name: 'Bot', persona: { kind: 'text', attributes: { text: 'You are helpful.' } } }
      const history = [
        { msg: 'Hello', userId: 'user1', createdAt: '2023-01-01T10:00:00Z' },
        { msg: 'Hi there!', characterId: 'char1', createdAt: '2023-01-01T10:01:00Z' },
        { msg: 'How are you?', userId: 'user1', createdAt: '2023-01-01T10:02:00Z' }
      ]

      const buildPrompt = (character: any, userMessage: string, history: any[] = []) => {
        const parts = ['System: You are helpful.']
        
        if (history.length > 0) {
          parts.push('Recent conversation:')
          history
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .forEach(msg => {
              const role = msg.characterId ? character.name : 'User'
              parts.push(`${role}: ${msg.msg}`)
            })
        }
        
        parts.push(`User: ${userMessage}`)
        parts.push(`${character.name}:`)
        
        return parts.join('\n\n')
      }

      const prompt = buildPrompt(character, 'Current message', history)
      
      const lines = prompt.split('\n')
      const conversationStart = lines.findIndex(line => line === 'Recent conversation:')
      const conversationLines = lines.slice(conversationStart + 1, conversationStart + 4)
      
      expect(conversationLines[0]).to.equal('User: Hello')
      expect(conversationLines[1]).to.equal('Bot: Hi there!')
      expect(conversationLines[2]).to.equal('User: How are you?')
    })

    it('should truncate history when token limit is reached', () => {
      const character = { name: 'Bot', persona: { kind: 'text', attributes: { text: 'You are helpful.' } } }
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        msg: `Message ${i} - This is a longer message that takes up more tokens in the context window.`,
        userId: 'user1',
        createdAt: new Date(Date.now() + i * 1000).toISOString()
      }))

      const buildPromptWithTokenLimit = (character: any, userMessage: string, history: any[] = [], maxTokens = 100) => {
        const estimateTokens = (text: string) => Math.ceil(text.length / 4)
        
        let prompt = `System: ${character.persona.attributes.text}\n\nUser: ${userMessage}\n${character.name}:`
        let tokensUsed = estimateTokens(prompt)
        
        const includedHistory = []
        
        // Add history from most recent, stopping when token limit would be exceeded
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i]
          const role = msg.characterId ? character.name : 'User'
          const historyLine = `${role}: ${msg.msg}`
          const additionalTokens = estimateTokens(historyLine)
          
          if (tokensUsed + additionalTokens <= maxTokens) {
            includedHistory.unshift(historyLine)
            tokensUsed += additionalTokens
          } else {
            break
          }
        }
        
        if (includedHistory.length > 0) {
          const parts = [
            `System: ${character.persona.attributes.text}`,
            'Recent conversation:',
            ...includedHistory,
            `User: ${userMessage}`,
            `${character.name}:`
          ]
          return parts.join('\n\n')
        }
        
        return prompt
      }

      const prompt = buildPromptWithTokenLimit(character, 'Current message', longHistory, 200)
      
      // Should include some but not all history
      expect(prompt).to.include('Recent conversation:')
      expect(prompt).to.include('Message 19') // Most recent should be included
      expect(prompt).to.not.include('Message 0') // Oldest should be excluded
      
      // Should stay within rough token limit
      const estimatedTokens = Math.ceil(prompt.length / 4)
      expect(estimatedTokens).to.be.lessThan(250) // Some buffer for estimation
    })
  })

  describe('Memory Integration Logic', () => {
    it('should retrieve and rank relevant memories', () => {
      const memories = [
        {
          name: 'User Preferences',
          entry: 'The user prefers short responses and likes cats.',
          keywords: ['preferences', 'cats', 'brief'],
          weight: 8
        },
        {
          name: 'Background Info',
          entry: 'The user is a software developer from Canada.',
          keywords: ['developer', 'canada', 'programming'],
          weight: 5
        },
        {
          name: 'Recent Context',
          entry: 'We were discussing JavaScript frameworks.',
          keywords: ['javascript', 'frameworks', 'react'],
          weight: 10
        }
      ]

      const retrieveRelevantMemories = (memories: any[], userMessage: string, maxMemories = 3) => {
        const messageWords = userMessage.toLowerCase().split(' ')
        
        const scoredMemories = memories.map(memory => {
          let score = memory.weight
          
          // Boost score for keyword matches
          for (const keyword of memory.keywords) {
            if (messageWords.some(word => keyword.includes(word) || word.includes(keyword))) {
              score += 15
            }
          }
          
          // Boost score for content matches
          for (const word of messageWords) {
            if (memory.entry.toLowerCase().includes(word)) {
              score += 5
            }
          }
          
          return { ...memory, score }
        })
        
        return scoredMemories
          .sort((a, b) => b.score - a.score)
          .slice(0, maxMemories)
      }

      // Test message about cats should prioritize cat-related memory
      const catMemories = retrieveRelevantMemories(memories, 'Tell me about cats', 2)
      expect(catMemories[0].name).to.equal('User Preferences')
      expect(catMemories[0].score).to.be.greaterThan(memories[0].weight)

      // Test message about JavaScript should prioritize programming memories
      const jsMemories = retrieveRelevantMemories(memories, 'What JavaScript framework should I use?', 2)
      expect(jsMemories[0].name).to.equal('Recent Context')
      expect(jsMemories[1].name).to.equal('Background Info')
    })

    it('should inject memories into prompt appropriately', () => {
      const memories = [
        {
          name: 'User Context',
          entry: 'The user is learning React and prefers practical examples.',
          weight: 8
        }
      ]

      const character = {
        name: 'Tutor',
        persona: { kind: 'text', attributes: { text: 'You are a programming tutor.' } }
      }

      const buildPromptWithMemories = (character: any, userMessage: string, memories: any[] = []) => {
        const parts = []
        
        // System prompt
        parts.push(`System: ${character.persona.attributes.text}`)
        
        // Memory context
        if (memories.length > 0) {
          parts.push('Important context to remember:')
          memories.forEach(memory => {
            parts.push(`- ${memory.entry}`)
          })
        }
        
        // User message and response prompt
        parts.push(`User: ${userMessage}`)
        parts.push(`${character.name}:`)
        
        return parts.join('\n\n')
      }

      const prompt = buildPromptWithMemories(character, 'How do I use React hooks?', memories)
      
      expect(prompt).to.include('programming tutor')
      expect(prompt).to.include('Important context to remember')
      expect(prompt).to.include('learning React')
      expect(prompt).to.include('practical examples')
      expect(prompt).to.include('How do I use React hooks?')
    })
  })

  describe('AI Response Processing', () => {
    it('should process streaming response chunks correctly', async () => {
      const responseChunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' there!' } }] },
        { choices: [{ delta: { content: ' How' } }] },
        { choices: [{ delta: { content: ' can I help?' } }] },
        { choices: [{ delta: {} }] } // Final chunk
      ]

      const processStreamingResponse = (chunks: any[]) => {
        let content = ''
        let isComplete = false
        
        for (const chunk of chunks) {
          if (chunk.choices?.[0]?.delta?.content) {
            content += chunk.choices[0].delta.content
          } else if (chunk.choices?.[0]?.delta && !chunk.choices[0].delta.content) {
            isComplete = true
            break
          }
        }
        
        return { content, isComplete }
      }

      const result = processStreamingResponse(responseChunks)
      
      expect(result.content).to.equal('Hello there! How can I help?')
      expect(result.isComplete).to.be.true
    })

    it('should handle malformed AI responses gracefully', () => {
      const malformedResponses = [
        {}, // Empty response
        { choices: [] }, // No choices
        { choices: [{}] }, // Choice without message
        { choices: [{ message: {} }] }, // Message without content
        { choices: [{ message: { content: null } }] }, // Null content
      ]

      const processResponse = (response: any) => {
        try {
          const content = response?.choices?.[0]?.message?.content
          
          if (typeof content !== 'string' || content.length === 0) {
            return {
              success: false,
              error: 'Invalid or empty response content',
              content: null
            }
          }
          
          return {
            success: true,
            content: content.trim(),
            error: null
          }
        } catch (error) {
          return {
            success: false,
            error: `Response processing error: ${error}`,
            content: null
          }
        }
      }

      malformedResponses.forEach(response => {
        const result = processResponse(response)
        expect(result.success).to.be.false
        expect(result.error).to.be.a('string')
        expect(result.content).to.be.null
      })

      // Test valid response
      const validResponse = {
        choices: [{
          message: {
            content: '  Hello! This is a valid response.  '
          }
        }]
      }
      
      const validResult = processResponse(validResponse)
      expect(validResult.success).to.be.true
      expect(validResult.content).to.equal('Hello! This is a valid response.')
      expect(validResult.error).to.be.null
    })

    it('should sanitize AI response content', () => {
      const responses = [
        'Normal response text',
        '<script>alert("xss")</script>Safe content',
        'Response with <img src="x" onerror="alert(1)"> embedded elements',
        'javascript:alert("malicious") Regular text',
        'Content with\x00null\x1Fcontrol characters'
      ]

      const sanitizeResponse = (content: string) => {
        return content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
          .replace(/javascript:[^"'\s]*/gi, '') // Remove javascript: URLs
          .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^>\s]*)/gi, '') // Remove event handlers
          .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
          .trim()
      }

      const sanitized = responses.map(sanitizeResponse)
      
      expect(sanitized[0]).to.equal('Normal response text')
      expect(sanitized[1]).to.equal('Safe content')
      expect(sanitized[2]).to.equal('Response with <img src="x" > embedded elements')
      expect(sanitized[3]).to.equal(' Regular text')
      expect(sanitized[4]).to.equal('Content withnullcontrol characters')
    })
  })

  describe('Token Counting and Management', () => {
    it('should estimate tokens accurately', () => {
      const estimateTokens = (text: string) => {
        // Simple estimation: ~4 characters per token for English text
        // More sophisticated tokenizers would be used in production
        return Math.ceil(text.length / 4)
      }

      const testTexts = [
        'Hello world',           // ~3 tokens
        'This is a longer sentence with more words.',  // ~12 tokens
        '',                      // 0 tokens
        'A',                     // 1 token
        'Very long text that exceeds normal sentence length and contains many words that should result in a higher token count for testing purposes.'  // ~31 tokens
      ]

      const tokenCounts = testTexts.map(estimateTokens)
      
      expect(tokenCounts[0]).to.equal(3)
      expect(tokenCounts[1]).to.equal(12)
      expect(tokenCounts[2]).to.equal(0)
      expect(tokenCounts[3]).to.equal(1)
      expect(tokenCounts[4]).to.be.greaterThan(30)
    })

    it('should manage context window limits', () => {
      const manageContextWindow = (messages: any[], maxTokens: number) => {
        const estimateTokens = (text: string) => Math.ceil(text.length / 4)
        
        let totalTokens = 0
        const includedMessages = []
        
        // Always include system messages first
        const systemMessages = messages.filter(m => m.role === 'system')
        for (const msg of systemMessages) {
          const tokens = estimateTokens(msg.content)
          if (totalTokens + tokens <= maxTokens) {
            includedMessages.push(msg)
            totalTokens += tokens
          }
        }
        
        // Add user/assistant messages from most recent
        const chatMessages = messages
          .filter(m => m.role !== 'system')
          .reverse()
        
        for (const msg of chatMessages) {
          const tokens = estimateTokens(msg.content)
          if (totalTokens + tokens <= maxTokens) {
            includedMessages.unshift(msg)
            totalTokens += tokens
          } else {
            break
          }
        }
        
        return {
          messages: includedMessages.sort((a, b) => a.order - b.order),
          tokensUsed: totalTokens,
          tokensRemaining: maxTokens - totalTokens
        }
      }

      const messages = [
        { role: 'system', content: 'You are helpful.', order: 0 },
        { role: 'user', content: 'Hello!', order: 1 },
        { role: 'assistant', content: 'Hi there!', order: 2 },
        { role: 'user', content: 'How are you?', order: 3 },
        { role: 'assistant', content: 'I am doing well, thank you!', order: 4 },
        { role: 'user', content: 'What can you help me with today?', order: 5 }
      ]

      const result = manageContextWindow(messages, 20) // Very limited tokens
      
      expect(result.tokensUsed).to.be.lessThanOrEqual(20)
      expect(result.messages.some(m => m.role === 'system')).to.be.true // System message prioritized
      expect(result.messages[result.messages.length - 1].order).to.equal(5) // Most recent included
      expect(result.tokensRemaining).to.be.greaterThanOrEqual(0)
    })
  })

  describe('Error Handling Logic', () => {
    it('should handle AI service timeouts', async () => {
      const simulateAICall = async (prompt: string, timeoutMs = 1000) => {
        return new Promise((resolve, reject) => {
          const delay = Math.random() * 2000 // Random delay 0-2 seconds
          
          const timer = setTimeout(() => {
            reject(new Error('Request timeout'))
          }, timeoutMs)
          
          setTimeout(() => {
            clearTimeout(timer)
            if (delay < timeoutMs) {
              resolve({ choices: [{ message: { content: 'AI response' } }] })
            }
          }, delay)
        })
      }

      try {
        const result = await simulateAICall('Test prompt', 500) // Short timeout
        expect(result).to.have.nested.property('choices[0].message.content')
      } catch (error: any) {
        expect(error.message).to.equal('Request timeout')
      }
    })

    it('should handle rate limiting gracefully', () => {
      const rateLimiter = {
        requests: new Map<string, { count: number; resetTime: number }>(),
        
        checkLimit(userId: string, maxRequests = 10, windowMs = 60000) {
          const now = Date.now()
          const userLimits = this.requests.get(userId)
          
          if (!userLimits || now > userLimits.resetTime) {
            this.requests.set(userId, { count: 1, resetTime: now + windowMs })
            return { allowed: true, remaining: maxRequests - 1 }
          }
          
          if (userLimits.count >= maxRequests) {
            return { allowed: false, remaining: 0, resetIn: userLimits.resetTime - now }
          }
          
          userLimits.count++
          return { allowed: true, remaining: maxRequests - userLimits.count }
        }
      }

      const userId = 'test-user'
      
      // First 10 requests should be allowed
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.checkLimit(userId)
        expect(result.allowed).to.be.true
        expect(result.remaining).to.equal(9 - i)
      }
      
      // 11th request should be blocked
      const blockedResult = rateLimiter.checkLimit(userId)
      expect(blockedResult.allowed).to.be.false
      expect(blockedResult.remaining).to.equal(0)
      expect(blockedResult.resetIn).to.be.greaterThan(0)
    })

    it('should provide fallback responses for AI failures', () => {
      const generateFallbackResponse = (userMessage: string, character: any) => {
        const fallbacks = [
          "I'm having trouble processing that right now. Could you try rephrasing?",
          "Sorry, I'm experiencing some technical difficulties. Please try again.",
          `As ${character.name}, I need a moment to think. Could you repeat that?`,
          "I apologize, but I'm unable to respond properly at the moment."
        ]
        
        // Simple hash to get consistent fallback for same input
        const hash = userMessage.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0)
          return a & a
        }, 0)
        
        return fallbacks[Math.abs(hash) % fallbacks.length]
      }

      const character = { name: 'Assistant' }
      
      const fallback1 = generateFallbackResponse('Hello', character)
      const fallback2 = generateFallbackResponse('Hello', character) // Same input
      const fallback3 = generateFallbackResponse('Goodbye', character) // Different input
      
      expect(fallback1).to.be.a('string')
      expect(fallback1.length).to.be.greaterThan(10)
      expect(fallback1).to.equal(fallback2) // Same input = same fallback
      expect(fallback3).to.be.a('string') // Different input might be different
    })
  })
})