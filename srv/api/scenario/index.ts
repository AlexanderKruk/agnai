import { store } from '../../db'
import { errors } from '../wrap'
import { assertValid } from '/common/valid'
import { AppSchema } from '/common/types'
import { scenario } from '../validation'
import { createCrudApi } from '../shared/crud-controller'

// Scenario-specific validation triggers
const validateOnGreetingTrigger = {
  kind: 'string',
} as const

const validateOnManualTriggerTrigger = {
  kind: 'string',
  probability: 'number',
} as const

const validateOnChatOpenedTrigger = {
  kind: 'string',
  awayHours: 'number',
} as const

const validateOnCharacterMessageReceivedTrigger = {
  kind: 'string',
  minMessagesSinceLastEvent: 'number',
} as const

// Create scenario store adapter
const scenarioStore = {
  getMany: (userId: string) => store.scenario.getScenarios(userId),
  getOne: async (id: string) => {
    const scenario = await store.scenario.getScenario(id)
    return scenario || null
  },
  create: (userId: string, data: any) => store.scenario.createScenario(userId, data),
  update: (userId: string, id: string, data: any) => store.scenario.updateScenario(userId, id, data),
  delete: (userId: string, id: string) => store.scenario.deleteScenario(userId, id)
}

// Create CRUD API with scenario-specific validation
const { router } = createCrudApi({
  entityName: 'scenario',
  store: scenarioStore,
  validation: {
    create: scenario.create,
    update: scenario.update
  },
  collectionKey: 'scenarios',
  requireOwnership: true,
  customValidator: assertScenario
}, {
  includeGetById: true  // Scenarios need individual get endpoint
})

export default router

function assertScenario(body: any) {
  assertValid(scenario.create, body)
  body.entries = body.entries.map((entry: any) => ({
    ...entry,
    trigger: assertTrigger(entry.trigger),
  }))
  return body
}

function assertTrigger(body: any) {
  switch (body.kind as AppSchema.ScenarioTriggerKind) {
    case 'onGreeting':
      assertValid(validateOnGreetingTrigger, body)
      return body
    case 'onManualTrigger':
      assertValid(validateOnManualTriggerTrigger, body)
      return body
    case 'onChatOpened':
      assertValid(validateOnChatOpenedTrigger, body)
      return body
    case 'onCharacterMessageReceived':
      assertValid(validateOnCharacterMessageReceivedTrigger, body)
      return body
    default:
      throw errors.BadRequest
  }
}
