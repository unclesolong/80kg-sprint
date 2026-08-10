import { describe, expect, it, vi } from 'vitest'
import { mealTotals } from './calculations'
import { defaultFoodTemplates, emptyLog, emptyMealDetails, migrateLog } from './defaults'
import { createFoodTemplateChange } from './foodTemplates'
import {
  addFoodTemplate, addMealLine, addMealLines, commitDraftEntries, commitDraftEntriesWithMetadata, commonIngredients, copyDayIntoDetails, copyMealIntoDetails, findFoodTemplate, ingredientMealLine,
  manualMealLine, mealKeys, mergeDraftFoodEntry, moveMealLine, nutritionPatch, recentFoodItems, removeMealLine, restoreMealLine,
  updateMealLineAmount, type DraftFoodEntry
} from './mealOperations'

const chicken = () => commonIngredients().find((item) => item.id === 'chicken')!

describe('飲食紀錄核心操作', () => {
  it('空白日期的四個餐次都能新增食物', () => {
    for (const meal of ['breakfast', 'lunch', 'dinner', 'evening'] as const) {
      const next = addMealLine(emptyMealDetails(), meal, ingredientMealLine(chicken(), 100))
      expect(next[meal].some((line) => line.amount === 100 && line.label.includes('雞胸'))).toBe(true)
    }
  })

  it('新增雞胸肉 200g 到午餐後，午餐與全日營養正確', () => {
    const next = addMealLine(emptyMealDetails(), 'lunch', ingredientMealLine(chicken(), 200))
    const lunch = mealTotals({ ...emptyMealDetails(), lunch: next.lunch })
    expect(lunch).toMatchObject({ kcal: 240, protein: 45 })
    expect(mealTotals(next)).toMatchObject({ kcal: 240, protein: 45 })
  })

  it('將食物從午餐移到晚餐，全日總量不變', () => {
    const added = addMealLine(emptyMealDetails(), 'lunch', ingredientMealLine(chicken(), 200))
    const line = added.lunch.find((item) => item.amount > 0)!
    const before = mealTotals(added)
    const moved = moveMealLine(added, 'lunch', 'dinner', line.key)
    expect(mealTotals(moved)).toEqual(before)
    expect(moved.dinner.some((item) => item.key === line.key)).toBe(true)
  })

  it('修改份量後所有總量同步更新', () => {
    const added = addMealLine(emptyMealDetails(), 'lunch', ingredientMealLine(chicken(), 200))
    const line = added.lunch.find((item) => item.amount > 0)!
    const changed = updateMealLineAmount(added, 'lunch', line.key, 100)
    expect(nutritionPatch(changed)).toMatchObject({ intakeKcal: 120, proteinG: 22.5 })
  })

  it('刪除食物後所有總量同步更新', () => {
    const added = addMealLine(emptyMealDetails(), 'lunch', ingredientMealLine(chicken(), 200))
    const line = added.lunch.find((item) => item.amount > 0)!
    const removed = removeMealLine(added, 'lunch', line.key)
    expect(mealTotals(removed.details)).toMatchObject({ kcal: 0, protein: 0 })
  })

  it('快捷模板可選擇與預設不同的餐次', () => {
    const template = defaultFoodTemplates().find((item) => item.id === 'chicken_rice')!
    const result = addFoodTemplate(emptyMealDetails(), template, 'dinner')
    expect(result.details.dinner.some((line) => line.templateId === template.id)).toBe(true)
    expect(result.details.lunch.some((line) => line.templateId === template.id)).toBe(false)
  })

  it('快捷模板不會讓 totals 與 mealDetails 不一致', () => {
    const template = defaultFoodTemplates().find((item) => item.id === 'fage_250')!
    const existing = addMealLine(emptyMealDetails(), 'breakfast', ingredientMealLine(chicken(), 100))
    const log = { ...emptyLog('2026-08-01'), ...nutritionPatch(existing), mealDetails: existing }
    const change = createFoodTemplateChange(log, template, '2026-08-01T12:00:00.000Z', 'breakfast')
    const totals = mealTotals(change.patch.mealDetails!)
    expect(change.patch).toMatchObject({ intakeKcal: totals.kcal, proteinG: totals.protein, carbsG: totals.carbs, fatG: totals.fat, fiberG: totals.fiber, sodiumMg: totals.sodium })
  })

  it('手動餐點會建立可追蹤的 MealLine', () => {
    const line = manualMealLine({ name: '公司午餐', kcal: 550, proteinG: 35, portionLabel: '便當' })
    const details = addMealLine(emptyMealDetails(), 'lunch', line)
    expect(details.lunch.at(-1)).toMatchObject({ label: '公司午餐', amount: 1, kcalPerUnit: 550, proteinPerUnit: 35, portionLabel: '便當' })
    expect(mealTotals(details)).toMatchObject({ kcal: 550, protein: 35 })
  })

  it('舊版只有總量的紀錄遷移後不會歸零', () => {
    const legacy = { ...emptyLog('2026-07-31'), mealDetails: undefined, intakeKcal: 1680, proteinG: 132, carbsG: 150, updatedAt: 'before' }
    const migrated = migrateLog(legacy)
    expect(migrated.mealDetails?.evening.at(-1)).toMatchObject({ label: '舊版未分類飲食', kcalPerUnit: 1680, proteinPerUnit: 132 })
    expect(mealTotals(migrated.mealDetails!)).toMatchObject({ kcal: 1680, protein: 132 })
  })

  it('完整套餐重複加入時可以被偵測', () => {
    const template = defaultFoodTemplates()[0]
    const first = addFoodTemplate(emptyMealDetails(), template, 'breakfast')
    expect(findFoodTemplate(first.details, 'breakfast', template.id)?.label).toBe(template.name)
  })

  it('復原新增後所有營養數字恢復', () => {
    const base = addMealLine(emptyMealDetails(), 'lunch', ingredientMealLine(chicken(), 200))
    const template = defaultFoodTemplates()[1]
    const added = addFoodTemplate(base, template, 'evening')
    const removed = removeMealLine(added.details, 'evening', added.key)
    expect(mealTotals(removed.details)).toEqual(mealTotals(base))
    expect(mealTotals(restoreMealLine(removed.details, removed.removed!))).toEqual(mealTotals(added.details))
  })

  it('內建完整餐點與常用食材使用一致的營養估算', () => {
    const catalog = commonIngredients()
    const template = (id: string) => defaultFoodTemplates().find((item) => item.id === id)!
    const estimate = (items: Array<[string, number]>) => {
      let details = emptyMealDetails()
      for (const [id, amount] of items) details = addMealLine(details, 'lunch', ingredientMealLine(catalog.find((item) => item.id === id)!, amount))
      return mealTotals(details)
    }
    const cases = [
      ['chicken_rice', [['chicken', 200], ['vegetables', 300], ['rice', 100], ['cooking-oil', 5]]],
      ['chicken_pasta', [['chicken', 200], ['vegetables', 300], ['pasta', 60], ['cooking-oil', 5]]],
      ['soy_chia', [['soy', 250], ['chia', 15], ['barley', 5]]]
    ] as const
    for (const [id, items] of cases) {
      const totals = estimate(items.map(([food, amount]) => [food, amount]))
      const meal = template(id)
      expect(Math.abs(totals.kcal - meal.kcal)).toBeLessThanOrEqual(1)
      expect(Math.abs(totals.protein - meal.proteinG)).toBeLessThanOrEqual(1)
      expect(Math.abs(totals.carbs - meal.carbsG)).toBeLessThanOrEqual(1)
      expect(Math.abs(totals.fat - meal.fatG)).toBeLessThanOrEqual(1)
      expect(Math.abs(totals.fiber - meal.fiberG)).toBeLessThanOrEqual(1)
      expect(Math.abs(totals.sodium - meal.sodiumMg)).toBeLessThanOrEqual(2)
    }
  })

  it('批次加入 5 項只套用一次，且既有列與 key 完全保留', async () => {
    const base = addMealLine(emptyMealDetails(), 'lunch', { key: 'existing-key', label: '既有食物', amount: 1, unit: '份', kcalPerUnit: 100, proteinPerUnit: 10 })
    const before = structuredClone(base)
    const entries: DraftFoodEntry[] = Array.from({ length: 5 }, (_, index) => ({
      draftId: `draft-${index}`, meal: 'lunch', source: 'manual',
      line: { key: `new-${index}`, label: `新食物 ${index}`, amount: 1, unit: '份', kcalPerUnit: 50, proteinPerUnit: 5 }
    }))
    const onApply = vi.fn()
    const next = await commitDraftEntries(base, entries, onApply)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(base).toEqual(before)
    expect(next.lunch.slice(0, base.lunch.length)).toEqual(base.lunch)
    expect(next.lunch.find((line) => line.label === '既有食物')?.key).toBe('existing-key')
  })

  it('先儲存 legacy 餐點，metadata 失敗也不撤銷紀錄', async () => {
    const entry: DraftFoodEntry = { draftId: 'provider', meal: 'lunch', source: 'provider', line: { key: 'provider-line', label: '已確認食物', amount: 100, unit: 'g', kcalPerUnit: 1.2, proteinPerUnit: .22 } }
    const onApply = vi.fn().mockResolvedValue(undefined)
    const metadataWrite = vi.fn().mockRejectedValue(new Error('planner metadata unavailable'))
    const next = await commitDraftEntriesWithMetadata(emptyMealDetails(), [entry], onApply, [metadataWrite])
    expect(onApply).toHaveBeenCalledOnce()
    expect(metadataWrite).toHaveBeenCalledOnce()
    expect(next.lunch.some((line) => line.key === 'provider-line')).toBe(true)
  })

  it('相同常用食材同餐次重複選擇會增加份量，不建立重複列', () => {
    const ingredient = chicken()
    const first: DraftFoodEntry = { draftId: 'first', meal: 'lunch', source: 'common', line: ingredientMealLine(ingredient, 200) }
    const second: DraftFoodEntry = { draftId: 'second', meal: 'lunch', source: 'common', line: ingredientMealLine(ingredient, 100) }
    const merged = mergeDraftFoodEntry(mergeDraftFoodEntry([], first), second)
    expect(merged).toHaveLength(1)
    expect(merged[0].line.amount).toBe(300)
    expect(merged[0].selectionCount).toBe(2)
  })

  it('沿用早餐預設追加並為來源列建立全新 key', () => {
    const current = addMealLines(emptyMealDetails(), [
      { meal: 'breakfast', line: { key: 'today-1', label: '今天一', amount: 1, unit: '份', kcalPerUnit: 100, proteinPerUnit: 10 } },
      { meal: 'breakfast', line: { key: 'today-2', label: '今天二', amount: 1, unit: '份', kcalPerUnit: 80, proteinPerUnit: 8 } }
    ])
    const source = [
      { key: 'yesterday-1', label: '昨天一', amount: 1, unit: '份' as const, kcalPerUnit: 200, proteinPerUnit: 20 },
      { key: 'yesterday-2', label: '昨天二', amount: 1, unit: '份' as const, kcalPerUnit: 180, proteinPerUnit: 18 }
    ]
    const beforeCurrent = structuredClone(current)
    const beforeSource = structuredClone(source)
    let index = 0
    const next = copyMealIntoDetails(current, 'breakfast', source, 'append', () => `new-${++index}`)
    expect(next.breakfast.filter((line) => line.amount > 0).map((line) => line.key)).toEqual(['today-1', 'today-2', 'new-1', 'new-2'])
    expect(current).toEqual(beforeCurrent)
    expect(source).toEqual(beforeSource)
  })

  it('只有明確 replace 才取代目前早餐', () => {
    const current = addMealLine(emptyMealDetails(), 'breakfast', { key: 'today', label: '今天', amount: 1, unit: '份', kcalPerUnit: 100, proteinPerUnit: 10 })
    const source = [{ key: 'source', label: '昨天', amount: 1, unit: '份' as const, kcalPerUnit: 200, proteinPerUnit: 20 }]
    const appended = copyMealIntoDetails(current, 'breakfast', source, 'append', () => 'append-copy')
    const replaced = copyMealIntoDetails(current, 'breakfast', source, 'replace', () => 'replace-copy')
    expect(appended.breakfast.some((line) => line.key === 'today')).toBe(true)
    expect(replaced.breakfast.filter((line) => line.amount > 0).map((line) => line.key)).toEqual(['replace-copy'])
  })

  it('昨天整天追加不清除任何目前餐點，且來源完全不變', () => {
    const current = addMealLines(emptyMealDetails(), mealKeys.map((meal) => ({ meal, line: { key: `today-${meal}`, label: `今天${meal}`, amount: 1, unit: '份' as const, kcalPerUnit: 100, proteinPerUnit: 10 } })))
    const source = addMealLines(emptyMealDetails(), mealKeys.map((meal) => ({ meal, line: { key: `source-${meal}`, label: `昨天${meal}`, amount: 1, unit: '份' as const, kcalPerUnit: 100, proteinPerUnit: 10 } })))
    const before = structuredClone(source)
    const next = copyDayIntoDetails(current, source, 'append', (line) => `new-${line.key}`)
    for (const meal of mealKeys) {
      expect(next[meal].some((line) => line.key === `today-${meal}`)).toBe(true)
      expect(next[meal].some((line) => line.key === `new-source-${meal}`)).toBe(true)
    }
    expect(source).toEqual(before)
  })

  it('整天取代只處理預覽中的四餐，不會靜默覆寫泡麵紀錄', () => {
    const current = emptyMealDetails()
    current.ramen = { ...current.ramen, enabled: true, packageKcal: 480, chickenG: 120 }
    const source = emptyMealDetails()
    source.ramen = { ...source.ramen, enabled: false, packageKcal: 900, chickenG: 0 }
    const next = copyDayIntoDetails(current, source, 'replace')
    expect(next.ramen).toEqual(current.ramen)
  })

  it('舊版午晚餐 placeholder key 衝突時只移動一列並保留 MealLine key', () => {
    const current = emptyMealDetails()
    const lunchChicken = current.lunch.find((line) => line.key === 'chicken')!
    lunchChicken.amount = 200
    const before = mealTotals(current)
    const next = moveMealLine(current, 'lunch', 'dinner', 'chicken')
    const moved = next.dinner.filter((line) => line.amount > 0)
    expect(moved).toHaveLength(1)
    expect(moved[0].key).toBe('chicken')
    expect(next.dinner.filter((line) => line.key === 'chicken')).toHaveLength(1)
    expect(mealTotals(next)).toEqual(before)
  })

  it('目的餐已有同 key 食物時合併份量，不修改任一歷史 key', () => {
    const current = emptyMealDetails()
    current.lunch.find((line) => line.key === 'chicken')!.amount = 100
    current.dinner.find((line) => line.key === 'chicken')!.amount = 200
    const next = moveMealLine(current, 'lunch', 'dinner', 'chicken')
    expect(next.lunch.some((line) => line.key === 'chicken')).toBe(false)
    expect(next.dinner.filter((line) => line.key === 'chicken')).toHaveLength(1)
    expect(next.dinner.find((line) => line.key === 'chicken')?.amount).toBe(300)
    expect(mealTotals(next)).toEqual(mealTotals(current))
  })

  it('同一刪除操作重複復原保持冪等且不修改既有 key', () => {
    const current = addMealLine(emptyMealDetails(), 'breakfast', { key: 'undo-line', label: '測試', amount: 1, unit: '份', kcalPerUnit: 100, proteinPerUnit: 10 })
    const removed = removeMealLine(current, 'breakfast', 'undo-line').removed!
    const once = restoreMealLine(removeMealLine(current, 'breakfast', 'undo-line').details, removed)
    const twice = restoreMealLine(once, removed)
    expect(twice.breakfast.filter((line) => line.key === 'undo-line')).toHaveLength(1)
    expect(mealTotals(twice)).toEqual(mealTotals(once))
  })

  it('稍後再次新增只追加，不取代原有餐點', () => {
    const first = addMealLines(emptyMealDetails(), [{ meal: 'dinner', line: { key: 'first', label: '晚餐一', amount: 1, unit: '份', kcalPerUnit: 300, proteinPerUnit: 30 } }])
    const second = addMealLines(first, [{ meal: 'dinner', line: { key: 'second', label: '晚餐二', amount: 1, unit: '份', kcalPerUnit: 200, proteinPerUnit: 20 } }])
    expect(second.dinner.slice(-2).map((line) => line.key)).toEqual(['first', 'second'])
    expect(second.dinner.slice(0, first.dinner.length)).toEqual(first.dinner)
  })

  it('最近使用只取 14 天內、同名去重並限制 12 項', () => {
    const recentLog = { ...emptyLog('2026-08-07'), mealDetails: addMealLine(emptyMealDetails(), 'lunch', { key: 'new', label: '雞胸肉', amount: 200, unit: 'g', kcalPerUnit: 1, proteinPerUnit: .2 }) }
    const duplicate = { ...emptyLog('2026-08-06'), mealDetails: addMealLine(emptyMealDetails(), 'dinner', { key: 'old', label: '雞胸肉', amount: 100, unit: 'g', kcalPerUnit: 1, proteinPerUnit: .2 }) }
    const expired = { ...emptyLog('2026-07-20'), mealDetails: addMealLine(emptyMealDetails(), 'lunch', { key: 'expired', label: '過期食物', amount: 1, unit: '份', kcalPerUnit: 1, proteinPerUnit: 0 }) }
    const items = recentFoodItems([expired, duplicate, recentLog], '2026-08-07')
    expect(items.filter((item) => item.line.label === '雞胸肉')).toHaveLength(1)
    expect(items.some((item) => item.line.label === '過期食物')).toBe(false)
    expect(items.length).toBeLessThanOrEqual(12)
  })
})
