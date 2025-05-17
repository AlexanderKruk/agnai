import { ImageAdapterResponse, ImageGenerateRequest } from './types'
import { AppLog } from '../middleware'
import { handleNovelImage } from './novel'
import { store } from '../db'
import { config } from '../config'
import { v4 } from 'uuid'
import { saveFile } from '../api/upload'
import { handleSDImage } from './stable-diffusion'
import { sendGuest, sendMany, sendOne } from '../api/ws'
import { handleHordeImage } from './horde'
import { handleA1111ForgeImage } from './a1111forge'
import { AppSchema } from '/common/types'
import { ImageSettings } from '/common/types/image-schema'

const DEFAULT_NEGATIVE = ``

export async function generateImageSync(opts: ImageGenerateRequest, log: AppLog) {
  const imageSettings = opts.user.images
  const prompt = getImagePrompt(opts, imageSettings)

  let { error, image } = await runImageGenerate({
    imageSettings,
    user: opts.user,
    prompt,
    log,
    guestId: undefined,
    opts,
  })

  return { error, image, output: image?.content }
}

export async function generateImage(opts: ImageGenerateRequest, log: AppLog, guestId?: string) {
  const { user, chatId, messageId } = opts
  const broadcastIds: string[] = []

  const chat = chatId ? await store.chats.getChatOnly(chatId) : undefined
  const characterId =
    chat?.imageSource === 'main-character'
      ? chat.characterId
      : chat?.imageSource === 'last-character'
      ? opts.characterId
      : undefined
  const character =
    chat && characterId ? await store.characters.getCharacter(chat.userId, characterId) : undefined

  if (!guestId) {
    broadcastIds.push(user._id)
    if (chatId) {
      const members = await store.chats.getActiveMembers(chatId)
      broadcastIds.push(...members, user._id)
    }
  }

  const imageSettings = await getImageSettings(chat, character, user)
  const prompt = getImagePrompt(opts, imageSettings)

  log.debug({ prompt, type: imageSettings?.type, source: chat?.imageSource }, 'Image prompt')

  if (!guestId) {
    sendOne(user._id, {
      type: 'image-generation-started',
      prompt,
      negative: imageSettings?.negative || '',
      service: imageSettings?.type,
      requestId: opts.requestId,
    })
  }

  let { image, output, error } = await runImageGenerate({
    imageSettings,
    user,
    prompt,
    log,
    guestId,
    opts,
  })

  /**
   * If the server is configured to save images: we will store the image, generate a message, then publish the message
   * Otherwise: We will broadcast the image content
   */

  if (image) {
    // Guest images do not get saved under any circumstances

    if (typeof image.content === 'string' && image.content.startsWith('http')) {
      output = image.content
    }

    if (guestId) {
      if (!output) {
        output = `data:image/png;base64,${image.content.toString('base64')}`
      }
    } else if (!opts.ephemeral && config.storage.saveImages) {
      const name = `${v4()}.${image.ext}`

      if (!output) {
        output = await saveFile(name, image.content)
      }

      if (!guestId && chatId) {
        const msg = await updateMessageImages({
          chatId,
          userId: user._id,
          filename: output,
          memberIds: broadcastIds,
          messageId: messageId || opts.parentId!,
          imagePrompt: opts.prompt,
          append: opts.append,
          meta: { negative: imageSettings?.negative },
        })

        if (msg) return
      }
    } else {
      output = output || (await saveFile(`temp-${v4()}.${image.ext}`, image.content, 300))
    }
  }

  // If we are generating temporary images, persist the prompt to avoid re-generating the prompt for subsequent images
  if (image && !guestId && messageId) {
    const edited = await store.msgs.editMessage(messageId, { imagePrompt: opts.prompt })
    sendMany(broadcastIds, {
      type: 'message-edited',
      chatId,
      messageId,
      message: edited?.msg,
      imagePrompt: opts.prompt,
    })
  }

  const message = image
    ? {
        type: 'image-generated',
        chatId,
        messageId: messageId || opts.parentId,
        image: output,
        source: opts.source,
        requestId: opts.requestId,
      }
    : {
        type: 'image-failed',
        chatId,
        error: error || 'Invalid image settings (No handler found)',
        requestId: opts.requestId,
      }

  if (broadcastIds.length) {
    sendMany(broadcastIds, message)
  } else if (guestId) {
    sendGuest(guestId, message)
  }

  return { output }
}

async function runImageGenerate(options: {
  imageSettings: ImageSettings | undefined
  user: AppSchema.User
  prompt: string
  log: AppLog
  guestId: string | undefined
  opts: ImageGenerateRequest
}) {
  const { imageSettings, user, prompt, log, guestId, opts: originalRequestOpts } = options

  let image: ImageAdapterResponse | undefined
  let output: string = ''
  let error: any

  const negative = imageSettings?.negative || DEFAULT_NEGATIVE

  log.debug({ settings: imageSettings, settingsType: imageSettings?.type, originalRequestId: originalRequestOpts.requestId }, '[AGN AI DEBUG] runImageGenerate called with settings:')

  try {
    switch (imageSettings?.type || 'horde') {
      case 'novel':
        log.info('[AGN AI DEBUG] Dispatching to NovelAI handler')
        image = await handleNovelImage(
          {
            user,
            prompt,
            negative,
            settings: imageSettings,
            params: originalRequestOpts.params,
            raw_prompt: originalRequestOpts.prompt,
            noAffix: originalRequestOpts.noAffix,
          },
          log,
          guestId
        )
        break

      case 'sd':
        log.info('[AGN AI DEBUG] Dispatching to SD handler')
        image = await handleSDImage(
          {
            user,
            prompt,
            negative,
            settings: imageSettings,
            override: originalRequestOpts.model,
            params: originalRequestOpts.params,
            raw_prompt: originalRequestOpts.prompt,
            noAffix: originalRequestOpts.noAffix,
          },
          log,
          guestId
        )
        break

      case 'horde':
        log.info('[AGN AI DEBUG] Dispatching to Horde handler')
        image = await handleHordeImage(
          {
            user,
            prompt,
            negative,
            settings: imageSettings,
            params: originalRequestOpts.params,
            raw_prompt: originalRequestOpts.prompt,
            noAffix: originalRequestOpts.noAffix,
          },
          log,
          guestId
        )
        break

      case 'a1111forge':
        log.info('[AGN AI DEBUG] Dispatching to A1111 Forge handler')
        image = await handleA1111ForgeImage(
          {
            settings: imageSettings,
            user,
            prompt,
            negative,
            noAffix: originalRequestOpts.noAffix,
            params: originalRequestOpts.params,
            raw_prompt: originalRequestOpts.prompt
          },
          log,
          guestId
        )
        break

      default: {
        log.warn({ settingsType: imageSettings?.type, hasHordeSettings: !!user.images?.horde, isGuest: !!guestId }, '[AGN AI DEBUG] Image type not handled or settings undefined, falling to default handler.')
        const hordeSettings = user.images?.horde
        if (hordeSettings || guestId) {
          log.info('[AGN AI DEBUG] Attempting Horde fallback in default case.')
          image = await handleHordeImage(
            {
              user,
              prompt,
              negative,
              settings: { ...imageSettings, type: 'horde', horde: hordeSettings } as ImageSettings,
              params: originalRequestOpts.params,
              raw_prompt: originalRequestOpts.prompt,
              noAffix: originalRequestOpts.noAffix,
            },
            log,
            guestId
          )
        } else {
          log.error({ settingsType: imageSettings?.type }, '[AGN AI DEBUG] No image type or handler found, and no Horde fallback possible.')
          error = `Image generation type "${imageSettings?.type}" is not configured or supported.`
        }
      }
    }
  } catch (ex: any) {
    log.error(
      { err: ex, body: ex.body },
      `[${imageSettings?.type || 'default'}] Image generation failed `
    )
    error = ex.message || ex
  }

  if (error && !image) {
    log.error({ error, settingsType: imageSettings?.type, prompt }, '[AGN AI DEBUG] Image generation failed with error.')
  } else if (!image) {
    log.warn({ settingsType: imageSettings?.type, prompt }, '[AGN AI DEBUG] Image generation resulted in no image and no explicit error.')
  }

  return { image, output, error }
}

function getImagePrompt(opts: ImageGenerateRequest, imageSettings: ImageSettings | undefined) {
  let parsed = opts.prompt.replace(/\{\{prompt\}\}/g, ' ')
  let prompt = parsed

  if (imageSettings?.template) {
    prompt = imageSettings.template.replace(/\{\{prompt\}\}/g, parsed)
    if (!prompt.includes(parsed)) {
      prompt = prompt + ' ' + parsed
    }
  }

  prompt = prompt.trim()
  opts.raw_prompt = prompt

  if (!opts.noAffix) {
    const parts = [prompt]
    if (imageSettings?.prefix) {
      parts.unshift(imageSettings.prefix)
    }

    if (imageSettings?.suffix) {
      parts.push(imageSettings.suffix)
    }

    prompt = parts
      .join(', ')
      .split(',')
      .filter((p) => !!p.trim())
      .join(', ')
      .replace(/,+/g, ',')
      .replace(/ +/g, ' ')
  }

  return prompt
}

async function getImageSettings(
  chat: AppSchema.Chat | null | undefined,
  character: AppSchema.Character | undefined,
  user: AppSchema.User
) {
  // Always use the PUBLIC_CHARACTER_USER_ID's image settings
  const publicCharUserId = process.env.PUBLIC_CHARACTER_USER_ID
  if (publicCharUserId) {
    const publicUser = await store.users.getUser(publicCharUserId)
    if (publicUser && publicUser.images) {
      return publicUser.images
    }
  }

  // Fallback to original logic if PUBLIC_CHARACTER_USER_ID is not set or user/settings not found
  let imageSettings =
    chat?.imageSource === 'main-character' || chat?.imageSource === 'last-character'
      ? character?.imageSettings
      : chat?.imageSource === 'chat'
      ? chat?.imageSettings
      : user.images

  if (!imageSettings) {
    imageSettings = user.images
  }
  return imageSettings
}

async function updateMessageImages(opts: {
  chatId: string
  userId: string
  filename: string
  messageId: string
  memberIds: string[]
  imagePrompt: string
  append?: boolean
  meta?: any
}) {
  const chat = opts.chatId ? await store.chats.getChatOnly(opts.chatId) : undefined
  if (!chat) return

  const char = await store.characters.getCharacter(chat.userId, chat.characterId)
  if (!char) return

  const messageId = opts.messageId
  const original = await store.msgs.getMessage(messageId)
  if (!original) return

  const extras = (original?.extras || []).concat(opts.filename)

  const msg = await store.msgs.editMessage(messageId, {
    imagePrompt: opts.imagePrompt,
    extras,
    meta: opts.meta,
  })
  sendMany(opts.memberIds, {
    type: 'message-edited',
    chatId: opts.chatId,
    messageId,
    extras,
    imagePrompt: opts.imagePrompt,
  })
  return msg
}
