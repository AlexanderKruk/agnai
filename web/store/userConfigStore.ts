import { AppSchema } from '../../common/types/schema'
import { createStore } from './create'
import { api } from './api'
import { toastStore } from './toasts'
import { usersApi } from './data/user'
import { localApi } from './data/storage'
import { storage } from '../shared/util'
import { AIAdapter } from '/common/adapters'
import type { FindUserResponse } from '/common/horde-gen'
import { embedApi } from './embeddings'
import { deleteApiKey as secureDeleteApiKey, type SupportedService } from '../shared/api-key-manager'

export type UserConfigState = {
  user?: AppSchema.User
  profile?: AppSchema.Profile
  showProfile: boolean
  metadata: {
    openaiUsage?: number
    hordeStats?: FindUserResponse
  }
  oaiUsageLoading: boolean
  hordeStatsLoading: boolean
}

export const userConfigStore = createStore<UserConfigState>(
  'userConfig',
  initUserConfigState()
)((get, set) => {
  return {
    modal({ showProfile }, show?: boolean) {
      return { showProfile: show ?? !showProfile }
    },

    async revealApiKey(_, cb: (key: string) => void) {
      const res = await api.post('/user/config/reveal-key')
      if (res.result) {
        cb(res.result.apiKey)
      }
      if (res.error) {
        toastStore.error(`Could get retrieve key: ${res.error}`)
      }
    },

    async generateApiKey(_, cb: (key: string) => void) {
      const res = await api.post('/user/config/generate-key')
      if (res.result) {
        cb(res.result.apiKey)
      }
      if (res.error) {
        toastStore.error(`Could get retrieve key: ${res.error}`)
      }
    },

    async getProfile() {
      const res = await usersApi.getProfile()
      if (res.error) return toastStore.error(`Failed to get profile`)
      if (res.result) {
        return { profile: res.result }
      }
    },

    async removeProfileAvatar() {
      const res = await usersApi.removeProfileAvatar()
      if (res.error) return toastStore.error(`Could not update profile: ${res.error}`)
      if (res.result) {
        return { profile: res.result }
      }
    },

    async getConfig() {
      const res = await usersApi.getConfig()

      if (res.error) return toastStore.error(`Failed to get user config`)
      if (res.result) {
        if (res.result.username) {
          storage.localSetItem('agnai-username', res.result.username)
        }
        window.usePipeline = res.result.useLocalPipeline
        return { user: res.result }
      }
    },

    async updateProfile(_, profile: { handle: string; avatar?: File }) {
      const res = await usersApi.updateProfile(profile.handle, profile.avatar)
      if (res.error) toastStore.error(`Failed to update profile: ${res.error}`)
      if (res.result) {
        toastStore.success(`Updated profile`)
        return { profile: res.result }
      }
    },

    async updateConfig({ user: prev }, config: Partial<AppSchema.User & { hordeModels?: string[] }>) {
      const res = await usersApi.updateConfig(config)
      if (res.error) toastStore.error(`Failed to update config: ${res.error}`)
      if (res.result) {
        window.usePipeline = res.result.useLocalPipeline

        const prevLTM = prev?.disableLTM ?? true
        if (prevLTM && config.disableLTM === false) {
          embedApi.initSimiliary(false)
        }

        toastStore.success(`Updated settings`)
        return { user: res.result }
      }
    },

    async updatePartialConfig(_, config: Partial<AppSchema.User & { hordeModels?: string[] }>, quiet?: boolean) {
      const res = await usersApi.updatePartialConfig(config)
      if (res.error) toastStore.error(`Failed to update config: ${res.error}`)
      if (res.result) {
        window.usePipeline = res.result.useLocalPipeline

        if (!quiet) {
          toastStore.success(`Updated settings`)
        }
        return { user: res.result }
      }
    },

    async updateService(_, service: AIAdapter, update: any, onDone?: (err?: any) => void) {
      const res = await usersApi.updateServiceConfig(service, update)
      if (res.error) {
        onDone?.(res.error)
        toastStore.error(`Failed to update service config: ${res.error}`)
        return
      }
      if (res.result) {
        toastStore.success('Updated service settings')
        onDone?.()
        return { user: res.result }
      }
    },

    async deleteKey({ user }, service: SupportedService) {
      const result = await secureDeleteApiKey(service, user)
      
      if (result.success && result.updatedUser) {
        return { user: result.updatedUser }
      }
      
      // If no updated user returned, keep current state
      return {}
    },

    async clearGuestState() {
      try {
        const chats = await localApi.loadItem('chats')
        for (const chat of chats) {
          storage.removeItem(`messages-${chat._id}`)
        }

        for (const key in localApi.KEYS) {
          await storage.removeItem(key)
          await localApi.loadItem(key as any)
        }

        toastStore.error(`Guest state successfully reset`)
        // Emit logout event
        return { user: undefined, profile: undefined }
      } catch (e: any) {
        toastStore.error(`Failed to reset guest state: ${e.message}`)
      }
    },

    async novelLogin(_, key: string, onComplete: (err?: boolean) => void) {
      const res = await usersApi.novelLogin(key)
      if (res.result) {
        toastStore.success('Successfully authenticated with NovelAI')
        onComplete()
        return { user: res.result }
      }

      if (res.error) {
        onComplete(true)
        toastStore.error(`NovelAI login failed: ${res.error}`)
      }
    },

    async *hordeStats({ metadata, user }) {
      yield { hordeStatsLoading: true }
      const res = await api.post('/user/services/horde-stats', { key: user?.hordeKey })
      yield { hordeStatsLoading: false }
      if (res.error) {
        toastStore.error(`Could not retrieve usage: ${res.error}`)
        yield { metadata: { ...metadata, openaiUsage: -1 } }
      }

      if (res.result) {
        if (res.result.error) {
          toastStore.warn(`Could not retrieve Horde stats: ${res.result.error}`)
          return
        }

        yield {
          metadata: {
            ...metadata,
            hordeStats: res.result.user,
          },
        }
      }
    },
  }
})

function initUserConfigState(): UserConfigState {
  return {
    showProfile: false,
    metadata: {},
    oaiUsageLoading: false,
    hordeStatsLoading: false,
  }
}