import { emptyMealDetails } from './defaults'
import type { DailyLog, FoodTemplate, MealDetails, MealLine } from './types'

const nutritionFields = ['intakeKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'] as const

export type FoodUndoPatch = Pick<DailyLog, (typeof nutritionFields)[number] | 'mealDetails' | 'foodUpdatedAt' | 'breakfastPlanCompleted' | 'lunchPlateCompleted' | 'dinnerPlateCompleted' | 'soyChiaCompleted'>

const templateLine = (template: FoodTemplate): MealLine => ({
  key: `${template.id}-${crypto.randomUUID()}`,
  label: template.name,
  amount: 1,
  unit: '份',
  kcalPerUnit: template.kcal,
  proteinPerUnit: template.proteinG,
  carbsPerUnit: template.carbsG,
  fatPerUnit: template.fatG,
  fiberPerUnit: template.fiberG,
  sodiumPerUnit: template.sodiumMg
})

const clonedDetails = (value?: MealDetails): MealDetails => {
  const details = value ?? emptyMealDetails()
  return {
    breakfast: details.breakfast.map((line) => ({ ...line })),
    lunch: details.lunch.map((line) => ({ ...line })),
    dinner: details.dinner.map((line) => ({ ...line })),
    evening: details.evening.map((line) => ({ ...line })),
    ramen: { ...details.ramen }
  }
}

export const createFoodTemplateChange = (log: DailyLog, template: FoodTemplate, now = new Date().toISOString()): { patch: Partial<DailyLog>; undoPatch: FoodUndoPatch } => {
  const mealDetails = clonedDetails(log.mealDetails)
  mealDetails[template.meal] = [...mealDetails[template.meal], templateLine(template)]
  const completionPatch = template.id === 'fixed_breakfast' ? { breakfastPlanCompleted: true }
    : template.id === 'soy_chia' ? { soyChiaCompleted: true }
      : template.meal === 'lunch' ? { lunchPlateCompleted: true }
        : template.meal === 'dinner' ? { dinnerPlateCompleted: true }
          : {}
  return {
    patch: {
      intakeKcal: (log.intakeKcal ?? 0) + template.kcal,
      proteinG: (log.proteinG ?? 0) + template.proteinG,
      carbsG: (log.carbsG ?? 0) + template.carbsG,
      fatG: (log.fatG ?? 0) + template.fatG,
      fiberG: (log.fiberG ?? 0) + template.fiberG,
      sodiumMg: (log.sodiumMg ?? 0) + template.sodiumMg,
      mealDetails,
      foodUpdatedAt: now,
      ...completionPatch
    },
    undoPatch: {
      intakeKcal: log.intakeKcal,
      proteinG: log.proteinG,
      carbsG: log.carbsG,
      fatG: log.fatG,
      fiberG: log.fiberG,
      sodiumMg: log.sodiumMg,
      mealDetails: log.mealDetails,
      foodUpdatedAt: log.foodUpdatedAt,
      breakfastPlanCompleted: log.breakfastPlanCompleted,
      lunchPlateCompleted: log.lunchPlateCompleted,
      dinnerPlateCompleted: log.dinnerPlateCompleted,
      soyChiaCompleted: log.soyChiaCompleted
    }
  }
}
