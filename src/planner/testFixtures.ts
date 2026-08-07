import type { UserProfile } from './types'

export const plannerProfile = (patch: Partial<UserProfile> = {}): UserProfile => ({
  id: 'current', age: 41, calculationSex: 'male', heightCm: 180, currentWeightKg: 80.2, goalWeightKg: 75,
  workActivity: 'sedentary', exerciseSessionsPerWeek: 3, exerciseMinutesPerWeek: 120, wearable: 'apple_watch',
  foodRestrictions: [], goalPace: 'standard', locale: 'zh-TW', timezone: 'Europe/Berlin',
  createdAt: '2026-08-07T00:00:00.000Z', updatedAt: '2026-08-07T00:00:00.000Z', ...patch
})
