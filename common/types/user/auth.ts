// Authentication-related user properties
export interface UserAuthProperties {
  /** Username for authentication */
  username: string
  /** Password hash */
  hash: string
  /** API key for external access */
  apiKey?: string
  /** Admin privileges */
  admin: boolean
  /** User role (moderator, admin) */
  role?: 'moderator' | 'admin'
  /** Reset password code */
  resetCode?: string
  /** Account creation timestamp */
  createdAt?: string
}

/** User ban information */
export interface UserBanInfo {
  /** Ban timestamp */
  at: Date
  /** Reason for ban */
  reason: string
}

/** User ban properties */
export interface UserBanProperties {
  /** Current ban status */
  banned?: UserBanInfo
  /** History of bans */
  banHistory?: UserBanInfo[]
}

/** Google OAuth integration */
export interface GoogleOAuthData {
  /** Google user ID */
  sub: any
  /** Google email */
  email: any
}

/** Third-party authentication properties */
export interface UserThirdPartyAuth {
  /** Google OAuth data */
  google?: GoogleOAuthData
}

/** Complete user authentication interface */
export interface UserAuthentication extends 
  UserAuthProperties, 
  UserBanProperties, 
  UserThirdPartyAuth {}