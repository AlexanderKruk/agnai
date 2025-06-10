import { Router } from 'express'
import { isAdmin, loggedIn } from './auth'

/**
 * Standardized Middleware Patterns
 * 
 * This module provides consistent middleware application patterns
 * to ensure security and consistency across all API routes.
 * 
 * SECURITY PRINCIPLES:
 * 1. Authentication middleware must be applied before route definitions
 * 2. Authorization middleware follows authentication
 * 3. Guest routes are explicitly marked and isolated
 * 4. All protected routes use the same middleware stack
 */

export type RouteType = 'public' | 'authenticated' | 'admin'

/**
 * Create a router with standardized middleware application
 * 
 * @param type - The type of routes this router will handle
 * @returns Router with appropriate middleware pre-applied
 */
export function createStandardRouter(type: RouteType): Router {
  const router = Router()
  
  switch (type) {
    case 'public':
      // No authentication required - for guest endpoints
      break
      
    case 'authenticated':
      // Requires user to be logged in
      router.use(loggedIn)
      break
      
    case 'admin':
      // Requires user to be logged in AND have admin privileges
      router.use(loggedIn, isAdmin)
      break
      
    default:
      throw new Error(`Unknown route type: ${type}`)
  }
  
  return router
}

/**
 * Validation schemas for common route patterns
 * 
 * These can be imported and used consistently across routes
 * to avoid duplicating validation logic.
 */
export const commonValidations = {
  id: {
    id: 'string'
  },
  
  pagination: {
    page: 'number?',
    limit: 'number?'
  },
  
  search: {
    query: 'string?',
    page: 'number?',
    limit: 'number?'
  }
} as const

/**
 * Standard response wrapper patterns
 * 
 * These ensure consistent response formats across the API.
 */
export const responsePatterns = {
  /**
   * Wrap a single entity response
   */
  single: <T>(data: T, key: string) => ({ [key]: data }),
  
  /**
   * Wrap a collection response
   */
  collection: <T>(data: T[], key: string, total?: number) => ({
    [key]: data,
    ...(total !== undefined && { total })
  }),
  
  /**
   * Wrap a success response
   */
  success: (message?: string) => ({
    success: true,
    ...(message && { message })
  }),
  
  /**
   * Wrap data with pagination info
   */
  paginated: <T>(data: T[], total: number, page: number, limit: number) => ({
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  })
}

/**
 * Helper to ensure middleware is applied in the correct order
 * 
 * @param router - The router to validate
 * @param expectedType - The expected middleware type
 */
export function validateRouterSecurity(router: Router, expectedType: RouteType): void {
  // This is primarily for development/testing to ensure proper middleware setup
  // In production, the type system and createStandardRouter should prevent issues
  
  const stack = (router as any).stack || []
  const middlewareNames = stack
    .filter((layer: any) => layer.name !== 'router')
    .map((layer: any) => layer.handle?.name || 'anonymous')
  
  switch (expectedType) {
    case 'public':
      // No required middleware
      break
      
    case 'authenticated':
      if (!middlewareNames.includes('loggedIn')) {
        console.warn('Warning: Authenticated router missing loggedIn middleware')
      }
      break
      
    case 'admin':
      if (!middlewareNames.includes('loggedIn') || !middlewareNames.includes('isAdmin')) {
        console.warn('Warning: Admin router missing required middleware (loggedIn, isAdmin)')
      }
      break
  }
}