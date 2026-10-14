/**
 * Types mirroring docs/API.md (the API contract). Keep both in sync: contract.test.ts compares them with
 * docs/openapi.json, the OpenAPI document generated from the API.
 * JSON is camelCase; diary dates are "YYYY-MM-DD"; instants are ISO 8601 UTC strings.
 */

/** Local calendar day, "YYYY-MM-DD". */
export type IsoDate = string
/** ISO 8601 UTC instant, e.g. "2026-10-14T08:30:00Z". */
export type Instant = string
/** UUID (v7) string. */
export type Id = string

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

// ---------- Profile ----------

export interface Profile {
  displayName: string
  heightCm: number | null
  targetWeightKg: number | null
  dailyKcalTarget: number | null
  consentAt: Instant
  /** Version of the privacy notice the user accepted (at `consentAt`). */
  privacyVersion: string
  /** Version currently in force on the server. When it differs, the user must accept the notice again. */
  currentPrivacyVersion: string
  createdAt: Instant
  updatedAt: Instant
}

/**
 * True when the user accepted an older privacy notice than the one in force. Tolerates an API that does
 * not send `currentPrivacyVersion` yet (deploy order), so nobody gets stuck on the re-consent screen.
 */
export function needsPrivacyReconsent(profile: Profile): boolean {
  const current: unknown = profile.currentPrivacyVersion
  return typeof current === 'string' && current !== '' && profile.privacyVersion !== current
}

/** Body of `PUT /api/me`. `acceptPrivacy` must be true when creating the profile. */
export interface ProfileInput {
  displayName: string
  heightCm?: number | null
  targetWeightKg?: number | null
  dailyKcalTarget?: number | null
  acceptPrivacy?: boolean
}

// ---------- Weight ----------

export interface Weight {
  date: IsoDate
  weightKg: number
  note: string | null
}

/** Body of `PUT /api/weights/{date}`. */
export interface WeightInput {
  weightKg: number
  note?: string | null
}

// ---------- Meals ----------

export interface Meal {
  id: Id
  date: IsoDate
  mealType: MealType
  description: string
  kcal: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  createdAt: Instant
}

/** Body of `POST /api/meals` and `PUT /api/meals/{id}`. */
export interface MealInput {
  date: IsoDate
  mealType: MealType
  description: string
  kcal: number
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
}

// ---------- Steps ----------

export interface Steps {
  date: IsoDate
  steps: number
}

/** Body of `PUT /api/steps/{date}`. */
export interface StepsInput {
  steps: number
}

// ---------- Cardio ----------

export type CardioFieldKey = 'durationMin' | 'avgSpeedKmh' | 'inclinePercent' | 'resistanceLevel'
export const CARDIO_FIELD_KEYS: readonly CardioFieldKey[] = [
  'durationMin',
  'avgSpeedKmh',
  'inclinePercent',
  'resistanceLevel',
]

export interface MachineField {
  key: CardioFieldKey
  label: string
  unit: string
  min: number
  max: number
  step: number
  required: boolean
}

export interface Machine {
  id: string
  name: string
  fields: MachineField[]
}

/** Body of `POST /api/cardio/estimate`, `POST /api/cardio` and `PUT /api/cardio/{id}`. */
export interface CardioInput {
  date: IsoDate
  machine: string
  durationMin?: number | null
  avgSpeedKmh?: number | null
  inclinePercent?: number | null
  resistanceLevel?: number | null
  weightKg?: number | null
  note?: string | null
}

export type WeightSource = 'entry' | 'provided'
export type CardioFormula = 'acsm-walking' | 'acsm-running'

export interface CardioEstimate {
  kcalGross: number
  kcalNet: number
  weightKgUsed: number
  weightSource: WeightSource
  formula: CardioFormula
  formulaVersion: string
}

export interface Cardio {
  id: Id
  date: IsoDate
  machine: string
  machineName: string
  durationMin: number
  avgSpeedKmh: number | null
  inclinePercent: number | null
  resistanceLevel: number | null
  weightKgUsed: number
  kcalGross: number
  kcalNet: number
  formulaVersion: string
  note: string | null
  createdAt: Instant
}

// ---------- Summaries ----------

export interface DayTotals {
  kcalIn: number
  proteinG: number
  carbsG: number
  fatG: number
  kcalCardioGross: number
  kcalCardioNet: number
}

/** `GET /api/days/{date}` */
export interface DaySummary {
  date: IsoDate
  weight: Weight | null
  meals: Meal[]
  steps: number | null
  cardio: Cardio[]
  totals: DayTotals
  dailyKcalTarget: number | null
}

export interface StatsDay {
  date: IsoDate
  weightKg: number | null
  weightTrendKg: number | null
  /** null when no meals were logged that day (not logged ≠ 0). */
  kcalIn: number | null
  kcalCardioNet: number
  steps: number | null
}

/** `GET /api/stats?from&to` (range ≤ 366 days). */
export interface Stats {
  from: IsoDate
  to: IsoDate
  days: StatsDay[]
}

/** `GET /api/me/export` */
export interface ExportData {
  exportedAt: Instant
  profile: Profile | null
  weights: Weight[]
  meals: Meal[]
  steps: Steps[]
  cardio: Cardio[]
}

// ---------- Errors ----------

/** Domain error codes (`code` extension of application/problem+json). */
export type ApiErrorCode =
  | 'reauth_required'
  | 'email_not_verified'
  | 'not_invited'
  | 'profile_required'
  | 'not_found'
  | 'profile_not_found'
  | 'weight_required'

/** RFC 9457 problem details as returned by the API. */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  code?: string
  errors?: Record<string, string[]>
}
