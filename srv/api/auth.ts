import { NextFunction } from 'express'
import { AppRequest, errors } from './wrap'
import { authService } from '../auth'

export const loggedIn: any = (req: AppRequest, _: any, next: NextFunction) => {
  if (!req.user?.userId) return next(errors.Unauthorized)
  next()
}

export const isAdmin: any = (req: AppRequest, _: any, next: NextFunction) => {
  if (!req.user?.admin) return next(errors.Forbidden)
  next()
}

export const apiKeyUsage: any = async (req: AppRequest, _: any, next: NextFunction) => {
  let key = req.get('x-api-key') || req.get('authorization')
  if (!key) {
    return next(errors.Unauthorized)
  }

  key = key.replace('Bearer ', '')

  // Try JWT token first
  const jwtResult = await authService.validateJwtToken(key)
  if (jwtResult.isValid && jwtResult.context) {
    const { context } = jwtResult
    req.userId = context.userId
    req.authed = context.user
    req.log.setBindings({ user: context.user.username || 'anonymous' })
    return next()
  }

  // Try API key
  const apiKeyResult = await authService.validateApiKey(key)
  if (!apiKeyResult.isValid || !apiKeyResult.context) {
    return next(errors.Unauthorized)
  }

  const { context } = apiKeyResult
  req.userId = context.userId

  req.user = {
    admin: context.user.admin,
    exp: Infinity,
    iat: 0,
    userId: context.user._id,
    username: context.user.username,
  }

  req.authed = context.user
  req.log.setBindings({ user: context.user.username, guest: undefined })

  next()
}
