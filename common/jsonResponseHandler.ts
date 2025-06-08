export type InferenceState = 'partial' | 'done' | 'error' | 'warning'
export type TickHandler<T = any> = (response: string, state: InferenceState, json?: T) => void

export type JsonType = { title?: string; description?: string; valid?: string } & (
  | { type: 'string'; maxLength?: number }
  | { type: 'integer' }
  | { type: 'enum'; enum: string[] }
  | { type: 'bool' }
)

export type JsonSchema = {
  title: string
  type: 'object'
  properties: Record<string, JsonType>
  required: string[]
}

export interface JsonField {
  name: string
  disabled: boolean
  type: JsonType
}

export const schema = {
  str: (o?: { desc?: string; title?: string; maxLength?: number }) => ({
    type: 'string',
    title: o?.title,
    maxLength: o?.maxLength ? +o.maxLength : undefined,
  }),
  int: (o?: { title?: string; desc?: string }) => ({
    type: 'integer',
    title: o?.title,
    description: o?.desc,
  }),
  enum: (o: { values: string[]; title?: string; desc?: string }) => ({
    type: 'enum',
    enum: o.values,
    title: o.title,
    description: o.desc,
  }),
  bool: (o?: { title?: string; desc?: string }) => ({
    type: 'bool',
    enum: ['true', 'false', 'yes', 'no'],
    title: o?.title,
    description: o?.desc,
  }),
} satisfies Record<string, (...args: any[]) => JsonType>

export function toJsonSchema(body: JsonField[]): JsonSchema | undefined {
  if (!Array.isArray(body) || !body.length) return
  if (body.every((field) => field.disabled)) return

  const sch: JsonSchema = {
    title: 'Response',
    type: 'object',
    properties: {},
    required: [],
  }

  const props: JsonSchema['properties'] = {}

  if (!!body && !Array.isArray(body)) {
    body = Object.entries(body).map(([key, value]) => ({
      name: key,
      disabled: false,
      type: value,
    })) as any
  }

  let added = 0
  for (const { name, disabled, type } of body) {
    if (disabled) continue

    added++
    props[name] = { ...type }
    switch (type.type) {
      case 'string': {
        props[name] = schema.str(type)
        break
      }

      case 'bool': {
        props[name] = schema.bool(type)
        props[name].type = 'enum' as any
        break
      }

      case 'enum': {
        props[name] = {
          type: 'enum',
          enum: type.enum,
        }
        break
      }

      case 'integer': {
        props[name] = schema.int(type)
        break
      }
    }

    delete props[name].valid

    if (type.type === 'bool') {
      props[name].type = 'enum'

      // @ts-ignore
      props[name].enum = ['true', 'false', 'yes', 'no']
    }
    sch.required.push(name)
  }

  sch.properties = props

  if (added === 0) return
  return sch
}

export function fromJsonResponse(schema: JsonField[], response: any, output: any = {}): any {
  const json: Record<string, any> = tryJsonParseResponse(response)

  for (let [key, value] of Object.entries(json)) {
    const underscored = key.replace(/ /g, '_')

    if (underscored in schema) {
      key = underscored
    }

    const def = schema.find((s) => s.name === key)
    if (!def) continue

    output[key] = value
    if (def.type.type === 'bool') {
      output[key] = value.trim() === 'true' || value.trim() === 'yes'
    }
  }

  return output
}

export function tryJsonParseResponse(res: string) {
  if (typeof res === 'object') return res
  try {
    const json = JSON.parse(res)
    return json
  } catch (ex) {}

  try {
    const json = JSON.parse(res + '}')
    return json
  } catch (ex) {}

  try {
    if (res.trim().endsWith(',')) {
      const json = JSON.parse(res.slice(0, -1))
      return json
    }
  } catch (ex) {}

  return {}
}

export function onJsonTickHandler(
  schema: JsonField[],
  handler: (res: any, state: InferenceState) => void
) {
  let curr: any = {}
  const parser: TickHandler = (res, state) => {
    if (state === 'done') {
      const body = fromJsonResponse(schema, tryJsonParseResponse(res))
      if (Object.keys(body).length === 0) {
        handler(curr, state)
        return
      }

      handler(body, state)
      return
    }

    if (state === 'partial') {
      const body = fromJsonResponse(schema, tryJsonParseResponse(res))
      const keys = Object.keys(body).length
      if (keys === 0) return

      const changed = Object.keys(curr).length !== keys
      if (!changed) return

      Object.assign(curr, body)
      handler(curr, state)
      return
    }

    handler(curr, state)
  }

  return parser
}