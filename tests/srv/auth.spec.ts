import { expect } from 'chai'
import jwt from 'jsonwebtoken'

describe('Authentication', () => {
  const testSecret = 'test-secret-key'
  const originalJwtSecret = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = testSecret
  })

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret
  })

  describe('JWT Token Validation (Isolated)', () => {
    // Simple JWT verification logic for testing
    const simpleVerifyJwt = (token: string) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback')
        return decoded
      } catch {
        return null
      }
    }

    it('should verify a valid JWT token', () => {
      const payload = { userId: 'test-user-id', username: 'testuser' }
      const token = jwt.sign(payload, testSecret, { expiresIn: '1h' })

      const result = simpleVerifyJwt(token)
      
      expect(result).to.not.be.null
      expect((result as any).userId).to.equal(payload.userId)
      expect((result as any).username).to.equal(payload.username)
    })

    it('should reject an invalid JWT token', () => {
      const invalidToken = 'invalid.token.here'

      const result = simpleVerifyJwt(invalidToken)
      
      expect(result).to.be.null
    })

    it('should reject an expired JWT token', () => {
      const payload = { userId: 'test-user-id', username: 'testuser' }
      const expiredToken = jwt.sign(payload, testSecret, { expiresIn: '-1h' })

      const result = simpleVerifyJwt(expiredToken)
      
      expect(result).to.be.null
    })

    it('should reject a token signed with wrong secret', () => {
      const payload = { userId: 'test-user-id', username: 'testuser' }
      const wrongSecretToken = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' })

      const result = simpleVerifyJwt(wrongSecretToken)
      
      expect(result).to.be.null
    })

    it('should handle malformed tokens gracefully', () => {
      const malformedTokens = [
        '',
        'not-a-token',
        'header.payload', // missing signature
        'header.payload.signature.extra', // too many parts
      ]

      malformedTokens.forEach(token => {
        const result = simpleVerifyJwt(token)
        expect(result).to.be.null
      })
    })
  })

  describe('JWT Token Generation', () => {
    it('should generate valid tokens', () => {
      const payload = { userId: 'test-user', username: 'testuser' }
      const token = jwt.sign(payload, testSecret, { expiresIn: '1h' })
      
      expect(token).to.be.a('string')
      expect(token.split('.')).to.have.length(3) // header.payload.signature
    })

    it('should include payload data in token', () => {
      const payload = { userId: 'test-user', username: 'testuser', admin: false }
      const token = jwt.sign(payload, testSecret, { expiresIn: '1h' })
      const decoded = jwt.verify(token, testSecret) as any
      
      expect(decoded.userId).to.equal(payload.userId)
      expect(decoded.username).to.equal(payload.username)
      expect(decoded.admin).to.equal(payload.admin)
    })
  })
})