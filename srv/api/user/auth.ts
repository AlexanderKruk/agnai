import { assertValid } from '/common/valid'
import { store } from '../../db'
import { errors, handle, StatusError } from '../wrap'
import { OAuthScope, oauthScopes } from '/common/types'
import { patreon } from './patreon'
import { getSafeUserConfig } from './settings'
import { authService, oauthService, apiKeyService } from '../../auth'

export const register = handle(async (req) => {
  assertValid({ handle: 'string', username: 'string', password: 'string' }, req.body)
  const result = await authService.registerUser(req.body)
  req.log.info({ user: result.user.username, id: result.user._id }, 'User registered')
  return result
})

export const login = handle(async (req) => {
  assertValid({ username: 'string', password: 'string' }, req.body)
  const result = await authService.authenticateUser(req.body.username, req.body.password)

  if (!result) {
    throw new StatusError('Unauthorized', 401)
  }

  return result
})

export const resetPassword = handle(async (req) => {
  const { body } = req
  assertValid({ code: 'string', username: 'string', password: 'string', confirm: 'string' }, body)

  if (body.password !== body.confirm) {
    throw new StatusError('Passwords do not match', 400)
  }

  if (!body.code.trim()) {
    throw errors.BadRequest
  }

  const success = await authService.resetUserPassword(body.code, body.username, body.password)
  
  if (!success) {
    throw errors.BadRequest
  }

  return { success: true }
})

export const oathGoogleLogin = handle(async ({ log, body }) => {
  assertValid({ token: 'string' }, body)

  const config = await store.admin.getServerConfiguration().catch(() => undefined)

  if (!config?.googleClientId) {
    throw new StatusError('Not allowed', 405)
  }

  const result = await oauthService.handleGoogleOAuth(
    body.token,
    config.googleClientId,
    'login'
  )

  if ('token' in result) {
    log.info({ user: result.user.username, id: result.user._id }, 'User logged in (Google OAuth)')
  }

  return result
})

export const unlinkGoogleAccount = handle(async ({ userId }) => {
  return await oauthService.unlinkGoogleAccount(userId)
})

export const linkGoogleAccount = handle(async ({ body, userId }) => {
  assertValid({ token: 'string' }, body)

  const config = await store.admin.getServerConfiguration().catch(() => undefined)

  if (!config?.googleClientId) {
    throw new StatusError('Not allowed', 405)
  }

  return await oauthService.handleGoogleOAuth(
    body.token,
    config.googleClientId,
    'link',
    userId
  )
})

export const changePassword = handle(async (req) => {
  assertValid({ password: 'string' }, req.body)
  await authService.changeUserPassword(req.userId, req.body.password)
  return { success: true }
})

export const createApiKey = handle(async (req) => {
  assertValid({ scopes: ['string?'] }, req.body)

  const scopes: OAuthScope[] = []
  for (const scope of req.body.scopes || []) {
    assertValid({ scope: oauthScopes }, scope)
    scopes.push(scope as OAuthScope)
  }

  const code = await apiKeyService.createApiKey(
    req.userId, 
    scopes.map(s => s.toString()), 
    req.header('origin') || 'unknown'
  )
  return { code }
})

export const verifyOauthKey = handle(async (req) => {
  assertValid({ code: 'string' }, req.body)

  const apiKey = await apiKeyService.activateApiKey(req.userId, req.body.code)
  return { key: apiKey }
})

export const remoteLogin = handle(async (req) => {
  const user = await store.users.getUser(req.userId)
  if (!user) throw errors.Unauthorized

  const token = await authService.createUserToken(user.username, user)
  return { token }
})

export const resyncPatreon = handle(async (req) => {
  await patreon.revalidatePatron(req.userId)
  const next = await getSafeUserConfig(req.userId)
  return next
})

export const verifyPatreonOauth = handle(async (req) => {
  const { body } = req
  assertValid({ code: 'string' }, body)
  await patreon.initialVerifyPatron(req.userId, body.code)
  return { success: true }
})

export const unlinkPatreon = handle(async (req) => {
  await store.users.unlinkPatreonAccount(req.userId, 'user initiated')

  return { success: true }
})
