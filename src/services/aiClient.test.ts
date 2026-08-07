import { describe, expect, it, vi } from 'vitest'
import type { PlannerDraft, PlanVersion, SafetyDecision, UserProfile, WeeklyAggregate } from '../planner/types'
import type { PlanAIOutput } from './aiSchemas'
import { buildPlanAIRequest, buildWeeklyReviewAIRequest, createAIClient } from './aiClient'

const profile: UserProfile = {
  id: 'current', age: 41, calculationSex: 'male', heightCm: 180, currentWeightKg: 80.2, goalWeightKg: 75,
  workActivity: 'mixed', exerciseSessionsPerWeek: 3, exerciseMinutesPerWeek: 120, wearable: 'none',
  foodRestrictions: [], goalPace: 'standard', locale: 'zh-TW', timezone: 'Europe/Berlin',
  createdAt: '2026-08-01', updatedAt: '2026-08-07'
}
const bounds = {
  dailyCalories: { min: 1500, max: 2100, recommended: 1800 }, weeklyLossKg: { min: 0.2, max: 0.8, recommended: 0.4 },
  weeklyLossPercent: { min: 0.25, max: 1, recommended: 0.5 }, proteinG: { min: 110, max: 170, recommended: 140 },
  waterMl: { min: 1800, max: 3500, recommended: 2400 }, aerobicMinutesPerWeek: { min: 60, max: 180, recommended: 120 },
  strengthDaysPerWeek: { min: 0, max: 4, recommended: 2 }, earliestGoalDate: '2026-10-01', recommendedGoalDate: '2026-11-01', latestSuggestedGoalDate: '2027-01-01'
}
const decision: SafetyDecision = { status: 'approved', reasonCodes: [], userMessages: [], limitations: [], bounds }
const draft: PlannerDraft = {
  goalDate: '2026-11-01', calorieTargetKcal: 1800, proteinMinG: 120, proteinMaxG: 150, waterTargetMl: 2400,
  aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2, expectedWeeklyLossKg: 0.4, eveningReserveKcal: 170,
  reservedTemplateIds: [], focusTasks: ['記錄三餐'], comment: { title: '本地計畫', summary: '安全摘要', bullets: [], tone: 'supportive' }
}

const validFoodParse = {
  schemaVersion: 1,
  items: [{ rawText: '蛋2顆', normalizedName: '雞蛋', amount: 2, unit: '顆', preparation: null, weightState: 'unknown', brand: null, searchTerms: ['雞蛋'], needsConfirmation: false, confirmationQuestion: null }],
  unparsedText: []
}
const validPlanOutput: PlanAIOutput = {
  schemaVersion: 1, status: 'ok',
  selectedTargets: { calorieTargetKcal: 1800, proteinMinG: 120, proteinMaxG: 150, waterTargetMl: 2400, expectedWeeklyLossKg: 0.4, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2, eveningReserveKcal: 170 },
  focusTasks: ['記錄三餐'], comment: { title: '穩定執行', summary: '先維持安全且可持續的節奏。', bullets: [], tone: 'supportive' }, assumptions: [], warnings: []
}

const responseFetch = (value: unknown, status = 200, source = 'test') => vi.fn(async () => new Response(JSON.stringify(status >= 400 ? value : { ok: true, data: value, meta: { source, requestId: 'test' } }), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch

describe('privacy-safe AI client', () => {
  it('builds an allowlisted plan request without identity or raw-log fields', () => {
    const unsafeProfile = { ...profile, name: 'Ian', email: 'ian@example.com', rawNotes: 'private' } as UserProfile
    const request = buildPlanAIRequest(unsafeProfile, decision, draft, { recovery: { averagePain: 2 } })
    const serialized = JSON.stringify(request)
    expect(serialized).not.toContain('Ian')
    expect(serialized).not.toContain('ian@example.com')
    expect(serialized).not.toContain('private')
    expect(request.safety.painLevel).toBe(2)
    expect(Object.keys(request).sort()).toEqual(['goalDate', 'localRecommendation', 'profile', 'safety'])
    expect(Object.keys(request.profile).sort()).toEqual(['age', 'averageSteps', 'calculationSex', 'currentWeightKg', 'dietaryPattern', 'exerciseMinutesPerWeek', 'exerciseSessionsPerWeek', 'goalWeightKg', 'heightCm', 'locale', 'workActivity'])
  })

  it('maps weekly percentages and summaries to the exact Worker contract', () => {
    const version: PlanVersion = {
      id: 'v1', planId: 'p1', effectiveFrom: '2026-08-01', goalDate: '2026-11-01',
      calorieTargetKcal: 1800, calorieRangeMinKcal: 1600, calorieRangeMaxKcal: 2000, proteinMinG: 120, proteinMaxG: 150,
      waterTargetMl: 2400, sleepTargetMinHours: 7, aerobicMinutesPerWeek: 120, strengthDaysPerWeek: 2, expectedWeeklyLossKg: 0.4,
      eveningReserveKcal: 170, reservedTemplateIds: [], focusTasks: [], comment: draft.comment, createdAt: '2026-08-01', createdBy: 'manual'
    }
    const summary: WeeklyAggregate = {
      morningWeightCount: 5, intakeDayCount: 5, finalizedDayCount: 5, averageMorningWeightKg: 79.8, weightTrendKg: -0.3,
      averageIntakeKcal: 1810, averageProteinG: 121, averageWaterMl: 2300, averageActiveKcal: 330, averagePain: 2,
      highSaltMealCount: 1, bowelMovementDays: 4, cumulativeFinalizedDeficitKcal: 2100
    }
    const request = buildWeeklyReviewAIRequest(version, summary, 55, decision, '2026-08-03', '2026-08-09')
    expect(request).toMatchObject({ weekStart: '2026-08-03', weekEnd: '2026-08-09', dataCompleteness: 0.55, summary: { averageWeightKg: 79.8, weightChangeKg: -0.3, painMax: 2, completedDays: 5 } })
    expect(Object.keys(request).sort()).toEqual(['currentVersion', 'dataCompleteness', 'safety', 'summary', 'weekEnd', 'weekStart'])
  })

  it('does not call the network before explicit Planner AI consent', async () => {
    const fetchImpl = responseFetch(validFoodParse)
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl })
    const result = await client.parseFood('蛋2顆')
    expect(result).toMatchObject({ ok: false, error: { code: 'consent_required' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('uses fixed safe fetch options and sends semantic text only to food parse', async () => {
    const fetchImpl = responseFetch(validFoodParse)
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com/', fetchImpl, hasConsent: () => true })
    const result = await client.parseFood('蛋2顆')
    expect(result.ok).toBe(true)
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/food/parse')
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
    expect((init?.headers as Record<string, string>)['X-AI-Consent']).toBe('granted')
    expect(JSON.parse(String(init?.body))).toEqual({ text: '蛋2顆', locale: 'zh-TW' })
  })

  it('re-allowlists a typed plan request immediately before dispatch', async () => {
    const fetchImpl = responseFetch(validPlanOutput)
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const request = buildPlanAIRequest(profile, decision, draft) as ReturnType<typeof buildPlanAIRequest> & { name?: string; rawLogs?: unknown[] }
    request.name = 'private name'
    request.rawLogs = [{ notes: 'private raw note' }]
    ;(request.profile as typeof request.profile & { email?: string }).email = 'private@example.com'
    expect((await client.generatePlan(request)).ok).toBe(true)
    const body = String(vi.mocked(fetchImpl).mock.calls[0][1]?.body)
    expect(body).not.toContain('private name')
    expect(body).not.toContain('private raw note')
    expect(body).not.toContain('private@example.com')
  })

  it('rejects unsafe plan numbers and returns the supplied local plan untouched', async () => {
    const unsafe = { ...validPlanOutput, selectedTargets: { ...validPlanOutput.selectedTargets, calorieTargetKcal: 900 } }
    const fetchImpl = responseFetch(unsafe)
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.generatePlan(buildPlanAIRequest(profile, decision, draft), validPlanOutput)
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_response' }, fallback: validPlanOutput })
  })

  it('does not label a Worker deterministic fallback as a live AI success', async () => {
    const fetchImpl = responseFetch(validPlanOutput, 200, 'fallback')
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.generatePlan(buildPlanAIRequest(profile, decision, draft))
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' }, fallback: validPlanOutput })
  })

  it('uses a nutrition-free offline fallback for malformed provider output', async () => {
    const fetchImpl = responseFetch({ ...validFoodParse, items: [{ ...validFoodParse.items[0], kcal: 150 }] })
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.parseFood('蛋2顆')
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_response' }, fallback: { schemaVersion: 1, items: [], unparsedText: ['蛋2顆'] } })
    expect(JSON.stringify(result)).not.toContain('150')
  })

  it('never exposes a raw provider error body', async () => {
    const fetchImpl = responseFetch({ error: 'OPENAI_API_KEY leaked raw provider detail' }, 500)
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.parseFood('雞胸200g')
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('OPENAI_API_KEY')
    if (!result.ok) expect(result.error.message).toContain('保留本地資料')
  })

  it('maps abort failures to a safe timeout without exposing the thrown message', async () => {
    const secretError = Object.assign(new Error('secret transport detail'), { name: 'AbortError' })
    const fetchImpl = vi.fn(async () => { throw secretError }) as unknown as typeof fetch
    const client = createAIClient({ enabled: true, baseUrl: 'https://api.example.com', fetchImpl, hasConsent: () => true })
    const result = await client.parseFood('雞胸200g')
    expect(result).toMatchObject({ ok: false, error: { code: 'timeout' } })
    expect(JSON.stringify(result)).not.toContain('secret transport detail')
  })

  it('refuses insecure non-local API origins before fetch', async () => {
    const fetchImpl = responseFetch(validFoodParse)
    const client = createAIClient({ enabled: true, baseUrl: 'http://api.example.com', fetchImpl, hasConsent: () => true })
    expect(client.configured).toBe(false)
    expect((await client.parseFood('蛋2顆')).ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
