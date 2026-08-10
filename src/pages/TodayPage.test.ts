import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLog } from '../defaults'
import type { FatLossPlan, PlanVersion } from '../planner/types'
import { TodayPage } from './TodayPage'

const plan: FatLossPlan = {
  id: 'plan-1',
  name: '75KG Journey',
  status: 'active',
  startDate: '2026-08-01',
  goalWeightKg: 75,
  createdAt: '2026-08-01T00:00:00.000Z',
  source: 'manual',
  safetyDecisionSnapshot: { status: 'approved', reasonCodes: [], userMessages: [], limitations: [] }
}

const version: PlanVersion = {
  id: 'version-1',
  planId: plan.id,
  effectiveFrom: plan.startDate,
  goalDate: '2026-09-30',
  calorieTargetKcal: 1_700,
  calorieRangeMinKcal: 1_650,
  calorieRangeMaxKcal: 1_750,
  proteinMinG: 130,
  proteinMaxG: 155,
  waterTargetMl: 2_500,
  sleepTargetMinHours: 7,
  aerobicMinutesPerWeek: 120,
  strengthDaysPerWeek: 2,
  expectedWeeklyLossKg: 0.4,
  eveningReserveKcal: 160,
  reservedTemplateIds: ['soy_chia'],
  focusTasks: ['穩定記錄'],
  comment: { title: '保持節奏', summary: '維持目前設定。', bullets: [], tone: 'supportive' },
  createdAt: '2026-08-01T00:00:00.000Z',
  createdBy: 'manual'
}

describe('TodayPage V06 action-first structure', () => {
  it('renders one hero followed by action, resources, stages, quick input, more data and collapsed insights', () => {
    const log = {
      ...emptyLog('2026-08-08'),
      weightKg: 79.6,
      sleepHours: 7,
      lowerLegTightness: 0 as const,
      bowelMovement: 'yes' as const,
      intakeKcal: 1_070,
      proteinG: 140,
      waterMl: 2_500
    }
    const html = renderToStaticMarkup(createElement(TodayPage, {
      today: log.date,
      log,
      logs: [log],
      settings: defaultSettings,
      plan,
      planVersion: version,
      onOpenPlanner: vi.fn(),
      onOpenWeeklyReview: vi.fn(),
      onQuickAdd: vi.fn(),
      onOpenRecord: vi.fn(),
      onOpenFoodTemplate: vi.fn()
    }))

    expect(html.match(/v6-plan-dashboard-hero/g)).toHaveLength(1)
    const order = [
      'v6-plan-dashboard-hero',
      'v6-home-primary-action',
      'v6-compact-metrics',
      'v6-stage-rail',
      'v6-quick-add',
      'v6-more-data',
      'v6-home-insights'
    ].map((className) => html.indexOf(className))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((left, right) => left - right))
    expect(html).toContain('第 8／61 天')
    expect(html).toContain('今天還可吃')
    expect(html).toContain('680')
    expect(html).toContain('<details class="v6-home-insights standard-card">')
  })
})
