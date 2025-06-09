// Legacy user store - now re-exports from focused stores
import { EVENTS, events } from '../emitter'
import { authStore, AuthState } from './authStore'
import { subscriptionStore, SubscriptionState } from './subscriptionStore'
import { uiStore, UIState } from './uiStore'
import { userConfigStore, UserConfigState } from './userConfigStore'
import { getUserSubscriptionTier } from '/common/util'
import { AppSchema } from '../../common/types/schema'
import { subscribe } from './socket'
import { defaultUIsettings } from '/common/types/ui'
import { createStore } from './create'

// Combined state type for backwards compatibility
export type UserState = AuthState & SubscriptionState & UIState & UserConfigState

// Create initial state by combining all stores
function initCombinedState(): UserState {
  return {
    ...authStore.getState(),
    ...subscriptionStore.getState(),
    ...uiStore.getState(),
    ...userConfigStore.getState(),
  }
}

export const userStore = createStore<UserState>(
  'user',
  initCombinedState()
)((get, set) => {
  // Subscribe to all individual stores and update combined state
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

  return {
    // Auth methods
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
    handleGoogleCallback: authStore.handleGoogleCallback,
    unlinkGoogleAccount: authStore.unlinkGoogleAccount,
    resetPassword: authStore.resetPassword,
    changePassword: authStore.changePassword,
    remoteLogin: authStore.remoteLogin,
    thirdPartyLogin: authStore.thirdPartyLogin,
    createApiKey: authStore.createApiKey,
    deleteAccount: authStore.deleteAccount,

    // Subscription methods
    getTiers: subscriptionStore.getTiers,
    startCheckout: subscriptionStore.startCheckout,
    finishCheckout: subscriptionStore.finishCheckout,
    stopSubscription: subscriptionStore.stopSubscription,
    resumeSubscription: subscriptionStore.resumeSubscription,
    modifySubscription: subscriptionStore.modifySubscription,
    retrieveSubscription: subscriptionStore.retrieveSubscription,
    validateSubscription: subscriptionStore.validateSubscription,
    subscriptionStatus: subscriptionStore.subscriptionStatus,
    verifyPatreon: subscriptionStore.verifyPatreon,
    unverifyPatreon: subscriptionStore.unverifyPatreon,
    syncPatreonAccount: subscriptionStore.syncPatreonAccount,

    // UI methods
    saveUI: uiStore.saveUI,
    saveCustomUI: uiStore.saveCustomUI,
    tryCustomUI: uiStore.tryCustomUI,
    tryUI: uiStore.tryUI,
    receiveUI: uiStore.receiveUI,
    setBackground: uiStore.setBackground,

    // Config methods
    modal: userConfigStore.modal,
    revealApiKey: userConfigStore.revealApiKey,
    generateApiKey: userConfigStore.generateApiKey,
    getProfile: userConfigStore.getProfile,
    removeProfileAvatar: userConfigStore.removeProfileAvatar,
    getConfig: userConfigStore.getConfig,
    updateProfile: userConfigStore.updateProfile,
    updateConfig: userConfigStore.updateConfig,
    updatePartialConfig: userConfigStore.updatePartialConfig,
    updateService: userConfigStore.updateService,
    deleteKey: userConfigStore.deleteKey,
    clearGuestState: userConfigStore.clearGuestState,
    novelLogin: userConfigStore.novelLogin,
    hordeStats: userConfigStore.hordeStats,
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
    subscriptionStore.retrieveSubscription({}, init.user, true)
  }

  if (init.user?._id !== 'anon') {
    subscriptionStore.getTiers()
  }

  window.usePipeline = init.user.useLocalPipeline

  /**
   * While introducing persisted UI settings, we'll automatically persist settings that the user has in local storage
   */
  if (!init.user || !init.user.ui) {
    uiStore.saveUI({}, defaultUIsettings)
  } else {
    uiStore.receiveUI({}, init.user.ui)

    if (!init.user.disableLTM) {
      // embedApi.initSimiliary(false) // Removed to avoid circular dependency
    }
  }
})

subscribe('ui-update', { ui: 'any' }, (body) => {
  uiStore.receiveUI({}, body.ui)
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