import type { Profile, ProfileInput } from '../../api/types'
import { isBlank, parseDecimal, parseInteger, toInputValue } from '../../lib/numbers'

export interface ProfileFormValues {
  displayName: string
  heightCm: string
  targetWeightKg: string
  dailyKcalTarget: string
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues | 'acceptPrivacy', string>>

export const PROFILE_LIMITS = {
  displayName: { max: 40 },
  heightCm: { min: 100, max: 250 },
  targetWeightKg: { min: 30, max: 300 },
  dailyKcalTarget: { min: 800, max: 6000 },
} as const

export function profileToForm(profile: Profile | null | undefined, fallbackName = ''): ProfileFormValues {
  return {
    displayName: profile?.displayName ?? fallbackName.slice(0, PROFILE_LIMITS.displayName.max),
    heightCm: toInputValue(profile?.heightCm),
    targetWeightKg: toInputValue(profile?.targetWeightKg),
    dailyKcalTarget: toInputValue(profile?.dailyKcalTarget),
  }
}

type ProfileData = Omit<ProfileInput, 'acceptPrivacy'>

export function validateProfileForm(
  values: ProfileFormValues,
): { ok: true; input: ProfileData } | { ok: false; errors: ProfileFormErrors } {
  const errors: ProfileFormErrors = {}
  const displayName = values.displayName.trim()
  if (displayName.length === 0) errors.displayName = 'Escribe cómo quieres que te llamemos.'
  else if (displayName.length > PROFILE_LIMITS.displayName.max)
    errors.displayName = `Máximo ${PROFILE_LIMITS.displayName.max} caracteres.`

  let heightCm: number | null = null
  if (!isBlank(values.heightCm)) {
    const { min, max } = PROFILE_LIMITS.heightCm
    heightCm = parseInteger(values.heightCm)
    if (heightCm === null || heightCm < min || heightCm > max) errors.heightCm = `Indica una altura entre ${min} y ${max} cm.`
  }

  let targetWeightKg: number | null = null
  if (!isBlank(values.targetWeightKg)) {
    const { min, max } = PROFILE_LIMITS.targetWeightKg
    targetWeightKg = parseDecimal(values.targetWeightKg)
    if (targetWeightKg === null || targetWeightKg < min || targetWeightKg > max)
      errors.targetWeightKg = `Indica un peso entre ${min} y ${max} kg.`
  }

  let dailyKcalTarget: number | null = null
  if (!isBlank(values.dailyKcalTarget)) {
    const { min, max } = PROFILE_LIMITS.dailyKcalTarget
    dailyKcalTarget = parseInteger(values.dailyKcalTarget)
    if (dailyKcalTarget === null || dailyKcalTarget < min || dailyKcalTarget > max)
      errors.dailyKcalTarget = `Indica un número entre ${min} y ${max} kcal.`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, input: { displayName, heightCm, targetWeightKg, dailyKcalTarget } }
}
