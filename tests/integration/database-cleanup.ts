/**
 * Database Cleanup Utilities for Integration Tests
 * 
 * Provides functions to clean/reset MongoDB test database between test runs
 */

import { db } from '../../srv/db/client'

/**
 * Cleans all test data from MongoDB collections
 * This removes all documents but keeps collections and indexes intact
 */
export async function cleanTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanTestDatabase can only be called in test environment')
  }

  try {
    // List of collections to clean
    const collections = [
      'user',
      'profile', 
      'character',
      'chat',
      'chat-message',
      'memory',
      'scenario',
      'gen-setting',
      'subscription',
      'admin-setting',
    ]

    // Clean each collection
    for (const collectionName of collections) {
      try {
        const collection = db(collectionName)
        await collection.deleteMany({})
        console.log(`Cleaned collection: ${collectionName}`)
      } catch (error) {
        // Collection might not exist, which is fine
        console.log(`Collection ${collectionName} does not exist or could not be cleaned:`, error)
      }
    }

    console.log('Test database cleaned successfully')
  } catch (error) {
    console.error('Failed to clean test database:', error)
    throw error
  }
}

/**
 * Simple helper function for use in beforeEach hooks
 */
export async function cleanMongoDBBetweenTests(): Promise<void> {
  await cleanTestDatabase()
}

/**
 * Check if database is clean (useful for debugging)
 */
export async function isDatabaseClean(): Promise<boolean> {
  try {
    const collections = ['user', 'character', 'chat', 'chat-message']
    
    for (const collectionName of collections) {
      try {
        const collection = db(collectionName)
        const count = await collection.countDocuments({})
        if (count > 0) {
          console.log(`Collection ${collectionName} has ${count} documents`)
          return false
        }
      } catch (error) {
        // Collection doesn't exist, which is fine
        continue
      }
    }
    
    return true
  } catch (error) {
    console.error('Error checking database cleanliness:', error)
    return false
  }
}