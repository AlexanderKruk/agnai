import { AppSchema } from '../../common/types/schema'
import { createStore } from './create'
import {
  ChatTree,
  removeChatTreeNodes,
  resolveChatPath,
  sortAsc,
  toChatGraph,
  updateChatTreeNode,
} from '/common/chat'

export type ChatGraphStoreState = {
  graph: {
    tree: ChatTree
    root: string
  }
}

const initState: ChatGraphStoreState = {
  graph: {
    tree: {},
    root: '',
  },
}

export const chatGraphStore = createStore<ChatGraphStoreState>(
  'chatGraph',
  initState
)((getState, setState) => {
  return {
    setGraph(state: ChatGraphStoreState, graph: { tree: ChatTree; root: string }) {
      return { graph }
    },

    updateTreeNode(state: ChatGraphStoreState, message: AppSchema.ChatMessage) {
      const { graph } = state
      const tree = updateChatTreeNode(graph.tree, message)
      return { graph: { ...graph, tree } }
    },

    removeTreeNodes(state: ChatGraphStoreState, messageIds: string[]) {
      const { graph } = state
      const tree = removeChatTreeNodes(graph.tree, messageIds)
      return { graph: { ...graph, tree } }
    },

    buildGraphFromMessages(state: ChatGraphStoreState, messages: AppSchema.ChatMessage[]) {
      messages.sort(sortAsc)
      const newGraph = toChatGraph(messages)
      return { graph: newGraph }
    },

  }
})

// Utility functions for working with chat graphs
export function getFullMessagePath(tree: ChatTree, leafId: string): AppSchema.ChatMessage[] {
  return resolveChatPath(tree, leafId)
}

export function getMessagePath(tree: ChatTree, leafId: string): AppSchema.ChatMessage[] {
  return resolveChatPath(tree, leafId)
}

export function getRecentMessages(
  fullPath: AppSchema.ChatMessage[], 
  pageSize: number = 20
): { recent: AppSchema.ChatMessage[]; history: AppSchema.ChatMessage[] } {
  const history = fullPath.slice()
  const recent = history.splice(-pageSize)
  
  return { recent, history }
}

export function calculateLeafId(messages: AppSchema.ChatMessage[], leafId?: string): string {
  const graph = toChatGraph(messages)
  let leaf = leafId || messages.slice(-1)[0]?._id || ''

  // If the leaf has been deleted then the path won't load
  // So, if the leaf doesn't exist, use the most recent message
  if (leafId) {
    const node = graph.tree[leafId]
    if (!node) {
      leaf = messages.slice(-1)[0]?._id || ''
    }
  }

  return leaf
}