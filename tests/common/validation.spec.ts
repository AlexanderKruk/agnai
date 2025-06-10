import { expect } from 'chai'

describe('Input Validation', () => {
  describe('Username Validation', () => {
    const validateUsername = (username: string) => {
      if (!username || username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' }
      if (username.length > 20) return { valid: false, error: 'Username must be no more than 20 characters' }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) return { valid: false, error: 'Username can only contain letters, numbers, underscore, and dash' }
      return { valid: true }
    }

    it('should accept valid usernames', () => {
      const validUsernames = ['testuser', 'test_user', 'test-user', 'user123', 'User2023']
      
      validUsernames.forEach(username => {
        const result = validateUsername(username)
        expect(result.valid).to.be.true
      })
    })

    it('should reject invalid usernames', () => {
      const testCases = [
        { input: '', expectedError: 'Username must be at least 3 characters' },
        { input: 'ab', expectedError: 'Username must be at least 3 characters' },
        { input: 'a'.repeat(21), expectedError: 'Username must be no more than 20 characters' },
        { input: 'test user', expectedError: 'Username can only contain letters, numbers, underscore, and dash' },
        { input: 'test@user', expectedError: 'Username can only contain letters, numbers, underscore, and dash' },
        { input: 'test.user', expectedError: 'Username can only contain letters, numbers, underscore, and dash' },
        { input: 'test#user', expectedError: 'Username can only contain letters, numbers, underscore, and dash' },
      ]

      testCases.forEach(({ input, expectedError }) => {
        const result = validateUsername(input)
        expect(result.valid).to.be.false
        expect(result.error).to.equal(expectedError)
      })
    })
  })

  describe('Email Validation', () => {
    const validateEmail = (email: string) => {
      if (!email) return { valid: false, error: 'Email is required' }
      
      // More basic email validation for testing
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email) || email.includes('..')) {
        return { valid: false, error: 'Invalid email format' }
      }
      
      if (email.length > 254) {
        return { valid: false, error: 'Email too long' }
      }
      
      return { valid: true }
    }

    it('should accept valid emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+tag@example.org',
        'user123@test-domain.com',
        'first.last+tag@subdomain.example.com'
      ]
      
      validEmails.forEach(email => {
        const result = validateEmail(email)
        expect(result.valid).to.be.true
      })
    })

    it('should reject invalid emails', () => {
      const testCases = [
        { input: '', expectedError: 'Email is required' },
        { input: 'invalid', expectedError: 'Invalid email format' },
        { input: 'invalid@', expectedError: 'Invalid email format' },
        { input: '@example.com', expectedError: 'Invalid email format' },
        { input: 'invalid@.com', expectedError: 'Invalid email format' },
        { input: 'invalid.email', expectedError: 'Invalid email format' },
        { input: 'invalid..email@test.com', expectedError: 'Invalid email format' },
        { input: 'test@', expectedError: 'Invalid email format' },
        { input: 'test@.', expectedError: 'Invalid email format' },
      ]

      testCases.forEach(({ input, expectedError }) => {
        const result = validateEmail(input)
        expect(result.valid).to.be.false
        expect(result.error).to.equal(expectedError)
      })
    })
  })

  describe('Password Validation', () => {
    const validatePassword = (password: string) => {
      if (!password) return { valid: false, error: 'Password is required' }
      if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' }
      if (password.length > 128) return { valid: false, error: 'Password must be no more than 128 characters' }
      
      // At least one letter and one number
      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
        return { valid: false, error: 'Password must contain at least one letter and one number' }
      }
      
      return { valid: true }
    }

    it('should accept valid passwords', () => {
      const validPasswords = [
        'password123',
        'test1234',
        'MyPassword1',
        'securePass999',
        'Abcdefgh1',
        'p4ssW0rd!'
      ]
      
      validPasswords.forEach(password => {
        const result = validatePassword(password)
        expect(result.valid).to.be.true
      })
    })

    it('should reject invalid passwords', () => {
      const testCases = [
        { input: '', expectedError: 'Password is required' },
        { input: 'short1', expectedError: 'Password must be at least 8 characters' },
        { input: 'onlyletters', expectedError: 'Password must contain at least one letter and one number' },
        { input: '12345678', expectedError: 'Password must contain at least one letter and one number' },
        { input: 'a'.repeat(129), expectedError: 'Password must be no more than 128 characters' },
        { input: 'noNumber', expectedError: 'Password must contain at least one letter and one number' },
        { input: '1234567890', expectedError: 'Password must contain at least one letter and one number' },
      ]

      testCases.forEach(({ input, expectedError }) => {
        const result = validatePassword(input)
        expect(result.valid).to.be.false
        expect(result.error).to.equal(expectedError)
      })
    })
  })

  describe('Chat Message Validation', () => {
    const validateChatMessage = (message: string) => {
      if (!message || !message.trim()) {
        return { valid: false, error: 'Message cannot be empty' }
      }
      
      if (message.length > 4000) {
        return { valid: false, error: 'Message too long (max 4000 characters)' }
      }
      
      // Check for potential XSS attempts
      const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
      ]
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(message)) {
          return { valid: false, error: 'Message contains potentially unsafe content' }
        }
      }
      
      return { valid: true }
    }

    it('should accept valid messages', () => {
      const validMessages = [
        'Hello world!',
        'This is a normal chat message with punctuation.',
        'Message with numbers 123 and symbols @#$%',
        'Multi-line\nmessage\nwith breaks',
        'Émojis and unicode 🎉 characters are fine',
        'A reasonably long message that contains various characters and should pass validation without any issues.',
      ]
      
      validMessages.forEach(message => {
        const result = validateChatMessage(message)
        expect(result.valid).to.be.true
      })
    })

    it('should reject invalid messages', () => {
      const testCases = [
        { input: '', expectedError: 'Message cannot be empty' },
        { input: '   ', expectedError: 'Message cannot be empty' },
        { input: 'a'.repeat(4001), expectedError: 'Message too long (max 4000 characters)' },
        { input: '<script>alert("xss")</script>', expectedError: 'Message contains potentially unsafe content' },
        { input: 'javascript:alert("xss")', expectedError: 'Message contains potentially unsafe content' },
        { input: '<img onclick="alert(1)" src="x">', expectedError: 'Message contains potentially unsafe content' },
      ]

      testCases.forEach(({ input, expectedError }) => {
        const result = validateChatMessage(input)
        expect(result.valid).to.be.false
        expect(result.error).to.equal(expectedError)
      })
    })
  })

  describe('Character Name Validation', () => {
    const validateCharacterName = (name: string) => {
      if (!name) {
        return { valid: false, error: 'Character name is required' }
      }
      
      const trimmed = name.trim()
      if (trimmed.length < 1) {
        return { valid: false, error: 'Character name cannot be empty' }
      }
      
      if (trimmed.length > 50) {
        return { valid: false, error: 'Character name too long (max 50 characters)' }
      }
      
      // Disallow certain control characters
      if (/[\x00-\x1F\x7F]/.test(trimmed)) {
        return { valid: false, error: 'Character name contains invalid characters' }
      }
      
      return { valid: true }
    }

    it('should accept valid character names', () => {
      const validNames = [
        'Alice',
        'Bob the Builder',
        'Dr. Watson',
        'Character-123',
        'Café Owner',
        'Jean-Luc Picard',
        'お名前', // Japanese characters
        'María José',
      ]
      
      validNames.forEach(name => {
        const result = validateCharacterName(name)
        expect(result.valid).to.be.true
      })
    })

    it('should reject invalid character names', () => {
      const testCases = [
        { input: '', expectedError: 'Character name is required' },
        { input: '   ', expectedError: 'Character name cannot be empty' },
        { input: 'a'.repeat(51), expectedError: 'Character name too long (max 50 characters)' },
        { input: 'Name\u0000', expectedError: 'Character name contains invalid characters' },
        { input: 'Name\u001F', expectedError: 'Character name contains invalid characters' },
      ]

      testCases.forEach(({ input, expectedError }) => {
        const result = validateCharacterName(input)
        expect(result.valid).to.be.false
        expect(result.error).to.equal(expectedError)
      })
    })
  })
})