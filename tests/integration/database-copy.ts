/**
 * Database Copy Utilities for Integration Tests
 * 
 * Copies the production 'agnai' database to a test copy before testing,
 * then removes the copy after testing to maintain data safety
 */

import { MongoClient } from 'mongodb'

/**
 * Get MongoDB connection URL from environment
 */
function getMongoUrl(): string {
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '27017'
  const username = process.env.DB_USERNAME
  const password = process.env.DB_PASSWORD
  
  if (username && password) {
    return `mongodb://${username}:${password}@${host}:${port}`
  }
  
  return `mongodb://${host}:${port}`
}

/**
 * Get database names for copying
 */
function getDatabaseNames(): { source: string; test: string } {
  const source = 'agnai'
  const test = `agnai-test-copy-${Date.now()}`
  
  return { source, test }
}

/**
 * Copy entire database from source to destination
 */
async function copyDatabase(sourceDb: string, targetDb: string): Promise<void> {
  const client = new MongoClient(getMongoUrl())
  
  try {
    await client.connect()
    console.log(`📋 Copying database '${sourceDb}' to '${targetDb}'`)
    
    const sourceDatabase = client.db(sourceDb)
    const targetDatabase = client.db(targetDb)
    
    // Get all collections from source database
    const collections = await sourceDatabase.listCollections().toArray()
    
    if (collections.length === 0) {
      console.log(`   Source database '${sourceDb}' is empty, creating empty copy`)
      return
    }
    
    // Copy each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name
      console.log(`   Copying collection: ${collectionName}`)
      
      try {
        const sourceCollection = sourceDatabase.collection(collectionName)
        const targetCollection = targetDatabase.collection(collectionName)
        
        // Get all documents from source collection
        const documents = await sourceCollection.find({}).toArray()
        
        if (documents.length > 0) {
          // Insert documents into target collection
          await targetCollection.insertMany(documents)
          console.log(`     Copied ${documents.length} documents`)
        } else {
          console.log(`     Collection ${collectionName} is empty`)
        }
        
        // Copy indexes
        const indexes = await sourceCollection.indexes()
        for (const index of indexes) {
          if (index.name !== '_id_') { // Skip default _id index
            try {
              await targetCollection.createIndex(index.key, {
                name: index.name,
                unique: index.unique,
                sparse: index.sparse,
                background: index.background
              })
            } catch (error) {
              // Index might already exist or have conflicts, continue
              console.log(`     Could not copy index ${index.name}: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        }
        
      } catch (error) {
        console.error(`     Error copying collection ${collectionName}:`, error instanceof Error ? error.message : String(error))
        // Continue with other collections
      }
    }
    
    console.log(`✅ Database copy completed: ${sourceDb} → ${targetDb}`)
    
  } catch (error) {
    console.error(`❌ Failed to copy database:`, error)
    throw error
  } finally {
    await client.close()
  }
}

/**
 * Remove a database completely
 */
async function removeDatabase(dbName: string): Promise<void> {
  const client = new MongoClient(getMongoUrl())
  
  try {
    await client.connect()
    console.log(`🗑️  Removing database '${dbName}'`)
    
    const database = client.db(dbName)
    await database.dropDatabase()
    
    console.log(`✅ Database '${dbName}' removed successfully`)
    
  } catch (error) {
    console.error(`❌ Failed to remove database '${dbName}':`, error)
    // Don't throw error for cleanup operations
  } finally {
    await client.close()
  }
}

/**
 * Check if a database exists
 */
async function databaseExists(dbName: string): Promise<boolean> {
  const client = new MongoClient(getMongoUrl())
  
  try {
    await client.connect()
    const adminDb = client.db().admin()
    const databases = await adminDb.listDatabases()
    
    return databases.databases.some(db => db.name === dbName)
    
  } catch (error) {
    console.error(`Error checking if database '${dbName}' exists:`, error)
    return false
  } finally {
    await client.close()
  }
}

/**
 * Create a copy of the agnai database for testing
 * Returns the name of the test database copy
 */
export async function createTestDatabaseCopy(): Promise<string> {
  const { source, test } = getDatabaseNames()
  
  console.log(`🔍 Checking if source database '${source}' exists...`)
  
  // Check if source database exists
  const sourceExists = await databaseExists(source)
  if (!sourceExists) {
    console.log(`⚠️  Source database '${source}' does not exist, will create empty test database`)
    // Create empty test database by setting environment
    process.env.DB_NAME = test
    console.log(`🔧 Environment updated to use empty test database: ${test}`)
    return test
  }
  
  console.log(`✅ Source database '${source}' exists, proceeding with copy...`)
  
  // Copy the database
  await copyDatabase(source, test)
  
  // Update environment to use test copy
  process.env.DB_NAME = test
  console.log(`🔧 Environment updated to use test database: ${test}`)
  
  return test
}

/**
 * Remove the test database copy and restore original environment
 */
export async function removeTestDatabaseCopy(testDbName: string): Promise<void> {
  // Restore original environment
  process.env.DB_NAME = 'agnai'
  console.log(`🔧 Environment restored to use original database: agnai`)
  
  // Remove the test copy
  await removeDatabase(testDbName)
}

/**
 * Database copy manager for test lifecycle
 */
export class TestDatabaseManager {
  private testDbName: string | null = null
  
  /**
   * Setup: Create database copy before tests
   */
  async setup(): Promise<void> {
    console.log(`🏗️  Setting up test database copy...`)
    this.testDbName = await createTestDatabaseCopy()
    console.log(`✅ Test database copy ready: ${this.testDbName}`)
  }
  
  /**
   * Cleanup: Remove database copy after tests
   */
  async cleanup(): Promise<void> {
    if (this.testDbName) {
      console.log(`🧹 Cleaning up test database copy...`)
      await removeTestDatabaseCopy(this.testDbName)
      this.testDbName = null
      console.log(`✅ Test database copy cleanup completed`)
    }
  }
  
  /**
   * Get the current test database name
   */
  getTestDatabaseName(): string | null {
    return this.testDbName
  }
}

// Export singleton instance
export const testDbManager = new TestDatabaseManager()