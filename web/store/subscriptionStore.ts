import { AppSchema } from '../../common/types/schema'
import { createStore } from './create'
import { api, isLoggedIn } from './api'
import { toastStore } from './toasts'
import { EVENTS, events } from '../emitter'
import { storage } from '../shared/util'
import { getUserSubscriptionTier } from '/common/util'

const CACHED_SUB_KEY = 'cached-sub'

type SubscriberInfo = {
  level: number
  type: AppSchema.SubscriptionType
  tier: AppSchema.SubscriptionTier
}

export type SubscriptionState = {
  tiers: AppSchema.SubscriptionTier[]
  billingLoading: boolean
  subLoading: boolean
  subStatus?: {
    status: 'active' | 'cancelling' | 'cancelled' | 'new'
    tierId: string
    customerId: string
    subscriptionId: string
    priceId: string
    downgrading?: {
      tierId: string
      requestedAt: string
      activeAt: string
    }
  }
  sub?: SubscriberInfo
}

export const subscriptionStore = createStore<SubscriptionState>(
  'subscription',
  initSubscriptionState()
)((get, set) => {
  events.on(EVENTS.tierReceived, (tier: AppSchema.SubscriptionTier) => {
    const { tiers } = get()
    const existing = tiers.some((t) => t._id === tier._id)
    const next = existing ? tiers.map((t) => (t._id === tier._id ? tier : t)) : tiers.concat(tier)
    set({ tiers: next })
  })

  return {
    async getTiers() {
      const res = await api.get('/admin/tiers')
      if (res.result) {
        return { tiers: res.result.tiers }
      }
    },

    async *startCheckout({ billingLoading }, tierId: string) {
      if (billingLoading) return
      yield { billingLoading: true }
      const callback = location.origin
      const res = await api.post(`/admin/billing/subscribe/checkout`, { tierId, callback })
      yield { billingLoading: false }
      if (res.result) {
        checkout(res.result.sessionUrl)
      }

      if (res.error) {
        toastStore.error(`Could not start checkout: ${res.error}`)
      }
    },

    async *finishCheckout(
      { billingLoading },
      sessionId: string,
      state: string,
      onSuccess?: Function
    ) {
      if (billingLoading) return
      yield { billingLoading: true }
      const res = await api.post(`/admin/billing/subscribe/finish`, { sessionId, state })
      yield { billingLoading: false }

      if (res.result && state === 'success') {
        onSuccess?.()
        return {
          sub: res.result,
        }
      }

      if (res.error) {
        toastStore.error(`Could not complete checkout: ${res.error}`)
      }
    },

    async *stopSubscription({ billingLoading }) {
      if (billingLoading) return
      yield { billingLoading: true }
      const res = await api.post('/admin/billing/subscribe/cancel')
      yield { billingLoading: false }
      if (res.result) {
        toastStore.normal('Subscription has been stopped')
        // Emit event to refresh user config
        events.emit(EVENTS.refreshUserConfig)
      }

      if (res.error) {
        toastStore.error(`Could not modify subsctiption: ${res.error}`)
      }
    },

    async *resumeSubscription({ billingLoading }) {
      if (billingLoading) return
      yield { billingLoading: true }
      const res = await api.post('/admin/billing/subscribe/resume')
      yield { billingLoading: false }
      if (res.result) {
        toastStore.success('Your subscription has been resumed!')
        // Emit event to refresh user config
        events.emit(EVENTS.refreshUserConfig)
      }

      if (res.error) {
        toastStore.error(`Could not resume subscription: ${res.error}`)
      }
    },

    async *modifySubscription({ billingLoading }, tierId: string) {
      if (billingLoading) return
      yield { billingLoading: true }
      const res = await api.post('/admin/billing/subscribe/modify', { tierId })
      yield { billingLoading: false }

      if (res.result) {
        toastStore.success('Your subscription has been changed')
        // Emit events to refresh
        events.emit(EVENTS.refreshUserConfig)
        subscriptionStore.subscriptionStatus()
      }

      if (res.error) {
        toastStore.error(`Could not change subscription: ${res.error}`)
      }
    },

    async *retrieveSubscription({ subLoading, tiers, sub: previous }, user?: AppSchema.User, quiet?: boolean) {
      if (subLoading) return
      yield { subLoading: true }
      const res = await api.post('/admin/billing/subscribe/retrieve')
      yield { subLoading: false }

      if (res.result) {
        const next = getUserSubscriptionTier(res.result.user, tiers, previous)
        yield {
          sub: next,
        }
      }

      if (quiet) return
      if (res.result) {
        toastStore.success('You are currently subscribed')
      }

      if (res.error) {
        toastStore.error(res.error)
      }
    },

    async *validateSubscription({ subLoading, tiers, sub: previous }, quiet?: boolean) {
      if (subLoading) return
      yield { subLoading: true }
      const res = await api.post('/admin/billing/subscribe/verify')
      yield { subLoading: false }

      if (res.result) {
        const next = getUserSubscriptionTier(res.result, tiers, previous)
        yield { sub: next }
      }

      if (quiet) return
      if (res.result) {
        toastStore.success('You are currently subscribed')
      }

      if (res.error) {
        toastStore.error(res.error)
      }
    },

    async subscriptionStatus() {
      if (!isLoggedIn()) return
      const res = await api.get('/admin/billing/subscribe/status')
      if (res.result) {
        return { subStatus: res.result }
      }
    },

    async verifyPatreon(_, body: any, onDone: (error?: any) => void) {
      const res = await api.post(`/user/verify/patreon`, body)
      if (res.result) {
        onDone()
        return
      }

      if (res.error) {
        onDone(res.error)
        return
      }
    },

    async unverifyPatreon() {
      const res = await api.post('/user/unverify/patreon')
      if (res.result) {
        toastStore.success('Unlinked Patreon account')
        // Emit event to refresh user config
        events.emit(EVENTS.refreshUserConfig)
        return
      }

      if (res.error) {
        toastStore.error(`Could not unlink Patreon account: ${res.error}`)
        return
      }
    },

    async *syncPatreonAccount({ sub: previous, tiers }, user?: AppSchema.User, quiet?: boolean) {
      const res = await api.post('/user/resync/patreon')

      if (quiet) return

      if (res.result) {
        toastStore.success('Successfully updated Patreon information')
        const sub = getUserSubscriptionTier(res.result, tiers, previous)
        return { sub }
      }

      if (res.error) {
        toastStore.error(`Could not sync Patreon info: ${res.error}`)
        return
      }

      // Emit event to refresh user config
      events.emit(EVENTS.refreshUserConfig)
    },
  }
})

// Subscribe to state changes to cache subscription info
subscriptionStore.subscribe((nextState) => {
  if (!nextState.sub) {
    return
  }
  storage.localSetItem(CACHED_SUB_KEY, JSON.stringify(nextState.sub))
})

function initSubscriptionState(): SubscriptionState {
  const cachedSub = storage.localGetItem(CACHED_SUB_KEY)

  return {
    tiers: [],
    billingLoading: false,
    subLoading: false,
    sub: cachedSub ? JSON.parse(cachedSub) : undefined,
  }
}

async function checkout(sessionUrl: string) {
  const child = window.open(
    sessionUrl,
    `_blank`,
    `width=600,height=1080,scrollbar=yes,top=100,left=100`
  )!

  let success = false
  const interval = setInterval(() => {
    try {
      if (child.closed) {
        clearInterval(interval)
        if (success) {
          events.emit('checkout-success', true)
          toastStore.success('Subscription successful!')
        }
        return
      }

      const path = child.location.pathname
      if (!path.includes('/checkout')) return

      const result = path.includes('/success')
      success = result
    } catch (ex) {}
  })

  setTimeout(() => {
    if (!child) {
      toastStore.error(
        'Popups are required to open the checkout window. Please check your browser settings.'
      )
      clearInterval(interval)
    }
  }, 3000)
}