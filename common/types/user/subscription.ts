
/** Subscription type definitions */
export type SubscriptionType = 'native' | 'patreon' | 'manual'

/** Native subscription information */
export interface NativeSubscription {
  /** Subscription type */
  type?: SubscriptionType
  /** Tier ID */
  tierId: string
  /** Subscription level */
  level: number
  /** Last activity date */
  last?: string
}

/** Manual subscription override */
export interface ManualSubscription {
  /** Manual tier ID */
  tierId: string
  /** Manual subscription level */
  level: number
  /** Expiration date */
  expiresAt: string
}

/** Stripe billing information */
export interface StripeBilling {
  /** Billing status */
  status: 'active' | 'cancelled'
  /** Whether cancellation is pending */
  cancelling?: boolean
  /** Valid until date */
  validUntil: string
  /** Last renewal date */
  lastRenewed: string
  /** Stripe customer ID */
  customerId: string
  /** Stripe subscription ID */
  subscriptionId: string
  /** Last check timestamp */
  lastChecked?: string
}

/** Patreon user data */
export interface PatreonUser {
  /** Patreon access token */
  access_token: string
  /** Patreon refresh token */
  refresh_token: string
  /** Token expiration in seconds */
  expires_in: number
  /** OAuth scope */
  scope: string
  /** Token type */
  token_type: string
  /** Expiration date */
  expires: string
  /** Patreon user info */
  user: {
    type: 'user'
    id: string
    attributes: {
      created: string
      email: string
      full_name: string
    }
    relationships: {
      memberships: {
        data: Array<{ id: string; type: 'member' }>
      }
    }
  }
  /** Patreon tier info */
  tier?: {
    id: string
    type: 'tier'
    attributes: {
      amount_cents: number
      description: string
      title: string
    }
    relationships: {
      campaign: {
        data: {
          id: string
          type: 'campaign'
        }
      }
    }
  }
  /** Patreon member info */
  member?: {
    type: 'member'
    id: string
    attributes: {
      campaign_lifetime_support_cents: number
      campaign_entitled_amount_cents: number
      is_gifted: boolean
      last_charge_date: string
      last_charge_status:
        | 'Paid'
        | 'Declined'
        | 'Deleted'
        | 'Pending'
        | 'Refunded'
        | 'Fraud'
        | 'Other'
        | null
      next_charge_date: string
      patron_status: 'active_patron' | 'declined_patron' | 'former_patron'
      pledge_relationship_start: string
      will_pay_amount_cents: number
    }
    relationships: {
      currently_entitled_tiers: { data: Array<{ type: 'tier'; id: string }> }
    }
  }
  /** Subscription info */
  sub?: {
    tierId: string
    level: number
  }
}

/** Complete user subscription configuration */
export interface UserSubscription {
  /** Primary subscription */
  sub?: NativeSubscription
  /** Manual subscription override */
  manualSub?: ManualSubscription
  /** Patreon user ID */
  patreonUserId?: string | null
  /** Patreon subscription data */
  patreon?: PatreonUser
  /** Stripe billing information */
  billing?: StripeBilling
  /** Stripe session IDs */
  stripeSessions?: string[]
}