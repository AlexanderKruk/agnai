/**
 * Database Cleanup Utilities for Integration Tests
 * 
 * Provides functions to clean/reset MongoDB test database between test runs
 * SAFETY: Only operates on test databases to prevent development data loss
 */

import { db } from '../../srv/db/client'
import { AllDoc } from '../../common/types/schema'

/**
 * Get current database name from environment or connection
 */
function getCurrentDatabaseName(): string {
  return process.env.DB_NAME || 'agnai'
}

/**
 * Check if we're currently connected to a test database
 */
function isTestDatabase(): boolean {
  const dbName = getCurrentDatabaseName()
  const isTest = process.env.NODE_ENV === 'test'
  const isTestDb = dbName.includes('test') || dbName.includes('integration') || dbName.includes('copy')
  
  return isTest && isTestDb
}

/**
 * Cleans all test data from MongoDB collections
 * SAFETY: Only cleans if connected to a test database
 */
export async function cleanTestDatabase(): Promise<void> {
  // Safety check: only clean test databases
  if (!isTestDatabase()) {
    const dbName = getCurrentDatabaseName()
    console.log(`🚫 SAFETY: Refusing to clean database '${dbName}' - not a test database`)
    console.log(`   Current NODE_ENV: ${process.env.NODE_ENV}`)
    console.log(`   Current DB_NAME: ${dbName}`)
    console.log(`   Use a database name containing 'test' or 'integration' for cleaning`)
    return
  }

  try {
    const dbName = getCurrentDatabaseName()
    console.log(`🧹 Cleaning test database: ${dbName}`)

    // List of collections to clean - using proper AllDoc['kind'] types
    const collections: Array<AllDoc['kind']> = [
      'user',
      'profile', 
      'character',
      'chat',
      'chat-message',
      'memory',
      'scenario',
      'gen-setting',
      'subscription-tier',
      'announcement',
    ]

    // Clean each collection
    for (const collectionName of collections) {
      try {
        const collection = db(collectionName)
        const result = await collection.deleteMany({})
        if (result.deletedCount > 0) {
          console.log(`   Cleaned ${result.deletedCount} documents from ${collectionName}`)
        }
      } catch (error) {
        // Collection might not exist, which is fine
        console.log(`   Collection ${collectionName} does not exist or could not be cleaned`)
      }
    }

    console.log(`✅ Test database '${dbName}' cleaned successfully`)
  } catch (error) {
    console.error('❌ Failed to clean test database:', error)
    throw error
  }
}

/**
 * Simple helper function for use in beforeEach hooks
 * SAFETY: Only cleans test databases
 */
export async function cleanMongoDBBetweenTests(): Promise<void> {
  await cleanTestDatabase()
}

/**
 * Check if database is clean (useful for debugging)
 */
export async function isDatabaseClean(): Promise<boolean> {
  try {
    const collections: Array<AllDoc['kind']> = ['user', 'character', 'chat', 'chat-message']
    
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