import { v4 } from 'uuid'
import { db } from './client'
import { AppSchema } from '../../common/types/schema'
import { now } from './util'
import { UpdateFilter } from 'mongodb'
import { config } from '../config'

export type CharacterUpdate = Partial<
  Pick<
    AppSchema.Character,
    | 'name'
    | 'avatar'
    | 'persona'
    | 'sampleChat'
    | 'greeting'
    | 'scenario'
    | 'description'
    | 'culture'
    | 'tags'
    | 'favorite'
    | 'voice'
    | 'alternateGreetings'
    | 'characterBook'
    | 'extensions'
    | 'systemPrompt'
    | 'postHistoryInstructions'
    | 'insert'
    | 'creator'
    | 'characterVersion'
    | 'appearance'
    | 'sprite'
    | 'visualType'
    | 'voiceDisabled'
    | 'imageSettings'
    | 'json'
    | 'folder'
  >
>

export async function createCharacter(
  userId: string,
  char: Pick<
    AppSchema.Character,
    | 'name'
    | 'appearance'
    | 'avatar'
    | 'persona'
    | 'sampleChat'
    | 'greeting'
    | 'scenario'
    | 'description'
    | 'culture'
    | 'tags'
    | 'favorite'
    | 'voice'
    | 'alternateGreetings'
    | 'characterBook'
    | 'extensions'
    | 'systemPrompt'
    | 'postHistoryInstructions'
    | 'insert'
    | 'creator'
    | 'characterVersion'
    | 'sprite'
    | 'visualType'
    | 'voiceDisabled'
    | 'imageSettings'
    | 'json'
  >
) {
  const newChar: AppSchema.Character = {
    _id: v4(),
    kind: 'character',
    userId,
    createdAt: now(),
    updatedAt: now(),
    ...char,
  }

  await db('character').insertOne(newChar)
  return newChar
}

export async function updateCharacter(id: string, userId: string, char: CharacterUpdate) {
  // Check if this is a public character (which should be protected)
  if (config.publicCharacterUserId && config.publicCharacterUserId !== userId) {
    const character = await db('character').findOne({ _id: id })
    if (character && character.userId === config.publicCharacterUserId) {
      throw new Error('Cannot modify public characters')
    }
  }

  const edit = { ...char, updatedAt: now() }
  if (edit.avatar === undefined) {
    delete edit.avatar
  }
  await db('character').updateOne({ _id: id, userId }, { $set: edit })
  return getCharacter(userId, id)
}

export async function bulkUpdate(
  userId: string,
  charIds: string[],
  update: { folder?: string; addTag?: string; removeTag?: string }
) {
  const set: UpdateFilter<AppSchema.Character> = {}

  if (update.folder) {
    set.folder = update.folder
  }

  if (update.addTag) {
    set.$push = { tags: update.addTag }
  }

  if (update.removeTag) {
    set.$pull = { tags: update.removeTag }
  }

  const result = await db('character').updateMany(
    { where: { userId, _id: { $in: charIds } } },
    { $set: set }
  )

  return result.matchedCount
}

export async function partialUpdateCharacter(id: string, userId: string, char: CharacterUpdate) {
  // Check if this is a public character (which should be protected)
  if (config.publicCharacterUserId && config.publicCharacterUserId !== userId) {
    const character = await db('character').findOne({ _id: id })
    if (character && character.userId === config.publicCharacterUserId) {
      throw new Error('Cannot modify public characters')
    }
  }

  const edit = { ...char, updatedAt: now() }

  await db('character').updateOne({ _id: id, userId }, { $set: edit })
  return getCharacter(userId, id)
}

export async function getCharacter(
  userId: string,
  id: string
): Promise<AppSchema.Character | undefined> {
  // First try to find the character with the userId check
  const char = await db('character').findOne({ _id: id, userId })
  
  // If not found and userId is provided, check if it belongs to the public characters user
  if (!char && config.publicCharacterUserId) {
    const publicChar = await db('character').findOne({ _id: id, userId: config.publicCharacterUserId })
    return publicChar || undefined
  }
  
  return char || undefined
}

export async function getCharacters(userId: string) {
  const query = config.publicCharacterUserId 
    ? { $or: [{ userId }, { userId: config.publicCharacterUserId }] } 
    : { userId };
    
  const list = await db('character')
    .find(query)
    .project({
      _id: 1,
      userId: 1,
      name: 1,
      avatar: 1,
      description: 1,
      favorite: 1,
      tags: 1,
      createdAt: 1,
      updatedAt: 1,
      voice: 1,
      voiceDisabled: 1,
      folder: 1,
    })
    .toArray()

  return list
}

export async function deleteCharacter(opts: { charId: string; userId: string }) {
  // Check if this is a public character (which should be protected)
  if (config.publicCharacterUserId) {
    const character = await db('character').findOne({ _id: opts.charId })
    if (character && character.userId === config.publicCharacterUserId && opts.userId !== config.publicCharacterUserId) {
      throw new Error('Cannot delete public characters')
    }
  }

  await db('character').deleteOne({ _id: opts.charId, userId: opts.userId, kind: 'character' }, {})
  const chats = await db('chat').find({ characterId: opts.charId, userId: opts.userId }).toArray()
  await db('chat-message').deleteMany({ chatId: { $in: chats.map((ch) => ch._id) } })
  await db('chat').deleteMany({ characterId: opts.charId, userId: opts.userId })
}

export async function getCharacterList(charIds: string[], userId?: string) {
  const project = {
    _id: 1,
    userId: 1,
    name: 1,
    avatar: 1,
    description: 1,
    favorite: 1,
    tags: 1,
    createdAt: 1,
    updatedAt: 1,
    voice: 1,
    visualType: 1,
    sprite: 1,
    voiceDisabled: 1,
    folder: 1,
  }
  
  // Build a query that includes either specified charIds, the user's own characters, or public characters
  let query: any = {};
  
  if (charIds.length > 0) {
    query._id = { $in: charIds };
  }
  
  if (userId) {
    if (charIds.length > 0) {
      // If we have specific charIds and a userId, show those chars plus the user's own chars and public chars
      const conditions = [{ _id: { $in: charIds } }, { userId }];
      
      if (config.publicCharacterUserId) {
        conditions.push({ userId: config.publicCharacterUserId });
      }
      
      query = { $or: conditions };
    } else {
      // If we only have userId but no charIds, show the user's chars and public chars
      if (config.publicCharacterUserId) {
        query = { $or: [{ userId }, { userId: config.publicCharacterUserId }] };
      } else {
        query = { userId };
      }
    }
  } else if (charIds.length === 0) {
    // If no userId and no charIds, don't return all characters
    // Just return an empty array
    return [];
  }
  
  const list = await db('character')
    .find(query)
    .project(project)
    .toArray()
  return list
}
