import type { UISettings } from '../ui'

/** User system preferences and settings */
export interface UserPreferences {
  /** Entity ID */
  _id: string
  /** Record type */
  kind: 'user'
  /** Last update timestamp */
  updatedAt?: string
  /** Last seen announcement date */
  announcement?: string
  /** Whether Long Term Memory is disabled */
  disableLTM?: boolean
  /** UI settings and theme preferences */
  ui?: UISettings
}