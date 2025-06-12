# MongoDB Test Database Cleanup Guide

This guide explains how to properly clean the MongoDB test database between test runs to ensure test isolation and prevent data contamination.

## Available Cleanup Functions

### 1. Basic Cleanup Functions

Located in `database-cleanup.ts`:

```typescript
// Clean all collections (removes all documents)
await cleanTestDatabase()

// Drop the entire database and recreate indexes
await resetTestDatabase()

// Drop the entire database (warning: removes everything)
await dropTestDatabase()

// Clean only specific collections
await cleanSpecificCollections(['user', 'character'])

// Check if database is clean
const isClean = await isDatabaseClean()
```

### 2. Helper Functions for Tests

```typescript
// Simple helpers for use in test hooks
await cleanMongoDBBetweenTests()  // For beforeEach
await resetMongoDBBetweenTests()  // For beforeEach (more thorough)
```

## Usage Patterns

### Pattern 1: Simple Cleanup (Recommended)

```typescript
import { cleanMongoDBBetweenTests } from './database-cleanup'

describe('My Test Suite', () => {
  beforeEach(cleanMongoDBBetweenTests)
  
  it('should test something', async () => {
    // Test starts with clean database
  })
})
```

### Pattern 2: Manual Cleanup

```typescript
import { cleanTestDatabase } from './database-cleanup'

describe('My Test Suite', () => {
  beforeEach(async () => {
    await cleanTestDatabase()
    // Additional setup if needed
  })
  
  it('should test something', async () => {
    // Test starts with clean database
  })
})
```

### Pattern 3: Using Test Helpers

```typescript
import { createTestSuite } from './test-helpers'
import { TestApp } from './test-helpers'

describe('API Integration Tests', () => {
  let testSuite: IntegrationTestSuite
  
  before(async () => {
    // Test suite automatically handles MongoDB cleanup
    const app: TestApp = { /* your app setup */ }
    testSuite = createTestSuite(app)
  })
  
  beforeEach(async () => {
    await testSuite.beforeEach() // Includes MongoDB cleanup
  })
  
  afterEach(async () => {
    await testSuite.afterEach() // Includes MongoDB cleanup
  })
})
```

### Pattern 4: Complete Reset (For Complex Tests)

```typescript
import { resetMongoDBBetweenTests } from './database-cleanup'

describe('Complex Integration Tests', () => {
  // Use reset instead of clean for tests that modify indexes or schema
  beforeEach(resetMongoDBBetweenTests)
  
  it('should test complex scenarios', async () => {
    // Test starts with completely reset database
  })
})
```

## Collections Cleaned

The cleanup functions target these MongoDB collections:

- `user` - User accounts
- `profile` - User profiles  
- `character` - AI characters
- `chat` - Chat conversations
- `chat-message` - Chat messages
- `chat-member` - Chat memberships
- `chat-invite` - Chat invitations
- `memory` - Memory/lore books
- `scenario` - Scenarios
- `gen-setting` - Generation settings
- `prompt-template` - Prompt templates
- `apikey` - API keys
- `saga-template` - Saga templates
- `saga-session` - Saga sessions
- `chat-lock` - Chat locks
- `evtstore-events` - Event store
- `configuration` - System configuration

## Best Practices

### 1. Always Clean Between Tests
```typescript
// ✅ Good - Ensures test isolation
beforeEach(cleanMongoDBBetweenTests)

// ❌ Bad - Tests may contaminate each other
// No cleanup between tests
```

### 2. Use Appropriate Cleanup Level
```typescript
// ✅ For most tests - fast cleanup
beforeEach(cleanMongoDBBetweenTests)

// ✅ For schema-changing tests - thorough reset
beforeEach(resetMongoDBBetweenTests)

// ❌ Overkill for simple tests
beforeEach(dropTestDatabase) 
```

### 3. Check Database State
```typescript
it('should start with clean database', async () => {
  const isClean = await isDatabaseClean()
  expect(isClean).to.be.true
})
```

### 4. Handle Connection State
```typescript
// Functions automatically check if MongoDB is connected
// If not connected, they skip cleanup gracefully
await cleanTestDatabase() // Safe even if MongoDB not connected
```

## Environment Setup

Make sure your test environment is configured correctly:

```typescript
// In test-setup.ts
process.env.DB_NAME = 'agnai-integration-test' // Use test database
process.env.NODE_ENV = 'test'
```

## Troubleshooting

### Database Not Cleaning
- Check MongoDB connection: `isConnected()`
- Verify test database name: `process.env.DB_NAME`
- Check permissions on test database

### Performance Issues
- Use `cleanTestDatabase()` instead of `resetTestDatabase()` for speed
- Consider cleaning only specific collections if tests are isolated

### Connection Errors
- Ensure MongoDB is running
- Check connection string configuration
- Verify test database exists and is accessible

## Example Test Files

See these example files for complete usage:
- `example-mongodb-cleanup.spec.ts` - Basic cleanup patterns
- `api-endpoints-real.integration.spec.ts` - Real API tests with cleanup
- `test-helpers.ts` - Integrated cleanup in test helpers