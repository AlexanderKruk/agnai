import { expect } from 'chai'

describe('Prompt Utilities', () => {
  describe('Token Counting', () => {
    // Simplified token counting for testing
    const countTokens = (text: string) => {
      // Rough approximation: 1 token ≈ 4 characters for English text
      return Math.ceil(text.length / 4)
    }

    it('should count tokens in simple text', () => {
      const text = 'Hello world'
      const count = countTokens(text)
      expect(count).to.equal(3) // 11 chars / 4 = 2.75 → 3
    })

    it('should count tokens in longer text', () => {
      const text = 'This is a longer piece of text that should result in more tokens'
      const count = countTokens(text)
      expect(count).to.be.greaterThan(10)
    })

    it('should handle empty text', () => {
      const count = countTokens('')
      expect(count).to.equal(0)
    })
  })

  describe('Text Truncation', () => {
    const truncateToTokenLimit = (text: string, maxTokens: number) => {
      const estimatedTokens = Math.ceil(text.length / 4)
      if (estimatedTokens <= maxTokens) return text
      
      const maxChars = maxTokens * 4
      return text.substring(0, maxChars) + '...'
    }

    it('should not truncate text under limit', () => {
      const text = 'Short text'
      const result = truncateToTokenLimit(text, 100)
      expect(result).to.equal(text)
    })

    it('should truncate text over limit', () => {
      const text = 'This is a very long piece of text that exceeds the token limit'
      const result = truncateToTokenLimit(text, 5) // 5 tokens = ~20 chars
      expect(result).to.have.length.lessThan(text.length)
      expect(result.endsWith('...')).to.be.true
    })
  })

  describe('Placeholder Replacement', () => {
    const replacePlaceholders = (template: string, values: Record<string, string>) => {
      let result = template
      for (const [key, value] of Object.entries(values)) {
        const placeholder = `{{${key}}}`
        result = result.replace(new RegExp(placeholder, 'gi'), value)
      }
      return result
    }

    it('should replace single placeholder', () => {
      const template = 'Hello {{name}}!'
      const result = replacePlaceholders(template, { name: 'Alice' })
      expect(result).to.equal('Hello Alice!')
    })

    it('should replace multiple placeholders', () => {
      const template = '{{user}} says: "{{message}}"'
      const result = replacePlaceholders(template, { 
        user: 'Bob', 
        message: 'Hello world' 
      })
      expect(result).to.equal('Bob says: "Hello world"')
    })

    it('should handle case insensitive placeholders', () => {
      const template = 'Hello {{NAME}}!'
      const result = replacePlaceholders(template, { name: 'Charlie' })
      expect(result).to.equal('Hello Charlie!')
    })

    it('should handle missing placeholders', () => {
      const template = 'Hello {{name}}! How is {{weather}}?'
      const result = replacePlaceholders(template, { name: 'Dave' })
      expect(result).to.equal('Hello Dave! How is {{weather}}?')
    })

    it('should handle repeated placeholders', () => {
      const template = '{{name}} and {{name}} are friends'
      const result = replacePlaceholders(template, { name: 'Eve' })
      expect(result).to.equal('Eve and Eve are friends')
    })
  })

  describe('Context Window Management', () => {
    interface Message {
      role: 'user' | 'assistant' | 'system'
      content: string
      tokens?: number
    }

    const fitMessagesInContext = (messages: Message[], maxTokens: number) => {
      const messagesWithTokens = messages.map(msg => ({
        ...msg,
        tokens: msg.tokens || Math.ceil(msg.content.length / 4)
      }))

      let totalTokens = 0
      const result: Message[] = []

      // Always include system messages first
      const systemMessages = messagesWithTokens.filter(m => m.role === 'system')
      for (const msg of systemMessages) {
        if (totalTokens + msg.tokens! <= maxTokens) {
          result.push(msg)
          totalTokens += msg.tokens!
        }
      }

      // Add recent messages in reverse order
      const nonSystemMessages = messagesWithTokens
        .filter(m => m.role !== 'system')
        .reverse()

      for (const msg of nonSystemMessages) {
        if (totalTokens + msg.tokens! <= maxTokens) {
          result.unshift(msg)
          totalTokens += msg.tokens!
        } else {
          break
        }
      }

      return result
    }

    it('should fit all messages when under limit', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]
      
      const result = fitMessagesInContext(messages, 100)
      expect(result).to.have.length(3)
    })

    it('should prioritize system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'Very long user message that takes many tokens' },
        { role: 'assistant', content: 'Response' }
      ]
      
      const result = fitMessagesInContext(messages, 10) // Very low limit
      expect(result.some(m => m.role === 'system')).to.be.true
    })

    it('should include recent messages first', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Old message' },
        { role: 'assistant', content: 'Old response' },
        { role: 'user', content: 'Recent message' },
        { role: 'assistant', content: 'Recent response' }
      ]
      
      const result = fitMessagesInContext(messages, 15) // Limited tokens
      const contents = result.map(m => m.content)
      expect(contents.includes('Recent message')).to.be.true
      expect(contents.includes('Recent response')).to.be.true
    })
  })

  describe('Prompt Assembly', () => {
    const assemblePrompt = (parts: {
      system?: string
      context?: string
      history?: string[]
      userMessage?: string
    }) => {
      const sections: string[] = []
      
      if (parts.system) {
        sections.push(`System: ${parts.system}`)
      }
      
      if (parts.context) {
        sections.push(`Context: ${parts.context}`)
      }
      
      if (parts.history && parts.history.length > 0) {
        sections.push('History:')
        sections.push(...parts.history)
      }
      
      if (parts.userMessage) {
        sections.push(`User: ${parts.userMessage}`)
      }
      
      return sections.join('\n\n')
    }

    it('should assemble basic prompt', () => {
      const result = assemblePrompt({
        system: 'You are helpful',
        userMessage: 'Hello'
      })
      
      expect(result).to.include('System: You are helpful')
      expect(result).to.include('User: Hello')
    })

    it('should include context when provided', () => {
      const result = assemblePrompt({
        system: 'You are helpful',
        context: 'This is context information',
        userMessage: 'Hello'
      })
      
      expect(result).to.include('Context: This is context information')
    })

    it('should include history when provided', () => {
      const result = assemblePrompt({
        system: 'You are helpful',
        history: ['User: Hi', 'Assistant: Hello!'],
        userMessage: 'How are you?'
      })
      
      expect(result).to.include('History:')
      expect(result).to.include('User: Hi')
      expect(result).to.include('Assistant: Hello!')
    })

    it('should handle empty parts gracefully', () => {
      const result = assemblePrompt({
        userMessage: 'Hello'
      })
      
      expect(result).to.equal('User: Hello')
    })
  })

  describe('Memory Retrieval Simulation', () => {
    interface MemoryEntry {
      id: string
      content: string
      keywords: string[]
      weight: number
    }

    const retrieveRelevantMemories = (
      memories: MemoryEntry[], 
      query: string, 
      maxEntries: number = 5
    ) => {
      const queryWords = query.toLowerCase().split(' ')
      
      const scored = memories.map(memory => {
        let score = memory.weight
        
        // Increase score for keyword matches
        for (const keyword of memory.keywords) {
          if (queryWords.some(word => keyword.toLowerCase().includes(word))) {
            score += 10
          }
        }
        
        // Increase score for content matches
        for (const word of queryWords) {
          if (memory.content.toLowerCase().includes(word)) {
            score += 5
          }
        }
        
        return { ...memory, score }
      })
      
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, maxEntries)
    }

    it('should retrieve memories based on keyword match', () => {
      const memories: MemoryEntry[] = [
        { id: '1', content: 'Alice likes cats', keywords: ['alice', 'cats'], weight: 1 },
        { id: '2', content: 'Bob likes dogs', keywords: ['bob', 'dogs'], weight: 1 },
        { id: '3', content: 'Charlie likes birds', keywords: ['charlie', 'birds'], weight: 1 }
      ]
      
      const result = retrieveRelevantMemories(memories, 'alice pets', 2)
      expect(result[0].id).to.equal('1')
    })

    it('should respect weight priority', () => {
      const memories: MemoryEntry[] = [
        { id: '1', content: 'Low priority', keywords: ['test'], weight: 1 },
        { id: '2', content: 'High priority', keywords: ['test'], weight: 10 }
      ]
      
      const result = retrieveRelevantMemories(memories, 'test')
      expect(result[0].id).to.equal('2')
    })

    it('should limit results to maxEntries', () => {
      const memories: MemoryEntry[] = Array.from({ length: 10 }, (_, i) => ({
        id: i.toString(),
        content: `Memory ${i}`,
        keywords: ['common'],
        weight: 1
      }))
      
      const result = retrieveRelevantMemories(memories, 'common', 3)
      expect(result).to.have.length(3)
    })
  })
})