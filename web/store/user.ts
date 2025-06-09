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

// Create initial state - start with empty state
function initCombinedState(): UserState {
  return {} as UserState
}

export const userStore = createStore<UserState>(
  'user',
  initCombinedState()
)((get, set) => {
  // Initialize immediately without setTimeout to avoid timing issues
  try {
    const combinedState = {
      ...authStore.getState(),
      ...subscriptionStore.getState(),
      ...uiStore.getState(),
      ...userConfigStore.getState(),
    }
    set(combinedState)
    
    // Subscribe to all individual stores for ongoing synchronization
    authStore.subscribe((authState) => {
      set({ ...get(), ...authState })
    })
    
    subscriptionStore.subscribe((subState) => {
      set({ ...get(), ...subState })
    })
    
    uiStore.subscribe((uiState) => {
      set({ ...get(), ...uiState })
    })
    
    userConfigStore.subscribe((configState) => {
      set({ ...get(), ...configState })
    })
  } catch (error) {
    console.warn('Failed to initialize user store:', error)
  }

  return {
    // Legacy methods for critical backwards compatibility  
    async setState(state: UserState, update: Partial<UserState>) {
      set(update)
    },
    
    // Delegate core auth methods
    async login(state: UserState, username: string, password: string, onSuccess?: (token: string) => void) {
      return authStore.login(username, password, onSuccess)
    },
    
    async logout(state: UserState) {
      return authStore.logout()
    },
    
    async register(state: UserState, newUser: any, onSuccess?: () => void) {
      return authStore.register(newUser, onSuccess)
    },
    
    // Delegate core config methods
    async updateConfig(state: UserState, data: any, onSuccess?: () => void) {
      return userConfigStore.updateConfig(data, onSuccess)
    },
    
    async getConfig(state: UserState) {
      return userConfigStore.getConfig()
    },
    
    // Delegate core UI methods
    async saveUI(state: UserState, ui: any, onSuccess?: any) {
      return uiStore.saveUI(ui, onSuccess)
    },
    
    // Delegate core subscription methods
    async getTiers(state: UserState) {
      return subscriptionStore.getTiers()
    },
    
    // Add missing modal method
    async modal(state: UserState, modal?: any) {
      return userConfigStore.modal(modal)
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
    subscriptionStore.retrieveSubscription(true, init.user)
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