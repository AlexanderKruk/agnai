import { assertValid } from '/common/valid'
import { store } from '../../db'
import { handle } from '../wrap'
import { createStandardRouter } from '../middleware'
import { memory } from '../validation'

const router = createStandardRouter('authenticated')

// Export for use in other modules
export const validBook = memory.book

const getUserBooks = handle(async ({ userId }) => {
  const books = await store.memory.getBooks(userId!)
  return { books }
})

const createBook = handle(async ({ body, userId }) => {
  assertValid(memory.book, body)

  const newBook = await store.memory.createBook(userId!, body)

  return newBook
})

const updateBook = handle(async ({ body, userId, params }) => {
  const id = params.id
  assertValid(memory.book, body)
  await store.memory.updateBook(userId!, id!, body)

  return { success: true }
})

const removeBook = handle(async ({ userId, params }) => {
  await store.memory.deleteBook(userId, params.id)
  return { success: true }
})

router.get('/', getUserBooks)
router.post('/', createBook)
router.put('/:id', updateBook)
router.delete('/:id', removeBook)

export default router
