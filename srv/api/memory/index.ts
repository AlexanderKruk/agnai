import { store } from '../../db'
import { memory } from '../validation'
import { createCrudApi } from '../shared/crud-controller'

// Create memory book store adapter
const memoryStore = {
  getMany: (userId: string) => store.memory.getBooks(userId),
  getOne: async (id: string) => {
    const book = await store.memory.getBook(id)
    return book || null
  },
  create: (userId: string, data: any) => store.memory.createBook(userId, data),
  update: (userId: string, id: string, data: any) => store.memory.updateBook(userId, id, data),
  delete: (userId: string, id: string) => store.memory.deleteBook(userId, id)
}

// Create CRUD API with standardized patterns
const { router } = createCrudApi({
  entityName: 'memory book',
  store: memoryStore,
  validation: {
    create: memory.book,
    update: memory.book
  },
  collectionKey: 'books'
})

// Export for use in other modules
export const validBook = memory.book

export default router
