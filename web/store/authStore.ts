import { AppSchema } from '../../common/types/schema'
import { createStore } from './create'
import { api, clearAuth, getAuth, setAuth } from './api'
import { toastStore } from './toasts'
import { publish } from './socket'
import { EVENTS, events } from '../emitter'
import { storage } from '../shared/util'
import { UserType } from '/common/types/admin'

export const ACCOUNT_KEY = 'agnai-username'

export type AuthState = {
  loading: boolean
  loggedIn: boolean
  jwt: string
  userType: UserType | undefined
  userLevel: number
  banned?: string
  error?: string
}

export const authStore = createStore<AuthState>(
  'auth',
  initAuthState()
)((get, set) => {
  events.on(EVENTS.sessionExpired, () => {
    authStore.logout()
  })

  events.on(EVENTS.userBanned, (reason) => {
    authStore.setState({ banned: reason })
  })

  return {
    async *login(_, username: string, password: string, onSuccess?: (token: string) => void) {
      yield { loading: true }

      const res = await api.post('/user/login', { username, password })
      yield { loading: false }
      if (res.error) {
        return toastStore.error(`Authentication failed`)
      }

      setAuth(res.result.token)
      storage.localSetItem(ACCOUNT_KEY, username)

      yield {
        loading: false,
        loggedIn: true,
        jwt: res.result.token,
        userType: getUserType(res.result.user),
      }

      onSuccess?.(res.result.token)
      publish({ type: 'login', token: res.result.token })
      events.emit(EVENTS.loggedIn)
    },

    async *register(
      _,
      newUser: { handle: string; username: string; password: string },
      onSuccess?: () => void
    ) {
      yield { loading: true }

      const res = await api.post('/user/register', newUser)
      yield { loading: false }
      if (res.error) {
        return toastStore.error(`Failed to register: ${res.error}`)
      }

      setAuth(res.result.token)

      yield {
        loggedIn: true,
        jwt: res.result.token,
      }

      onSuccess?.()
      publish({ type: 'login', token: res.result.token })
      events.emit(EVENTS.loggedIn)
    },

    async *logout() {
      clearAuth()
      publish({ type: 'logout' })

      yield {
        jwt: '',
        loggedIn: false,
        banned: undefined,
      }
      events.emit(EVENTS.loggedOut)
    },

    async *handleGoogleCallback(
      _,
      action: 'login' | 'link',
      data: { credential: string },
      success?: () => void
    ) {
      if (action !== 'login' && !get().loggedIn) {
        toastStore.error(`Cannot link account: Not signed in`)
        return
      }
      yield { loading: true }

      const res = await api.post(action === 'link' ? '/user/link-google' : '/user/login/google', {
        token: data.credential,
      })

      yield { loading: false }

      switch (action) {
        case 'link': {
          if (res.result) {
            toastStore.success('Successfully linked Google account')
            success?.()
            return
          }

          toastStore.error(`Could not link account: ${res.error}`)
          return
        }

        case 'login': {
          if (res.result) {
            yield {
              loggedIn: true,
              jwt: res.result.token,
              userType: getUserType(res.result.user),
            }
            setAuth(res.result.token)
            success?.()
            publish({ type: 'login', token: res.result.token })
            events.emit(EVENTS.loggedIn)
            return
          }

          toastStore.error(`Could not sign in: ${res.error}`)
        }
      }
    },

    async *unlinkGoogleAccount(_, success?: () => void) {
      const res = await api.post('/user/unlink-google')
      if (res.result) {
        toastStore.success('Google Account unlinked')
        success?.()
        return
      }

      toastStore.error(`Could not unlinked Google: ${res.error}`)
    },

    async *resetPassword(
      _,
      code: string,
      username: string,
      password: string,
      confirm: string,
      onSuccess: () => void
    ) {
      const res = await api.post(`/user/reset-password`, { code, username, password, confirm })

      if (res.result) {
        toastStore.success('Your password has been changed. You can now login.')
        onSuccess()
      } else {
        toastStore.error(`Could not reset password: ${res.error}`)
      }
    },

    async changePassword(_, password: string, onSuccess?: Function) {
      const res = await api.post('/user/password', { password })
      if (res.error) return toastStore.error('Failed to change password')
      if (res.result) {
        toastStore.success(`Successfully changed password`)
        onSuccess?.()
      }
    },

    async remoteLogin(_, onSuccess: (token: string) => void) {
      const res = await api.post('/user/login/callback')
      if (res.result) {
        onSuccess(res.result.token)
      }

      if (res.error) {
        toastStore.error(`Could not authenticate: ${res.error}`)
      }
    },

    async thirdPartyLogin(_, onSuccess: (token: string) => void) {
      const res = await api.post('/user/login/callback')
      if (res.result) {
        onSuccess(res.result.token)
      }

      if (res.error) {
        toastStore.error(`Could not authenticate: ${res.error}`)
      }
    },

    async createApiKey(_, cb: (err: any, code?: string) => void) {
      const res = await api.post('/user/code')
      if (res.result) {
        cb(null, res.result.code)
      }

      if (res.error) {
        cb(res.error)
      }
    },

    async *deleteAccount() {
      const res = await api.method('delete', '/user/my-account')
      if (res.result) {
        toastStore.error('Account deleted')
        authStore.logout()
      }

      if (res.error) {
        toastStore.error(`Could not delete account: ${res.error}`)
      }
    },
  }
})

function initAuthState(): AuthState {
  const existing = getAuth()

  if (!existing) {
    return {
      userType: undefined,
      userLevel: -1,
      loading: false,
      jwt: '',
      loggedIn: false,
    }
  }

  return {
    userType: undefined,
    userLevel: 0,
    loggedIn: true,
    loading: false,
    jwt: existing,
  }
}

function getUserType(user: AppSchema.User): UserType {
  if (!user) return 'guests'
  if (user.admin) return 'admins'
  if (user.role === 'admin') return 'admins'
  if (user.role === 'moderator') return 'moderators'
  if (user.sub?.level && user.sub.level > 0) return 'subscribers'
  if (user._id === 'anon') return 'guests'
  return 'users'
}