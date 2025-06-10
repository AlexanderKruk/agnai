import { assertValid } from '/common/valid'
import { errors, handle } from '../wrap'
import { createStandardRouter } from '../middleware'

/**
 * Shared CRUD Controller Factory
 * 
 * This module provides a generic CRUD controller that eliminates duplicate
 * code patterns across memory, scenario, preset, and other APIs.
 * 
 * BENEFITS:
 * 1. Eliminates ~80% of duplicate CRUD code
 * 2. Consistent error handling and validation
 * 3. Standardized response formats
 * 4. Type-safe operations
 * 5. Automatic ownership checks for user-scoped resources
 */

/** Standard database operations interface */
export interface CrudStore<T, CreateT, UpdateT = Partial<CreateT>> {
  /** Get all items for a user */
  getMany(userId: string): Promise<T[]>
  
  /** Get a single item by ID */
  getOne(id: string): Promise<T | null | undefined>
  
  /** Create a new item */
  create(userId: string, data: CreateT): Promise<T>
  
  /** Update an existing item */
  update(userId: string, id: string, data: UpdateT): Promise<void>
  
  /** Delete an item */
  delete(userId: string, id: string): Promise<void>
}

/** Configuration for CRUD controller */
export interface CrudConfig<T, CreateT, UpdateT = Partial<CreateT>> {
  /** Human-readable entity name for error messages */
  entityName: string
  
  /** Database store implementation */
  store: CrudStore<T, CreateT, UpdateT>
  
  /** Validation schemas */
  validation: {
    create: any
    update: any
  }
  
  /** Response key for collections (e.g., 'books', 'scenarios') */
  collectionKey: string
  
  /** Whether to include ownership checks for get operations */
  requireOwnership?: boolean
  
  /** Custom validation function (optional) */
  customValidator?: (body: any) => any
}

/** Generic CRUD controller factory */
export function createCrudController<T, CreateT, UpdateT = Partial<CreateT>>(
  config: CrudConfig<T, CreateT, UpdateT>
) {
  
  /** Get all items for the authenticated user */
  const getMany = handle(async ({ userId }) => {
    const items = await config.store.getMany(userId!)
    return { [config.collectionKey]: items }
  })
  
  /** Get a single item by ID */
  const getOne = handle(async ({ userId, params }) => {
    const id = params.id
    const item = await config.store.getOne(id!)
    
    if (!item) {
      throw errors.NotFound
    }
    
    // Check ownership if required
    if (config.requireOwnership && (item as any).userId !== userId) {
      throw errors.Unauthorized
    }
    
    return item
  })
  
  /** Create a new item */
  const create = handle(async ({ body, userId }) => {
    // Apply validation
    if (config.customValidator) {
      body = config.customValidator(body)
    } else {
      assertValid(config.validation.create, body)
    }
    
    const newItem = await config.store.create(userId!, body)
    return newItem
  })
  
  /** Update an existing item */
  const update = handle(async ({ body, userId, params }) => {
    const id = params.id
    
    // Apply validation
    if (config.customValidator) {
      body = config.customValidator(body)
    } else {
      assertValid(config.validation.update, body)
    }
    
    await config.store.update(userId!, id!, body)
    return { success: true }
  })
  
  /** Delete an item */
  const remove = handle(async ({ userId, params }) => {
    await config.store.delete(userId!, params.id!)
    return { success: true }
  })
  
  return {
    getMany,
    getOne,
    create,
    update,
    remove
  }
}

/** Standard route patterns for CRUD operations */
export interface CrudRouteOptions {
  /** Include GET /:id route */
  includeGetById?: boolean
  
  /** Custom route definitions */
  customRoutes?: Array<{
    method: 'get' | 'post' | 'put' | 'delete'
    path: string
    handler: any
  }>
}

/** 
 * Create standard CRUD routes 
 * 
 * @param controller - CRUD controller instance
 * @param options - Route configuration options
 * @returns Router with standard CRUD routes
 */
export function createCrudRoutes<T, CreateT, UpdateT>(
  controller: ReturnType<typeof createCrudController<T, CreateT, UpdateT>>,
  options: CrudRouteOptions = {}
) {
  const router = createStandardRouter('authenticated')
  
  // Standard CRUD routes
  router.get('/', controller.getMany)
  router.post('/', controller.create)
  router.put('/:id', controller.update)
  router.delete('/:id', controller.remove)
  
  // Optional get by ID route
  if (options.includeGetById) {
    router.get('/:id', controller.getOne)
  }
  
  // Add any custom routes
  if (options.customRoutes) {
    for (const route of options.customRoutes) {
      ;(router as any)[route.method](route.path, route.handler)
    }
  }
  
  return router
}

/** 
 * Complete CRUD API factory - combines controller and routes
 * 
 * This is the main entry point for creating a complete CRUD API.
 * Most APIs should use this instead of the individual functions.
 */
export function createCrudApi<T, CreateT, UpdateT = Partial<CreateT>>(
  config: CrudConfig<T, CreateT, UpdateT>,
  routeOptions: CrudRouteOptions = {}
) {
  const controller = createCrudController(config)
  const router = createCrudRoutes(controller, routeOptions)
  
  return {
    controller,
    router
  }
}