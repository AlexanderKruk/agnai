/**
 * Example Test File - MongoDB Cleanup Usage
 * 
 * Demonstrates how to properly clean MongoDB between test runs
 */

import { expect } from 'chai'
import { 
  cleanMongoDBBetweenTests, 
  resetMongoDBBetweenTests,
  cleanTestDatabase,
  isDatabaseClean 
} from './database-cleanup'
import { setupTestEnvironment, teardownTestEnvironment } from './test-setup'
import { connect } from '../../srv/db/client'

describe('MongoDB Cleanup Example Tests', () => {
  before(async () => {
    await setupTestEnvironment()
    await connect()
  })

  after(async () => {
    await teardownTestEnvironment()
  })

  // Method 1: Use the simple helper function
  beforeEach(cleanMongoDBBetweenTests)

  // Method 2: Use the reset helper for more thorough cleanup
  // beforeEach(resetMongoDBBetweenTests)

  // Method 3: Manual cleanup in beforeEach hook
  // beforeEach(async () => {
  //   await cleanTestDatabase()
  // })

  it('should start with a clean database', async () => {
    const isClean = await isDatabaseClean()
    expect(isClean).to.be.true
  })

  it('should clean database between tests', async () => {
    // This test would create some data...
    // The next test should still start clean
    const isClean = await isDatabaseClean()
    expect(isClean).to.be.true
  })

  it('should demonstrate manual cleanup', async () => {
    // You can also manually clean during a test if needed
    await cleanTestDatabase()
    
    const isClean = await isDatabaseClean()
    expect(isClean).to.be.true
  })
})