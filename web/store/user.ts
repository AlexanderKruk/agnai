// Legacy user store - backwards compatibility facade
import { EVENTS, events } from '../emitter'
import { authStore, AuthState } from './authStore'
import { subscriptionStore, SubscriptionState } from './subscriptionStore'
import { uiStore, UIState } from './uiStore'
import { userConfigStore, UserConfigState } from './userConfigStore'
import { AppSchema } from '../../common/types/schema'
import { subscribe } from './socket'
import { defaultUIsettings } from '/common/types/ui'
import { createStore } from './create'

// Combined state type for backwards compatibility
export type UserState = AuthState & SubscriptionState & UIState & UserConfigState

// Create initial state by immediately combining from focused stores
function initCombinedState(): UserState {
  try {
    return {
      ...authStore.getState(),
      ...subscriptionStore.getState(),
      ...uiStore.getState(),
      ...userConfigStore.getState(),
    }
  } catch (error) {
    console.warn('Failed to initialize combined state:', error)
    return {} as UserState
  }
}

export const userStore = createStore<UserState>(
  'user',
  initCombinedState()
)((get, set) => {
  // Force an immediate re-sync to ensure latest state
  const resync = () => {
    try {
      const combinedState = {
        ...authStore.getState(),
        ...subscriptionStore.getState(),
        ...uiStore.getState(),
        ...userConfigStore.getState(),
      }
      set(combinedState)
      return combinedState
    } catch (error) {
      console.warn('Failed to resync user store:', error)
      return {}
    }
  }
  
  // Initial resync
  resync()
  
  // Subscribe to all individual stores for ongoing synchronization
  authStore.subscribe(() => resync())
  subscriptionStore.subscribe(() => resync())
  uiStore.subscribe(() => resync())
  userConfigStore.subscribe(() => resync())

  return {
    // Legacy methods for critical backwards compatibility  
    async setState(state: UserState, update: Partial<UserState>) {
      return update
    },
    
    // Delegate core auth methods
    async login(state: UserState, username: string, password: string, onSuccess?: (token: string) => void) {
      await authStore.login(username, password, onSuccess)
      return resync()
    },
    
    async logout(state: UserState) {
      await authStore.logout()
      return resync()
    },
    
    async register(state: UserState, newUser: any, onSuccess?: () => void) {
      await authStore.register(newUser, onSuccess)
      return resync()
    },
    
    // Delegate core config methods
    async updateConfig(state: UserState, data: any, onSuccess?: () => void) {
      await userConfigStore.updateConfig(state, data)
      if (onSuccess) onSuccess()
      return resync()
    },
    
    async getConfig(state: UserState) {
      await userConfigStore.getConfig()
      return resync()
    },
    
    // Delegate core UI methods
    async saveUI(state: UserState, ui: any, onSuccess?: any) {
      await uiStore.saveUI(state, ui)
      if (onSuccess) onSuccess()
      return resync()
    },
    
    // Delegate core subscription methods
    async getTiers(state: UserState) {
      await subscriptionStore.getTiers()
      return resync()
    },
    
    // Add missing modal method
    async modal(state: UserState, modal?: any) {
      await userConfigStore.modal(modal)
      return resync()
    },
    
    // Add missing methods from the original user store
    async updatePartialConfig(state: UserState, data: any, quiet?: boolean) {
      await userConfigStore.updatePartialConfig(state, data, quiet)
      return resync()
    },
    
    async deleteKey(state: UserState, key: string) {
      await userConfigStore.deleteKey(key)
      return resync()
    },
    
    async updateService(state: UserState, service: string, data: any, onDone?: (err?: any) => void) {
      await userConfigStore.updateService(state, service, data, onDone)
      return resync()
    },
    
    async clearGuestState(state: UserState) {
      await userConfigStore.clearGuestState()
      return resync()
    },
    
    async verifyPatreon(state: UserState, body: any, onDone: (error?: any) => void) {
      await subscriptionStore.verifyPatreon(state, body, onDone)
      return resync()
    },
    
    async unverifyPatreon(state: UserState) {
      await subscriptionStore.unverifyPatreon()
      return resync()
    },
    
    async validateSubscription(state: UserState) {
      await subscriptionStore.validateSubscription()
      return resync()
    },
    
    async setBackground(state: UserState, background: string) {
      await uiStore.setBackground(background)
      return resync()
    },
    
    async tryCustomUI(state: UserState, ui: any) {
      await uiStore.tryCustomUI(ui)
      return resync()
    },
    
    async saveCustomUI(state: UserState, ui: any) {
      await uiStore.saveCustomUI(ui)
      return resync()
    },
    
    async tryUI(state: UserState, ui: any) {
      await uiStore.tryUI(ui)
      return resync()
    },
    
    // Additional auth methods
    async handleGoogleCallback(state: UserState, action: 'login' | 'link', data: { credential: string }, success?: () => void) {
      await authStore.handleGoogleCallback(state, action, data, success)
      return resync()
    },
    
    async thirdPartyLogin(state: UserState, onSuccess: (token: string) => void) {
      await authStore.thirdPartyLogin(state, onSuccess)
      return resync()
    },
    
    async createApiKey(state: UserState, data: any) {
      await authStore.createApiKey(data)
      return resync()
    },
    
    async resetPassword(state: UserState, code: string, username: string, password: string, confirm: string, onSuccess: () => void) {
      await authStore.resetPassword(state, code, username, password, confirm, onSuccess)
      return resync()
    },
    
    // Profile management methods
    async updateProfile(state: UserState, data: any) {
      await userConfigStore.updateProfile(data)
      return resync()
    },
    
    async getProfile(state: UserState) {
      await userConfigStore.getProfile()
      return resync()
    },
    
    async unlinkGoogleAccount(state: UserState, success?: () => void) {
      await authStore.unlinkGoogleAccount(state, success)
      return resync()
    },
    
    async removeProfileAvatar(state: UserState) {
      await userConfigStore.removeProfileAvatar()
      return resync()
    },
    
    async changePassword(state: UserState, password: string, onSuccess?: Function) {
      await authStore.changePassword(state, password, onSuccess)
      return resync()
    },
    
    async deleteAccount(state: UserState) {
      await authStore.deleteAccount()
      return resync()
    },
    
    // Subscription management methods
    async finishCheckout(state: UserState, sessionId: string, checkoutState: string, onSuccess?: Function) {
      await subscriptionStore.finishCheckout(state, sessionId, checkoutState, onSuccess)
      return resync()
    },
    
    async startCheckout(state: UserState, tierId: string) {
      await subscriptionStore.startCheckout(tierId)
      return resync()
    },
    
    async subscriptionStatus(state: UserState) {
      await subscriptionStore.subscriptionStatus()
      return resync()
    },
    
    async modifySubscription(state: UserState, data: any) {
      await subscriptionStore.modifySubscription(data)
      return resync()
    },
    
    async resumeSubscription(state: UserState) {
      await subscriptionStore.resumeSubscription()
      return resync()
    },
    
    async stopSubscription(state: UserState) {
      await subscriptionStore.stopSubscription()
      return resync()
    },
    
    // API key management
    async revealApiKey(state: UserState, cb: (key: string) => void) {
      await userConfigStore.revealApiKey(state, cb)
      return resync()
    },
    
    async generateApiKey(state: UserState, cb: (key: string) => void) {
      await userConfigStore.generateApiKey(state, cb)
      return resync()
    },
    
    // Service-specific methods
    async hordeStats(state: UserState) {
      await userConfigStore.hordeStats()
      return resync()
    },
    
    async novelLogin(state: UserState, key: string, onComplete: (err?: boolean) => void) {
      await userConfigStore.novelLogin(state, key, onComplete)
      return resync()
    },
  }
})

// Initialize event handlers for the combined store
events.on(EVENTS.init, (init) => {
  if (init.user) {
    init.user.userHordeKey = init.user.hordeKey
    init.user.hordeKey = ''
  }
  
  userConfigStore.setState({ 
    user: init.user, 
    profile: init.profile 
  })
  
  authStore.setState({ 
    userType: getUserType(init.user) 
  })

  if (
    init.user?.patreonUserId ||
    init.user?.billing ||
    init.user?.manualSub ||
    init.user?.stripeSessions?.length
  ) {
    subscriptionStore.retrieveSubscription(init.user)
  }

  if (init.user?._id !== 'anon') {
    subscriptionStore.getTiers()
  }

  window.usePipeline = init.user.useLocalPipeline

  /**
   * While introducing persisted UI settings, we'll automatically persist settings that the user has in local storage
   */
  if (!init.user || !init.user.ui) {
    uiStore.saveUI(defaultUIsettings)
  } else {
    uiStore.receiveUI(init.user.ui)

    if (!init.user.disableLTM) {
      // embedApi.initSimiliary(false) // Removed to avoid circular dependency
    }
  }
})

subscribe('ui-update', { ui: 'any' }, (body) => {
  uiStore.receiveUI(body.ui)
})

function getUserType(user: AppSchema.User): import('/common/types/admin').UserType {
  if (!user) return 'guests'
  if (user.admin) return 'admins'
  if (user.role === 'admin') return 'admins'
  if (user.role === 'moderator') return 'moderators'
  if (user.sub?.level && user.sub.level > 0) return 'subscribers'
  if (user._id === 'anon') return 'guests'
  return 'users'
}

// Export constants for backwards compatibility
export const ACCOUNT_KEY = 'agnai-username'

// Export the component stores for direct access if needed
export { authStore, subscriptionStore, uiStore, userConfigStore }