import { mealTotals } from './calculations'
import { defaultMealDetails, emptyMealDetails } from './defaults'
import type { CustomFood, DailyLog, FoodTemplate, MealDetails, MealLine } from './types'

export const mealKeys = ['breakfast', 'lunch', 'dinner', 'evening'] as const
export type MealKey = (typeof mealKeys)[number]
export const mealLabels: Record<MealKey, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', evening: '點心／晚間'
}

export const cloneMealDetails = (value?: MealDetails): MealDetails => {
  const details = value ?? emptyMealDetails()
  return {
    breakfast: details.breakfast.map((line) => ({ ...line })),
    lunch: details.lunch.map((line) => ({ ...line })),
    dinner: details.dinner.map((line) => ({ ...line })),
    evening: details.evening.map((line) => ({ ...line })),
    ramen: { ...details.ramen }
  }
}

export const nutritionPatch = (details: MealDetails, now = new Date().toISOString()): Partial<DailyLog> => {
  const totals = mealTotals(details)
  return {
    mealDetails: details,
    intakeKcal: totals.kcal,
    proteinG: totals.protein,
    carbsG: totals.carbs,
    fatG: totals.fat,
    fiberG: totals.fiber,
    sodiumMg: totals.sodium,
    foodUpdatedAt: now
  }
}

export const addMealLine = (details: MealDetails, meal: MealKey, line: MealLine): MealDetails => {
  const next = cloneMealDetails(details)
  next[meal] = [...next[meal], { ...line }]
  return next
}

export interface DraftFoodEntry {
  draftId: string
  meal: MealKey
  line: MealLine
  source: 'common' | 'template' | 'mine' | 'manual'
}

/** Adds a whole draft in one immutable clone without touching existing rows. */
export const addMealLines = (
  details: MealDetails,
  entries: Array<{ meal: MealKey; line: MealLine }>
): MealDetails => {
  const next = cloneMealDetails(details)
  for (const entry of entries) next[entry.meal].push({ ...entry.line })
  return next
}

/** Repeated taps on the same common ingredient increase its amount in-place. */
export const mergeDraftFoodEntry = (entries: DraftFoodEntry[], entry: DraftFoodEntry): DraftFoodEntry[] => {
  if (entry.source !== 'common') return [...entries, entry]
  const index = entries.findIndex((item) => item.source === 'common' && item.meal === entry.meal && item.line.label === entry.line.label)
  if (index < 0) return [...entries, entry]
  return entries.map((item, itemIndex) => itemIndex === index
    ? { ...item, line: { ...item.line, amount: item.line.amount + entry.line.amount } }
    : item)
}

export const commitDraftEntries = async (
  details: MealDetails,
  entries: DraftFoodEntry[],
  onApply: (next: MealDetails) => void | Promise<void>
): Promise<MealDetails> => {
  const next = addMealLines(details, entries)
  await onApply(next)
  return next
}

export const updateMealLineAmount = (details: MealDetails, meal: MealKey, key: string, amount: number): MealDetails => {
  const next = cloneMealDetails(details)
  next[meal] = next[meal].map((line) => line.key === key ? { ...line, amount: Math.max(0, amount) } : line)
  return next
}

export const moveMealLine = (details: MealDetails, from: MealKey, to: MealKey, key: string): MealDetails => {
  if (from === to) return cloneMealDetails(details)
  const next = cloneMealDetails(details)
  const line = next[from].find((item) => item.key === key)
  if (!line) return next
  next[from] = next[from].filter((item) => item.key !== key)
  next[to] = [...next[to], line]
  return next
}

export const duplicateMealLine = (details: MealDetails, meal: MealKey, key: string): MealDetails => {
  const next = cloneMealDetails(details)
  const index = next[meal].findIndex((line) => line.key === key)
  if (index < 0) return next
  const copy = { ...next[meal][index], key: `${next[meal][index].key}-copy-${crypto.randomUUID()}` }
  next[meal].splice(index + 1, 0, copy)
  return next
}

export interface RemovedMealLine { meal: MealKey; line: MealLine; index: number }

export const removeMealLine = (details: MealDetails, meal: MealKey, key: string): { details: MealDetails; removed?: RemovedMealLine } => {
  const next = cloneMealDetails(details)
  const index = next[meal].findIndex((line) => line.key === key)
  if (index < 0) return { details: next }
  const [line] = next[meal].splice(index, 1)
  return { details: next, removed: { meal, line, index } }
}

export const restoreMealLine = (details: MealDetails, removed: RemovedMealLine): MealDetails => {
  const next = cloneMealDetails(details)
  next[removed.meal].splice(Math.min(removed.index, next[removed.meal].length), 0, { ...removed.line })
  return next
}

export const templateMealLine = (template: FoodTemplate): MealLine => ({
  key: `${template.id}-${crypto.randomUUID()}`,
  templateId: template.id,
  label: template.name,
  amount: 1,
  unit: '份',
  portionLabel: '份',
  kcalPerUnit: template.kcal,
  proteinPerUnit: template.proteinG,
  carbsPerUnit: template.carbsG,
  fatPerUnit: template.fatG,
  fiberPerUnit: template.fiberG,
  sodiumPerUnit: template.sodiumMg
})

export const addFoodTemplate = (details: MealDetails, template: FoodTemplate, meal: MealKey): { details: MealDetails; key: string } => {
  const line = templateMealLine(template)
  return { details: addMealLine(details, meal, line), key: line.key }
}

export const findFoodTemplate = (details: MealDetails, meal: MealKey, templateId: string): MealLine | undefined =>
  details[meal].find((line) => line.templateId === templateId || line.key.startsWith(`${templateId}-`))

export interface CommonIngredient { id: string; line: Omit<MealLine, 'key' | 'amount'>; defaultAmount: number }

/** Uses the same canonical nutrition rows as the built-in meal editor. */
export const commonIngredients = (): CommonIngredient[] => {
  const source = defaultMealDetails()
  const pick = (meal: MealKey, key: string, id: string, defaultAmount: number, label?: string): CommonIngredient => {
    const line = source[meal].find((item) => item.key === key)
    if (!line) throw new Error(`Missing built-in food ${meal}/${key}`)
    const { key: _key, amount: _amount, ...nutrition } = line
    return { id, defaultAmount, line: { ...nutrition, ...(label ? { label } : {}) } }
  }
  return [
    pick('breakfast', 'eggs', 'egg', 1),
    pick('breakfast', 'oil', 'egg-oil', 5),
    pick('breakfast', 'muffin', 'muffin', 1),
    pick('breakfast', 'orange', 'orange-juice', 250),
    pick('breakfast', 'yogurt', 'fage', 250, '高蛋白優格／FAGE'),
    pick('lunch', 'chicken', 'chicken', 200),
    pick('lunch', 'other', 'other-meat', 150),
    pick('lunch', 'veg', 'vegetables', 300),
    pick('lunch', 'rice', 'rice', 100),
    pick('lunch', 'pasta', 'pasta', 60),
    pick('lunch', 'potato', 'potato', 200),
    pick('lunch', 'oil', 'cooking-oil', 5),
    pick('evening', 'soy', 'soy', 250),
    pick('evening', 'chia', 'chia', 15),
    pick('evening', 'barley', 'barley', 5)
  ]
}

export const ingredientMealLine = (ingredient: CommonIngredient, amount: number): MealLine => ({
  ...ingredient.line,
  key: `${ingredient.id}-${crypto.randomUUID()}`,
  amount
})

export const customFoodMealLine = (food: CustomFood, amount = food.defaultAmount): MealLine => {
  const divider = food.basis === '100g' ? 100 : food.defaultAmount || 1
  return {
    key: `${food.id}-${crypto.randomUUID()}`,
    label: food.name,
    amount,
    unit: food.basis === '100g' ? 'g' : '份',
    portionLabel: food.basis === 'serving' ? '份' : undefined,
    kcalPerUnit: food.kcal / divider,
    proteinPerUnit: food.proteinG / divider,
    carbsPerUnit: food.carbsG == null ? undefined : food.carbsG / divider,
    fatPerUnit: food.fatG == null ? undefined : food.fatG / divider,
    fiberPerUnit: food.fiberG == null ? undefined : food.fiberG / divider,
    sodiumPerUnit: food.sodiumMg == null ? undefined : food.sodiumMg / divider
  }
}

export interface ManualMealInput {
  name: string
  kcal: number
  proteinG: number
  carbsG?: number
  fatG?: number
  fiberG?: number
  sodiumMg?: number
  portionLabel?: string
}

export const manualMealLine = (input: ManualMealInput): MealLine => ({
  key: `manual-${crypto.randomUUID()}`,
  label: input.name.trim(),
  amount: 1,
  unit: '份',
  portionLabel: input.portionLabel?.trim() || '份',
  kcalPerUnit: input.kcal,
  proteinPerUnit: input.proteinG,
  carbsPerUnit: input.carbsG,
  fatPerUnit: input.fatG,
  fiberPerUnit: input.fiberG,
  sodiumPerUnit: input.sodiumMg
})

export interface RecentFoodItem {
  id: string
  line: MealLine
  lastUsedDate: string
}

/** Derives a non-persistent recent-food list from the preceding 14 calendar days. */
export const recentFoodItems = (logs: DailyLog[], throughDate: string, limit = 12): RecentFoodItem[] => {
  const through = new Date(`${throughDate}T12:00:00`).getTime()
  const earliest = through - 13 * 86_400_000
  const seen = new Set<string>()
  const result: RecentFoodItem[] = []
  for (const log of [...logs].filter((item) => {
    const time = new Date(`${item.date}T12:00:00`).getTime()
    return time >= earliest && time <= through && item.mealDetails
  }).sort((a, b) => b.date.localeCompare(a.date))) {
    for (const meal of mealKeys) {
      for (const line of [...log.mealDetails![meal]].reverse()) {
        const identity = line.label.trim().toLocaleLowerCase('zh-TW')
        if (line.amount <= 0 || seen.has(identity)) continue
        seen.add(identity)
        result.push({ id: `${log.date}-${meal}-${line.key}`, line: { ...line }, lastUsedDate: log.date })
        if (result.length >= limit) return result
      }
    }
  }
  return result
}

export const hasMealContent = (details?: MealDetails): boolean => Boolean(details && (
  details.ramen.enabled || mealKeys.some((meal) => details[meal].some((line) => line.amount > 0))
))

export const ensureMealDetails = (log: Pick<DailyLog, 'id' | 'mealDetails' | 'intakeKcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sodiumMg'>): MealDetails => {
  if (hasMealContent(log.mealDetails)) return cloneMealDetails(log.mealDetails)
  const hasLegacyTotals = [log.intakeKcal, log.proteinG, log.carbsG, log.fatG, log.fiberG, log.sodiumMg]
    .some((value) => (value ?? 0) > 0)
  const details = cloneMealDetails(log.mealDetails)
  if (!hasLegacyTotals) return details
  details.evening.push({
    key: `legacy-${log.id}`,
    label: '舊版未分類飲食',
    amount: 1,
    unit: '份',
    portionLabel: '份',
    kcalPerUnit: log.intakeKcal ?? 0,
    proteinPerUnit: log.proteinG ?? 0,
    carbsPerUnit: log.carbsG,
    fatPerUnit: log.fatG,
    fiberPerUnit: log.fiberG,
    sodiumPerUnit: log.sodiumMg
  })
  return details
}
