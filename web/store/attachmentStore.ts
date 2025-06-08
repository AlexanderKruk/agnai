import { createStore } from './create'
import { storage } from '../shared/util'

export type AttachmentStoreState = {
  /** Attachments, mapped by Chat ID  */
  attachments: Record<string, { image: string } | undefined>
  imagesSaved: boolean
}

const initState: AttachmentStoreState = {
  attachments: {},
  imagesSaved: false,
}

export const attachmentStore = createStore<AttachmentStoreState>(
  'attachments',
  initState
)((getState, setState) => {
  return {
    setAttachment(state: AttachmentStoreState, chatId: string, base64: string) {
      const { attachments } = state
      return { attachments: { ...attachments, [chatId]: { image: base64 } } }
    },

    removeAttachment(state: AttachmentStoreState, chatId: string) {
      const { attachments } = state
      return { attachments: { ...attachments, [chatId]: undefined } }
    },

    setImagesSaved(state: AttachmentStoreState, imagesSaved: boolean) {
      return { imagesSaved }
    },
  }
})

// Message image cache management functions
export async function getMessageImages(messageId: string) {
  const cached = await storage
    .getItem(`message-images-${messageId}`)
    .then((res) => (res ? JSON.parse(res) : []))

  return cached as string[]
}

export async function deleteCachedMessageImage(messageId: string, cacheId: string) {
  await storage.removeItem(cacheId)
  const ids = await getMessageImages(messageId)
  const filtered = ids.filter((i) => i !== cacheId)

  await storage.setItem(`message-images-${messageId}`, JSON.stringify(filtered))

  // console.log(`[cache] image deleted: `, cacheId)
}

export async function addMessageImage(messageId: string, cacheId: string) {
  const prev = await getMessageImages(messageId)
  if (prev.includes(cacheId)) return
  await storage.setItem(`message-images-${messageId}`, JSON.stringify(prev.concat(cacheId)))
}