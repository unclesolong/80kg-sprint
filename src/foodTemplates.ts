import { addFoodTemplate, ensureMealDetails, nutritionPatch, type MealKey } from './mealOperations'
import type { DailyLog, FoodTemplate } from './types'

const nutritionFields = ['intakeKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'] as const

export type FoodUndoPatch = Pick<DailyLog, (typeof nutritionFields)[number] | 'mealDetails' | 'foodUpdatedAt' | 'breakfastPlanCompleted' | 'lunchPlateCompleted' | 'dinnerPlateCompleted' | 'soyChiaCompleted'>

export const createFoodTemplateChange = (log: DailyLog, template: FoodTemplate, now = new Date().toISOString(), meal: MealKey = template.meal): { patch: Partial<DailyLog>; undoPatch: FoodUndoPatch; addedKey: string; meal: MealKey } => {
  const originalDetails = ensureMealDetails(log)
  const added = addFoodTemplate(originalDetails, template, meal)
  const completionPatch = template.id === 'fixed_breakfast' ? { breakfastPlanCompleted: true }
    : template.id === 'soy_chia' ? { soyChiaCompleted: true }
      : meal === 'lunch' ? { lunchPlateCompleted: true }
        : meal === 'dinner' ? { dinnerPlateCompleted: true }
          : {}
  return {
    patch: {
      ...nutritionPatch(added.details, now),
      ...completionPatch
    },
    undoPatch: {
      ...nutritionPatch(originalDetails, log.foodUpdatedAt),
      foodUpdatedAt: log.foodUpdatedAt,
      breakfastPlanCompleted: log.breakfastPlanCompleted,
      lunchPlateCompleted: log.lunchPlateCompleted,
      dinnerPlateCompleted: log.dinnerPlateCompleted,
      soyChiaCompleted: log.soyChiaCompleted
    },
    addedKey: added.key,
    meal
  }
}
