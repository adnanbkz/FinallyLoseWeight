/**
 * Contract test: web/src/api/types.ts against docs/openapi.json, the OpenAPI document generated from the API
 * (the API tests fail when that file is out of date, see api/tests/.../Contract/OpenApiSnapshotTests.cs).
 *
 * Each `Spec<T>` below has exactly one valid value per property, computed by the compiler from the TS type, so
 * `npm run typecheck` fails when types.ts changes without this file, and this test fails when the API changes
 * without types.ts. Together: renaming a property, changing its type or nullability, adding/removing an error
 * `code` or an enum value on one side only turns CI red.
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import openApiText from '../../../docs/openapi.json?raw'
import {
  MEAL_TYPES,
  type ApiErrorCode,
  type Cardio,
  type CardioEstimate,
  type CardioInput,
  type DaySummary,
  type DayTotals,
  type ExportData,
  type Machine,
  type MachineField,
  type Meal,
  type MealInput,
  type MealType,
  type Profile,
  type ProfileInput,
  type Stats,
  type StatsDay,
  type Steps,
  type StepsInput,
  type Weight,
  type WeightInput,
  type WeightSource,
} from './types'

// ---------- Compile-time encoding of the TS types ----------

/** JSON kind of a TS type. A union of string literals is an 'enum'. */
type Kind<T> = [T] extends [boolean]
  ? 'boolean'
  : [T] extends [number]
    ? 'number'
    : [T] extends [string]
      ? string extends T
        ? 'string'
        : 'enum'
      : [T] extends [readonly unknown[]]
        ? 'array'
        : 'object'

type Encode<T> = null extends T ? `${Kind<Exclude<T, null | undefined>>} | null` : Kind<Exclude<T, null | undefined>>
type IsOptional<T, K extends keyof T> = Partial<Pick<T, K>> extends Pick<T, K> ? true : false

/** e.g. Spec<Weight> = { date: 'string'; weightKg: 'number'; note: 'string | null' }; optional properties end in '?'. */
type Spec<T> = { readonly [K in keyof T]-?: IsOptional<T, K> extends true ? `${Encode<T[K]>}?` : Encode<T[K]> }

type Key<T> = Extract<keyof T, string>

interface Contract {
  /** Schema name in docs/openapi.json. */
  schema: string
  spec: Record<string, string>
  /** Schema referenced by each object/array/enum property. */
  refs: Record<string, string>
  /** Values of each enum property (compared with the API enum). */
  enums: Record<string, readonly string[]>
}

function contract<T>(
  schema: string,
  spec: Spec<T>,
  extra: { refs?: Partial<Record<Key<T>, string>>; enums?: Partial<Record<Key<T>, readonly string[]>> } = {},
): Contract {
  return {
    schema,
    spec: spec as Record<string, string>,
    refs: (extra.refs ?? {}) as Record<string, string>,
    enums: (extra.enums ?? {}) as Record<string, readonly string[]>,
  }
}

// Enum values, checked exhaustive against the TS unions at compile time.
const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const satisfies readonly MealType[]
const weightSources = ['entry', 'provided'] as const satisfies readonly WeightSource[]
const apiErrorCodes = [
  'reauth_required',
  'email_not_verified',
  'not_invited',
  'profile_required',
  'not_found',
  'profile_not_found',
  'weight_required',
] as const satisfies readonly ApiErrorCode[]

expectTypeOf<Exclude<MealType, (typeof mealTypes)[number]>>().toBeNever()
expectTypeOf<Exclude<WeightSource, (typeof weightSources)[number]>>().toBeNever()
expectTypeOf<Exclude<ApiErrorCode, (typeof apiErrorCodes)[number]>>().toBeNever()

// ---------- What the web expects ----------

const responses: Contract[] = [
  contract<Profile>('ProfileResponse', {
    displayName: 'string',
    heightCm: 'number | null',
    targetWeightKg: 'number | null',
    dailyKcalTarget: 'number | null',
    consentAt: 'string',
    privacyVersion: 'string',
    currentPrivacyVersion: 'string',
    createdAt: 'string',
    updatedAt: 'string',
  }),
  contract<Weight>('WeightResponse', { date: 'string', weightKg: 'number', note: 'string | null' }),
  contract<Meal>(
    'MealResponse',
    {
      id: 'string',
      date: 'string',
      mealType: 'enum',
      description: 'string',
      kcal: 'number',
      proteinG: 'number | null',
      carbsG: 'number | null',
      fatG: 'number | null',
      createdAt: 'string',
    },
    { refs: { mealType: 'MealType' }, enums: { mealType: mealTypes } },
  ),
  contract<Steps>('StepsResponse', { date: 'string', steps: 'number' }),
  contract<Machine>('CardioMachine', { id: 'string', name: 'string', fields: 'array' }, { refs: { fields: 'CardioField' } }),
  // `key` is a plain string in the API; the web narrows it to the keys documented in docs/API.md.
  contract<MachineField>('CardioField', {
    key: 'enum',
    label: 'string',
    unit: 'string',
    min: 'number',
    max: 'number',
    step: 'number',
    required: 'boolean',
  }),
  contract<CardioEstimate>(
    'CardioEstimateResponse',
    { kcalGross: 'number', kcalNet: 'number', weightKgUsed: 'number', weightSource: 'enum', formula: 'enum', formulaVersion: 'string' },
    { refs: { weightSource: 'WeightSource' }, enums: { weightSource: weightSources } },
  ),
  contract<Cardio>('CardioResponse', {
    id: 'string',
    date: 'string',
    machine: 'string',
    machineName: 'string',
    durationMin: 'number',
    avgSpeedKmh: 'number | null',
    inclinePercent: 'number | null',
    resistanceLevel: 'number | null',
    weightKgUsed: 'number',
    kcalGross: 'number',
    kcalNet: 'number',
    formulaVersion: 'string',
    note: 'string | null',
    createdAt: 'string',
  }),
  contract<DayTotals>('DayTotals', {
    kcalIn: 'number',
    proteinG: 'number',
    carbsG: 'number',
    fatG: 'number',
    kcalCardioGross: 'number',
    kcalCardioNet: 'number',
  }),
  contract<DaySummary>(
    'DayResponse',
    {
      date: 'string',
      weight: 'object | null',
      meals: 'array',
      steps: 'number | null',
      cardio: 'array',
      totals: 'object',
      dailyKcalTarget: 'number | null',
    },
    { refs: { weight: 'WeightResponse', meals: 'MealResponse', cardio: 'CardioResponse', totals: 'DayTotals' } },
  ),
  contract<StatsDay>('StatsDay', {
    date: 'string',
    weightKg: 'number | null',
    weightTrendKg: 'number | null',
    kcalIn: 'number | null',
    kcalCardioNet: 'number',
    steps: 'number | null',
  }),
  contract<Stats>('StatsResponse', { from: 'string', to: 'string', days: 'array' }, { refs: { days: 'StatsDay' } }),
  contract<ExportData>(
    'ExportResponse',
    { exportedAt: 'string', profile: 'object | null', weights: 'array', meals: 'array', steps: 'array', cardio: 'array' },
    {
      refs: {
        profile: 'ProfileResponse',
        weights: 'WeightResponse',
        meals: 'MealResponse',
        steps: 'StepsResponse',
        cardio: 'CardioResponse',
      },
    },
  ),
]

const requests: Contract[] = [
  contract<ProfileInput>('ProfileRequest', {
    displayName: 'string',
    heightCm: 'number | null?',
    targetWeightKg: 'number | null?',
    dailyKcalTarget: 'number | null?',
    acceptPrivacy: 'boolean?',
  }),
  contract<WeightInput>('WeightRequest', { weightKg: 'number', note: 'string | null?' }),
  contract<MealInput>(
    'MealRequest',
    {
      date: 'string',
      mealType: 'enum',
      description: 'string',
      kcal: 'number',
      proteinG: 'number | null?',
      carbsG: 'number | null?',
      fatG: 'number | null?',
    },
    { refs: { mealType: 'MealType' }, enums: { mealType: mealTypes } },
  ),
  contract<StepsInput>('StepsRequest', { steps: 'number' }),
  contract<CardioInput>('CardioRequest', {
    date: 'string',
    machine: 'string',
    durationMin: 'number | null?',
    avgSpeedKmh: 'number | null?',
    inclinePercent: 'number | null?',
    resistanceLevel: 'number | null?',
    weightKg: 'number | null?',
    note: 'string | null?',
  }),
]

/** Every operation of the API with the schemas the web sends and expects (`X[]` = array of X). */
const operations: Array<{ method: string; path: string; status: string; request?: string; response?: string }> = [
  { method: 'get', path: '/api/me', status: '200', response: 'ProfileResponse' },
  { method: 'put', path: '/api/me', status: '200', request: 'ProfileRequest', response: 'ProfileResponse' },
  { method: 'put', path: '/api/me', status: '201', request: 'ProfileRequest', response: 'ProfileResponse' },
  { method: 'delete', path: '/api/me', status: '204' },
  { method: 'get', path: '/api/me/export', status: '200', response: 'ExportResponse' },
  { method: 'get', path: '/api/weights', status: '200', response: 'WeightResponse[]' },
  { method: 'put', path: '/api/weights/{date}', status: '200', request: 'WeightRequest', response: 'WeightResponse' },
  { method: 'delete', path: '/api/weights/{date}', status: '204' },
  { method: 'get', path: '/api/meals', status: '200', response: 'MealResponse[]' },
  { method: 'post', path: '/api/meals', status: '201', request: 'MealRequest', response: 'MealResponse' },
  { method: 'put', path: '/api/meals/{id}', status: '200', request: 'MealRequest', response: 'MealResponse' },
  { method: 'delete', path: '/api/meals/{id}', status: '204' },
  { method: 'get', path: '/api/steps', status: '200', response: 'StepsResponse[]' },
  { method: 'put', path: '/api/steps/{date}', status: '200', request: 'StepsRequest', response: 'StepsResponse' },
  { method: 'delete', path: '/api/steps/{date}', status: '204' },
  { method: 'get', path: '/api/cardio/machines', status: '200', response: 'CardioMachine[]' },
  { method: 'post', path: '/api/cardio/estimate', status: '200', request: 'CardioRequest', response: 'CardioEstimateResponse' },
  { method: 'get', path: '/api/cardio', status: '200', response: 'CardioResponse[]' },
  { method: 'post', path: '/api/cardio', status: '201', request: 'CardioRequest', response: 'CardioResponse' },
  { method: 'put', path: '/api/cardio/{id}', status: '200', request: 'CardioRequest', response: 'CardioResponse' },
  { method: 'delete', path: '/api/cardio/{id}', status: '204' },
  { method: 'get', path: '/api/days/{date}', status: '200', response: 'DayResponse' },
  { method: 'get', path: '/api/stats', status: '200', response: 'StatsResponse' },
]

/** Schemas with no web interface of their own. */
const otherSchemas = ['MealType', 'WeightSource', 'ProblemCode', 'HttpValidationProblemDetails']

// ---------- Reading docs/openapi.json ----------

interface JsonSchema {
  type?: string | string[]
  $ref?: string
  oneOf?: JsonSchema[]
  enum?: string[]
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: string[]
}

interface Operation {
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> }
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>
}

const openApi = JSON.parse(openApiText) as {
  paths: Record<string, Record<string, Operation>>
  components: { schemas: Record<string, JsonSchema> }
}
const schemas = openApi.components.schemas

const refName = (ref: string) => ref.replace('#/components/schemas/', '')

function schemaOf(name: string): JsonSchema {
  const schema = schemas[name]
  if (!schema) throw new Error(`docs/openapi.json has no schema "${name}"`)
  return schema
}

/** An OpenAPI property in the same encoding as Spec<T> (without '?'), plus the schema it references. */
function encode(property: JsonSchema): { kind: string; nullable: boolean; ref: string | null } {
  let schema = property
  let nullable = false
  if (schema.oneOf) {
    const others = schema.oneOf.filter((s) => s.type !== 'null')
    nullable = others.length < schema.oneOf.length
    schema = others[0] ?? {}
  }
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []
  nullable ||= types.includes('null')
  const type = types.find((t) => t !== 'null')

  if (schema.$ref) {
    const ref = refName(schema.$ref)
    return { kind: schemaOf(ref).enum ? 'enum' : 'object', nullable, ref }
  }
  if (type === 'array') return { kind: 'array', nullable, ref: schema.items?.$ref ? refName(schema.items.$ref) : null }
  return { kind: type === 'integer' ? 'number' : (type ?? 'unknown'), nullable, ref: null }
}

function parseSpec(value: string): { kind: string; nullable: boolean; optional: boolean } {
  const optional = value.endsWith('?')
  const [kind = '', nullable] = value.replace(/\?$/, '').split(' | ')
  return { kind, nullable: nullable === 'null', optional }
}

function checkContract(c: Contract, direction: 'response' | 'request'): string[] {
  const schema = schemaOf(c.schema)
  const properties = schema.properties ?? {}
  const problems: string[] = []
  const at = (key: string) => `${c.schema}.${key}`

  const apiKeys = Object.keys(properties).sort()
  const webKeys = Object.keys(c.spec).sort()
  if (apiKeys.join() !== webKeys.join()) problems.push(`${c.schema}: API properties [${apiKeys}] ≠ web [${webKeys}]`)

  for (const key of apiKeys.filter((k) => k in c.spec)) {
    const api = encode(properties[key]!)
    const web = parseSpec(c.spec[key]!)

    // A web 'enum' may narrow an API string (values documented in docs/API.md, e.g. `formula`).
    const kindMatches = web.kind === api.kind || (web.kind === 'enum' && api.kind === 'string')
    if (!kindMatches) problems.push(`${at(key)}: API ${api.kind}, web ${web.kind}`)

    if (direction === 'response') {
      if (web.nullable !== api.nullable) problems.push(`${at(key)}: API nullable=${api.nullable}, web nullable=${web.nullable}`)
      if (web.optional) problems.push(`${at(key)}: optional in the web type, but the API always sends it`)
      if (!schema.required?.includes(key)) problems.push(`${at(key)}: not required in the API response`)
    } else if ((web.nullable || web.optional) && !api.nullable) {
      problems.push(`${at(key)}: the web may send null/omit it, but the API does not accept null`)
    }

    if (api.ref !== null && c.refs[key] !== api.ref) problems.push(`${at(key)}: API references ${api.ref}, web expects ${c.refs[key]}`)
    if (api.ref === null && c.refs[key] !== undefined) problems.push(`${at(key)}: web expects ${c.refs[key]}, API has no reference`)

    if (api.kind === 'enum') {
      const apiValues = schemaOf(api.ref!).enum ?? []
      const webValues = c.enums[key] ?? []
      if ([...apiValues].sort().join() !== [...webValues].sort().join())
        problems.push(`${at(key)}: API values [${apiValues}] ≠ web [${webValues}]`)
    }
  }
  return problems
}

function bodySchema(content: Record<string, { schema?: JsonSchema }> | undefined): string | undefined {
  const schema = content?.['application/json']?.schema
  if (!schema) return undefined
  if (schema.$ref) return refName(schema.$ref)
  if (schema.type === 'array' && schema.items?.$ref) return `${refName(schema.items.$ref)}[]`
  return JSON.stringify(schema)
}

// ---------- Tests ----------

describe('web/src/api/types.ts ↔ docs/openapi.json', () => {
  it.each(responses.map((c) => [c.schema, c] as const))('response %s matches', (_name, c) => {
    expect(checkContract(c, 'response')).toEqual([])
  })

  it.each(requests.map((c) => [c.schema, c] as const))('request %s matches', (_name, c) => {
    expect(checkContract(c, 'request')).toEqual([])
  })

  it('knows every schema of the API (a new DTO needs a web type here)', () => {
    const known = [...responses, ...requests].map((c) => c.schema).concat(otherSchemas)
    expect(Object.keys(schemas).filter((name) => !known.includes(name))).toEqual([])
  })

  it('every route, status and body schema the web relies on exists, and no API route is unaccounted for', () => {
    const actual = Object.entries(openApi.paths).flatMap(([path, methods]) =>
      Object.entries(methods).flatMap(([method, operation]) =>
        Object.entries(operation.responses ?? {})
          .filter(([status]) => status.startsWith('2'))
          .map(([status, response]) => ({
            method,
            path,
            status,
            request: bodySchema(operation.requestBody?.content),
            response: bodySchema(response.content),
          })),
      ),
    )
    const normalize = (list: typeof operations) =>
      list.map((o) => ({ method: o.method, path: o.path, status: o.status, request: o.request, response: o.response }))
    expect(normalize(actual)).toEqual(expect.arrayContaining(normalize(operations)))
    expect(normalize(operations)).toEqual(expect.arrayContaining(normalize(actual)))
  })

  it('ApiErrorCode lists exactly the problem `code` values of the API', () => {
    expect([...(schemaOf('ProblemCode').enum ?? [])].sort()).toEqual([...apiErrorCodes].sort())
  })

  it('MEAL_TYPES lists every meal type of the API, in display order', () => {
    expect(MEAL_TYPES).toEqual(mealTypes)
    expect([...(schemaOf('MealType').enum ?? [])].sort()).toEqual([...mealTypes].sort())
  })
})
