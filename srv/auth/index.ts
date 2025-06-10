/**
 * Unified Authentication Service
 * 
 * This module provides a centralized service for authentication operations,
 * standardizing patterns across middleware, API endpoints, and frontend stores.
 */

import { AppSchema } from '../../common/types/schema'
import { store } from '../db'
import { verifyJwt, createAccessToken, toSafeUser } from '../db/user'
import { StatusError } from '../api/wrap'

export interface AuthContext {
  userId: string
  user: AppSchema.User
  isAdmin: boolean
  isApiKey: boolean
  scopes?: string[]
}

export interface LoginResult {
  user: AppSchema.User
  token: string
  profile: AppSchema.Profile
}

export interface AuthValidationResult {
  isValid: boolean
  context?: AuthContext
  error?: string
}

/**
 * Core Authentication Service
 */
export class AuthService {
  /**
   * Validate JWT token and return auth context
   */
  async validateJwtToken(token: string): Promise<AuthValidationResult> {
    try {
      const payload = verifyJwt(token)
      
      if (!payload?.username) {
        return { isValid: false, error: 'Invalid token payload' }
      }

      const user = await store.users.getUser((payload as any).userId)
      if (!user) {
        return { isValid: false, error: 'User not found' }
      }

      return {
        isValid: true,
        context: {
          userId: user._id,
          user,
          isAdmin: !!user.admin,
          isApiKey: false,
        }
      }
    } catch (error) {
      return { isValid: false, error: 'Token verification failed' }
    }
  }

  /**
   * Validate API key and return auth context
   */
  async validateApiKey(key: string): Promise<AuthValidationResult> {
    try {
      const access = await store.users.validateApiAccess(key)
      if (!access) {
        return { isValid: false, error: 'Invalid API key' }
      }

      return {
        isValid: true,
        context: {
          userId: access.user._id,
          user: access.user,
          isAdmin: !!access.user.admin,
          isApiKey: true,
          scopes: (access as any).scopes || [],
        }
      }
    } catch (error) {
      return { isValid: false, error: 'API key validation failed' }
    }
  }

  /**
   * Authenticate user with username/password
   */
  async authenticateUser(username: string, password: string): Promise<LoginResult | null> {
    const result = await store.users.authenticate(username.trim(), password)
    return result || null
  }

  /**
   * Register new user
   */
  async registerUser(userData: {
    handle: string
    username: string
    password: string
  }): Promise<LoginResult> {
    return await store.users.createUser(userData)
  }

  /**
   * Create access token for user
   */
  async createUserToken(username: string, user: AppSchema.User): Promise<string> {
    return await createAccessToken(username, user)
  }

  /**
   * Reset user password with code
   */
  async resetUserPassword(code: string, username: string, newPassword: string): Promise<boolean> {
    const user = await store.users.getUserByCode(code)
    
    if (!user || user.username.toLowerCase() !== username.toLowerCase().trim()) {
      return false
    }

    await store.users.resetPassword(user._id, newPassword)
    return true
  }

  /**
   * Change user password (requires auth)
   */
  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    await store.admin.changePassword({ userId, password: newPassword })
  }

  /**
   * Get safe user data for frontend
   */
  getSafeUser(user: AppSchema.User): AppSchema.User {
    return toSafeUser(user)
  }
}

/**
 * OAuth Service for external authentication providers
 */
export class OAuthService {
  /**
   * Handle Google OAuth login/linking
   */
  async handleGoogleOAuth(
    token: string,
    clientId: string,
    action: 'login' | 'link',
    existingUserId?: string
  ): Promise<LoginResult | { user: AppSchema.User }> {
    const { OAuth2Client } = await import('google-auth-library')
    const googleClient = new OAuth2Client()

    const tokenInfo = await googleClient.verifyIdToken({
      idToken: token,
      audience: clientId,
    })

    const payload = tokenInfo.getPayload()
    if (!payload?.email || !payload?.sub) {
      throw new StatusError('Could not verify Google token', 401)
    }

    if (action === 'link') {
      if (!existingUserId) {
        throw new StatusError('User ID required for linking', 400)
      }

      const user = await store.users.getUser(existingUserId)
      if (!user) {
        throw new StatusError('User not found', 404)
      }

      if (user.google?.sub) {
        throw new StatusError('Account already linked to Google', 400)
      }

      const updatedUser = await store.users.updateUser(existingUserId, { 
        google: payload as any 
      })
      
      return { user: toSafeUser(updatedUser!) }
    }

    // Login flow
    const existing = await store.users.findByGoogleSub(payload.sub)
    if (existing) {
      await store.users.updateUser(existing._id, { google: payload as any })
      const token = await createAccessToken(existing.username, existing)
      const profile = await store.users.getProfile(existing._id)
      return { user: toSafeUser(existing), token, profile: profile! }
    }

    // Create new user
    const newUser = await store.users.createUser({
      username: `google_${payload.sub}`,
      handle: payload.name || 'You',
      password: '',
    })
    
    await store.users.updateUser(newUser.user._id, { google: payload as any })
    return newUser
  }

  /**
   * Unlink Google account
   */
  async unlinkGoogleAccount(userId: string): Promise<{ user: AppSchema.User }> {
    const user = await store.users.getUser(userId)
    if (!user) {
      throw new StatusError('User not found', 404)
    }

    if (!user.google?.sub) {
      throw new StatusError('Account not linked with Google', 400)
    }

    if (`google_${user.google.sub}` === user.username) {
      throw new StatusError('Account registered using Google - Cannot be unlinked', 400)
    }

    const updatedUser = await store.users.updateUser(userId, { google: null as any })
    return { user: toSafeUser(updatedUser!) }
  }
}

/**
 * API Key Management Service
 */
export class ApiKeyService {
  /**
   * Create OAuth API key
   */
  async createApiKey(userId: string, scopes: string[], origin: string): Promise<string> {
    return await store.oauth.prepare(userId, origin, scopes as any)
  }

  /**
   * Activate OAuth key
   */
  async activateApiKey(userId: string, code: string): Promise<string> {
    return await store.oauth.activateKey(userId, code)
  }
}

// Export singleton instances
export const authService = new AuthService()
export const oauthService = new OAuthService()
export const apiKeyService = new ApiKeyService()

// Export commonly used utilities
export {
  createAccessToken,
  toSafeUser,
  verifyJwt,
} from '../db/user'