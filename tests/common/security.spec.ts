import { expect } from 'chai'

describe('Security Functions', () => {
  describe('Input Sanitization', () => {
    const sanitizeHtml = (input: string) => {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:.*$/gi, '') // Remove full javascript: URLs
        .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^>\s]*)/gi, '') // Remove event handlers with quotes
        .replace(/data:\s*text\/html[^,]*/gi, '') // Remove data: URLs
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .replace(/\s>/g, '>') // Clean up spaces before closing tags
    }

    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello'
      const result = sanitizeHtml(input)
      expect(result).to.equal('Hello')
    })

    it('should remove javascript: URLs', () => {
      const input = 'javascript:alert("xss")'
      const result = sanitizeHtml(input)
      expect(result).to.equal('')
    })

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">content</div>'
      const result = sanitizeHtml(input)
      expect(result).to.equal('<div>content</div>')
    })

    it('should remove data URLs with HTML', () => {
      const input = 'data:text/html,<script>alert(1)</script>'
      const result = sanitizeHtml(input)
      expect(result).to.equal(',') // The data URL and content are removed
    })

    it('should preserve safe content', () => {
      const input = '<p>Safe content with <strong>formatting</strong></p>'
      const result = sanitizeHtml(input)
      expect(result).to.equal(input)
    })
  })

  describe('SQL Injection Prevention', () => {
    const escapeSqlString = (input: string) => {
      return input.replace(/'/g, "''").replace(/\\/g, '\\\\')
    }

    it('should escape single quotes', () => {
      const input = "'; DROP TABLE users; --"
      const result = escapeSqlString(input)
      expect(result).to.equal("''; DROP TABLE users; --")
    })

    it('should escape backslashes', () => {
      const input = "test\\input"
      const result = escapeSqlString(input)
      expect(result).to.equal("test\\\\input")
    })

    it('should handle normal text', () => {
      const input = "normal text"
      const result = escapeSqlString(input)
      expect(result).to.equal("normal text")
    })
  })

  describe('Path Traversal Prevention', () => {
    const sanitizePath = (path: string) => {
      return path
        .replace(/\.\.[\\/]*/g, '') // Remove path traversal attempts with optional separators
        .replace(/\.\./g, '') // Remove remaining path traversal attempts
        .replace(/^[\\/]+/, '') // Remove leading slashes
        .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
        .replace(/\0/g, '') // Remove null bytes
    }

    it('should remove path traversal sequences', () => {
      const input = '../../../etc/passwd'
      const result = sanitizePath(input)
      expect(result).to.equal('etc/passwd')
    })

    it('should remove invalid filename characters', () => {
      const input = 'file<name>with:invalid|chars?.txt'
      const result = sanitizePath(input)
      expect(result).to.equal('filenamewithinvalidchars.txt') // All invalid chars removed
    })

    it('should remove null bytes', () => {
      const input = 'file\0name.txt'
      const result = sanitizePath(input)
      expect(result).to.equal('filename.txt')
    })

    it('should preserve valid paths', () => {
      const input = 'folder/subfolder/file-name_123.txt'
      const result = sanitizePath(input)
      expect(result).to.equal('folder/subfolder/file-name_123.txt')
    })
  })

  describe('Rate Limiting Helpers', () => {
    interface RateLimitEntry {
      count: number
      resetTime: number
    }

    const createRateLimiter = (maxRequests: number, windowMs: number) => {
      const store = new Map<string, RateLimitEntry>()
      
      return {
        checkLimit: (identifier: string): { allowed: boolean; remaining: number } => {
          const now = Date.now()
          const entry = store.get(identifier)
          
          if (!entry || now > entry.resetTime) {
            store.set(identifier, { count: 1, resetTime: now + windowMs })
            return { allowed: true, remaining: maxRequests - 1 }
          }
          
          if (entry.count >= maxRequests) {
            return { allowed: false, remaining: 0 }
          }
          
          entry.count++
          return { allowed: true, remaining: maxRequests - entry.count }
        },
        reset: (identifier: string) => {
          store.delete(identifier)
        }
      }
    }

    it('should allow requests within limit', () => {
      const limiter = createRateLimiter(5, 60000)
      
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit('user1')
        expect(result.allowed).to.be.true
        expect(result.remaining).to.equal(4 - i)
      }
    })

    it('should block requests over limit', () => {
      const limiter = createRateLimiter(2, 60000)
      
      // First two requests should be allowed
      expect(limiter.checkLimit('user1').allowed).to.be.true
      expect(limiter.checkLimit('user1').allowed).to.be.true
      
      // Third request should be blocked
      expect(limiter.checkLimit('user1').allowed).to.be.false
    })

    it('should track different users separately', () => {
      const limiter = createRateLimiter(2, 60000)
      
      expect(limiter.checkLimit('user1').allowed).to.be.true
      expect(limiter.checkLimit('user2').allowed).to.be.true
      expect(limiter.checkLimit('user1').allowed).to.be.true
      expect(limiter.checkLimit('user2').allowed).to.be.true
    })

    it('should reset limits for specific users', () => {
      const limiter = createRateLimiter(1, 60000)
      
      expect(limiter.checkLimit('user1').allowed).to.be.true
      expect(limiter.checkLimit('user1').allowed).to.be.false
      
      limiter.reset('user1')
      expect(limiter.checkLimit('user1').allowed).to.be.true
    })
  })

  describe('Token Generation', () => {
    const generateSecureToken = (length: number = 32) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    }

    it('should generate tokens of correct length', () => {
      const token = generateSecureToken(16)
      expect(token).to.have.length(16)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set()
      for (let i = 0; i < 1000; i++) {
        tokens.add(generateSecureToken())
      }
      expect(tokens.size).to.equal(1000)
    })

    it('should only contain alphanumeric characters', () => {
      const token = generateSecureToken(100)
      const validChars = /^[A-Za-z0-9]+$/
      expect(validChars.test(token)).to.be.true
    })
  })

  describe('Permission Checking', () => {
    const checkPermission = (userRole: string, requiredPermission: string) => {
      const rolePermissions: Record<string, string[]> = {
        admin: ['read', 'write', 'delete', 'manage_users'],
        moderator: ['read', 'write', 'moderate'],
        user: ['read', 'write'],
        guest: ['read']
      }
      
      const permissions = rolePermissions[userRole] || []
      return permissions.includes(requiredPermission)
    }

    it('should grant admin all permissions', () => {
      expect(checkPermission('admin', 'read')).to.be.true
      expect(checkPermission('admin', 'write')).to.be.true
      expect(checkPermission('admin', 'delete')).to.be.true
      expect(checkPermission('admin', 'manage_users')).to.be.true
    })

    it('should limit user permissions', () => {
      expect(checkPermission('user', 'read')).to.be.true
      expect(checkPermission('user', 'write')).to.be.true
      expect(checkPermission('user', 'delete')).to.be.false
      expect(checkPermission('user', 'manage_users')).to.be.false
    })

    it('should limit guest permissions', () => {
      expect(checkPermission('guest', 'read')).to.be.true
      expect(checkPermission('guest', 'write')).to.be.false
      expect(checkPermission('guest', 'delete')).to.be.false
    })

    it('should deny unknown roles', () => {
      expect(checkPermission('unknown', 'read')).to.be.false
    })
  })
})