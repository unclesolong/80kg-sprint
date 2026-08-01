import { describe, expect, it, vi } from 'vitest'
import { defaultFoodTemplates, emptyLog } from './defaults'
import { createFoodTemplateChange } from './foodTemplates'

describe('食物快捷模板', () => {
  it('同時增加熱量與所有營養素', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'template-line' })
    const log = { ...emptyLog('2026-08-01'), intakeKcal: 100, proteinG: 10, carbsG: 12, fatG: 3, fiberG: 2, sodiumMg: 50 }
    const template = defaultFoodTemplates().find((item) => item.id === 'fage_250')!
    const { patch } = createFoodTemplateChange(log, template, '2026-08-01T12:00:00.000Z')
    expect(patch).toMatchObject({ intakeKcal: 283, proteinG: 35, carbsG: 22, fatG: 4, fiberG: 2, sodiumMg: 150, foodUpdatedAt: '2026-08-01T12:00:00.000Z' })
    expect(patch.mealDetails?.evening.at(-1)?.label).toBe('FAGE 250g')
    vi.unstubAllGlobals()
  })

  it('復原資料完整回到加入前', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'template-line' })
    const log = { ...emptyLog('2026-08-01'), intakeKcal: 620, proteinG: 50, foodUpdatedAt: 'before' }
    const { undoPatch } = createFoodTemplateChange(log, defaultFoodTemplates()[0])
    expect(undoPatch.intakeKcal).toBe(620)
    expect(undoPatch.proteinG).toBe(50)
    expect(undoPatch.foodUpdatedAt).toBe('before')
    expect(undoPatch.mealDetails?.evening.at(-1)?.label).toBe('舊版未分類飲食')
    vi.unstubAllGlobals()
  })
})
