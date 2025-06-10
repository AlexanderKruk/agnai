import { expect } from 'chai'

describe('Utility Functions', () => {
  describe('Text Processing', () => {
    describe('sanitizeText', () => {
      const sanitizeText = (text: string) => {
        return text
          .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
      }

      it('should remove control characters', () => {
        const input = 'Hello\x00World\x1F'
        const result = sanitizeText(input)
        expect(result).to.equal('HelloWorld')
      })

      it('should normalize whitespace', () => {
        const input = 'Hello   \t\n  World'
        const result = sanitizeText(input)
        expect(result).to.equal('Hello World')
      })

      it('should trim leading and trailing spaces', () => {
        const input = '  Hello World  '
        const result = sanitizeText(input)
        expect(result).to.equal('Hello World')
      })
    })

    describe('truncateText', () => {
      const truncateText = (text: string, maxLength: number, suffix = '...') => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength - suffix.length) + suffix
      }

      it('should not truncate short text', () => {
        const result = truncateText('Hello', 10)
        expect(result).to.equal('Hello')
      })

      it('should truncate long text with default suffix', () => {
        const result = truncateText('This is a very long text', 10)
        expect(result).to.equal('This is...')
      })

      it('should truncate with custom suffix', () => {
        const result = truncateText('This is a very long text', 10, '…')
        expect(result).to.equal('This is a…')
      })
    })
  })

  describe('Object Utilities', () => {
    describe('deepClone', () => {
      const deepClone = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj
        if (obj instanceof Date) return new Date(obj.getTime())
        if (obj instanceof Array) return obj.map(item => deepClone(item))
        if (typeof obj === 'object') {
          const cloned: any = {}
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              cloned[key] = deepClone(obj[key])
            }
          }
          return cloned
        }
      }

      it('should clone primitive values', () => {
        expect(deepClone(42)).to.equal(42)
        expect(deepClone('hello')).to.equal('hello')
        expect(deepClone(true)).to.equal(true)
        expect(deepClone(null)).to.equal(null)
      })

      it('should clone arrays', () => {
        const original = [1, 2, { a: 3 }]
        const cloned = deepClone(original)
        
        expect(cloned).to.deep.equal(original)
        expect(cloned).to.not.equal(original)
        expect(cloned[2]).to.not.equal(original[2])
      })

      it('should clone objects', () => {
        const original = { a: 1, b: { c: 2 } }
        const cloned = deepClone(original)
        
        expect(cloned).to.deep.equal(original)
        expect(cloned).to.not.equal(original)
        expect(cloned.b).to.not.equal(original.b)
      })

      it('should clone dates', () => {
        const original = new Date('2023-01-01')
        const cloned = deepClone(original)
        
        expect(cloned.getTime()).to.equal(original.getTime())
        expect(cloned).to.not.equal(original)
      })
    })

    describe('mergeObjects', () => {
      const mergeObjects = (target: any, source: any): any => {
        const result = { ...target }
        for (const key in source) {
          if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              result[key] = mergeObjects(target[key] || {}, source[key])
            } else {
              result[key] = source[key]
            }
          }
        }
        return result
      }

      it('should merge simple objects', () => {
        const target = { a: 1, b: 2 }
        const source = { b: 3, c: 4 }
        const result = mergeObjects(target, source)
        
        expect(result).to.deep.equal({ a: 1, b: 3, c: 4 })
      })

      it('should merge nested objects', () => {
        const target = { a: { x: 1, y: 2 } }
        const source = { a: { y: 3, z: 4 } }
        const result = mergeObjects(target, source)
        
        expect(result).to.deep.equal({ a: { x: 1, y: 3, z: 4 } })
      })

      it('should not mutate original objects', () => {
        const target = { a: 1 }
        const source = { b: 2 }
        const result = mergeObjects(target, source)
        
        expect(target).to.deep.equal({ a: 1 })
        expect(source).to.deep.equal({ b: 2 })
        expect(result).to.deep.equal({ a: 1, b: 2 })
      })
    })
  })

  describe('Array Utilities', () => {
    describe('unique', () => {
      const unique = <T>(array: T[]): T[] => {
        return [...new Set(array)]
      }

      it('should remove duplicate primitives', () => {
        const input = [1, 2, 2, 3, 1, 4]
        const result = unique(input)
        expect(result).to.deep.equal([1, 2, 3, 4])
      })

      it('should remove duplicate strings', () => {
        const input = ['a', 'b', 'a', 'c', 'b']
        const result = unique(input)
        expect(result).to.deep.equal(['a', 'b', 'c'])
      })

      it('should preserve order of first occurrence', () => {
        const input = [3, 1, 2, 1, 3]
        const result = unique(input)
        expect(result).to.deep.equal([3, 1, 2])
      })
    })

    describe('chunk', () => {
      const chunk = <T>(array: T[], size: number): T[][] => {
        const chunks: T[][] = []
        for (let i = 0; i < array.length; i += size) {
          chunks.push(array.slice(i, i + size))
        }
        return chunks
      }

      it('should split array into chunks', () => {
        const input = [1, 2, 3, 4, 5, 6]
        const result = chunk(input, 2)
        expect(result).to.deep.equal([[1, 2], [3, 4], [5, 6]])
      })

      it('should handle uneven chunks', () => {
        const input = [1, 2, 3, 4, 5]
        const result = chunk(input, 2)
        expect(result).to.deep.equal([[1, 2], [3, 4], [5]])
      })

      it('should handle empty array', () => {
        const input: number[] = []
        const result = chunk(input, 2)
        expect(result).to.deep.equal([])
      })
    })
  })

  describe('ID Generation', () => {
    describe('generateId', () => {
      const generateId = (prefix = '', length = 8) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = prefix
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
      }

      it('should generate IDs of correct length', () => {
        const id = generateId('', 10)
        expect(id).to.have.length(10)
      })

      it('should include prefix', () => {
        const id = generateId('user_', 8)
        expect(id).to.have.length(13) // 5 (prefix) + 8 (random)
        expect(id.startsWith('user_')).to.be.true
      })

      it('should generate unique IDs', () => {
        const ids = new Set()
        for (let i = 0; i < 1000; i++) {
          ids.add(generateId())
        }
        expect(ids.size).to.equal(1000) // All should be unique
      })

      it('should only contain valid characters', () => {
        const id = generateId('', 100)
        const validChars = /^[a-zA-Z0-9]+$/
        expect(validChars.test(id)).to.be.true
      })
    })
  })

  describe('Date Utilities', () => {
    describe('formatTimestamp', () => {
      const formatTimestamp = (date: Date | string, format = 'iso') => {
        const d = typeof date === 'string' ? new Date(date) : date
        
        switch (format) {
          case 'iso':
            return d.toISOString()
          case 'human':
            return d.toLocaleString()
          case 'date':
            return d.toLocaleDateString()
          case 'time':
            return d.toLocaleTimeString()
          default:
            return d.toString()
        }
      }

      it('should format as ISO string', () => {
        const date = new Date('2023-01-01T12:00:00Z')
        const result = formatTimestamp(date, 'iso')
        expect(result).to.equal('2023-01-01T12:00:00.000Z')
      })

      it('should handle string dates', () => {
        const result = formatTimestamp('2023-01-01T12:00:00Z', 'iso')
        expect(result).to.equal('2023-01-01T12:00:00.000Z')
      })

      it('should default to ISO format', () => {
        const date = new Date('2023-01-01T12:00:00Z')
        const result = formatTimestamp(date)
        expect(result).to.equal('2023-01-01T12:00:00.000Z')
      })
    })
  })
})