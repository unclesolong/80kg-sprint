import type { ChallengeSettings, DailyLog, FoodTemplate, MealDetails } from './types'

export const defaultFoodTemplates = (): FoodTemplate[] => [
  { id: 'fixed_breakfast', name: '固定早餐', description: '荷包蛋2顆、油5g、英式瑪芬、柳橙汁250ml、FAGE 250g、黑咖啡', meal: 'breakfast', quick: true, kcal: 660, proteinG: 44, carbsG: 63, fatG: 20, fiberG: 2, sodiumMg: 480 },
  { id: 'fage_250', name: 'FAGE 250g', description: 'FAGE Total 0.2% 250g；請依實際包裝修正', meal: 'evening', quick: true, kcal: 183, proteinG: 25, carbsG: 10, fatG: 1, fiberG: 0, sodiumMg: 100 },
  { id: 'chicken_200', name: '雞胸肉200g', description: '雞胸肉生重200g', meal: 'lunch', quick: true, kcal: 240, proteinG: 45, carbsG: 0, fatG: 5, fiberG: 0, sodiumMg: 90 },
  { id: 'chicken_rice', name: '雞胸白飯餐', description: '雞胸肉200g、蔬菜300g、熟白飯100g、油5g', meal: 'lunch', kcal: 520, proteinG: 54, carbsG: 49, fatG: 11, fiberG: 8, sodiumMg: 180 },
  { id: 'chicken_pasta', name: '雞胸義大利麵餐', description: '雞胸肉200g、蔬菜300g、乾義大利麵60g、油5g', meal: 'dinner', kcal: 603, proteinG: 59, carbsG: 64, fatG: 12, fiberG: 9, sodiumMg: 180 },
  { id: 'soy_chia', name: '豆漿＋奇亞籽', description: '無糖豆漿250ml、奇亞籽15g、大麥若葉粉5g', meal: 'evening', quick: true, kcal: 173, proteinG: 11, carbsG: 11, fatG: 9, fiberG: 7, sodiumMg: 90 },
  { id: 'ramen_chicken', name: '泡麵雞胸版', description: '泡麵、雞胸肉與蔬菜；詳細比例請在進階營養的泡麵模板調整', meal: 'dinner', kcal: 650, proteinG: 50, carbsG: 58, fatG: 20, fiberG: 7, sodiumMg: 1300 }
]

export const defaultSettings: ChallengeSettings = {
  startDate: '2026-08-01',
  finalWeighInDate: '2026-08-08',
  baselineWeightKg: 81.1,
  targetWeightKg: 80,
  heightCm: 180,
  activeKcalTarget: 660,
  activeKcalMinimum: 600,
  activeKcalMaximum: 700,
  intakeKcalMinimum: 1700,
  intakeKcalMaximum: 1850,
  proteinMinimumG: 130,
  proteinMaximumG: 150,
  waterMinimumMl: 2500,
  waterMaximumMl: 2800,
  sleepMinimumHours: 7,
  stepsMinimum: 8000,
  stepsMaximum: 10000,
  exerciseMinutesMinimum: 40,
  exerciseMinutesMaximum: 50,
  foodTemplates: defaultFoodTemplates(),
  theme: 'dark',
  onboarded: false
}

export const defaultMealDetails = (): MealDetails => ({
  breakfast: [
    { key: 'eggs', label: '荷包蛋', amount: 2, unit: '顆', kcalPerUnit: 90, proteinPerUnit: 6.3, carbsPerUnit: 0.4, fatPerUnit: 6.8, sodiumPerUnit: 70 },
    { key: 'oil', label: '煎蛋油', amount: 5, unit: 'g', kcalPerUnit: 9, proteinPerUnit: 0, fatPerUnit: 1 },
    { key: 'muffin', label: '英式瑪芬', amount: 1, unit: '份', kcalPerUnit: 140, proteinPerUnit: 5, carbsPerUnit: 26, fatPerUnit: 1, fiberPerUnit: 1.5, sodiumPerUnit: 240 },
    { key: 'orange', label: '100% 柳橙汁', amount: 250, unit: 'ml', kcalPerUnit: 0.45, proteinPerUnit: 0.007, carbsPerUnit: 0.104 },
    { key: 'yogurt', label: '高蛋白優格', amount: 250, unit: 'g', kcalPerUnit: 0.73, proteinPerUnit: 0.1, carbsPerUnit: 0.04, fatPerUnit: 0.002, sodiumPerUnit: 0.4 }
  ],
  lunch: [
    { key: 'chicken', label: '雞胸肉（生重）', amount: 0, unit: 'g', kcalPerUnit: 1.2, proteinPerUnit: 0.225, fatPerUnit: 0.026, sodiumPerUnit: 0.45 },
    { key: 'other', label: '其他肉／魚', amount: 0, unit: 'g', kcalPerUnit: 1.5, proteinPerUnit: 0.2 },
    { key: 'veg', label: '蔬菜', amount: 0, unit: 'g', kcalPerUnit: 0.35, proteinPerUnit: 0.02, carbsPerUnit: 0.07, fatPerUnit: 0.002, fiberPerUnit: 0.025, sodiumPerUnit: 0.3 },
    { key: 'rice', label: '熟白飯', amount: 0, unit: 'g', kcalPerUnit: 1.3, proteinPerUnit: 0.027, carbsPerUnit: 0.282, fatPerUnit: 0.003, fiberPerUnit: 0.004 },
    { key: 'pasta', label: '義大利麵（乾重）', amount: 0, unit: 'g', kcalPerUnit: 3.55, proteinPerUnit: 0.125, carbsPerUnit: 0.72, fatPerUnit: 0.015, fiberPerUnit: 0.03 },
    { key: 'potato', label: '馬鈴薯', amount: 0, unit: 'g', kcalPerUnit: 0.77, proteinPerUnit: 0.02, carbsPerUnit: 0.175, fatPerUnit: 0.001, fiberPerUnit: 0.022 },
    { key: 'oil', label: '烹調油', amount: 0, unit: 'g', kcalPerUnit: 9, proteinPerUnit: 0, fatPerUnit: 1 },
    { key: 'sauce', label: '醬料熱量', amount: 0, unit: '份', kcalPerUnit: 1, proteinPerUnit: 0 },
    { key: 'extra', label: '其他食物熱量', amount: 0, unit: '份', kcalPerUnit: 1, proteinPerUnit: 0 }
  ],
  dinner: [],
  evening: [
    { key: 'soy', label: '無糖豆漿', amount: 250, unit: 'ml', kcalPerUnit: 0.34, proteinPerUnit: 0.03, carbsPerUnit: 0.01, fatPerUnit: 0.018, fiberPerUnit: 0.005, sodiumPerUnit: 0.35 },
    { key: 'chia', label: '奇亞籽', amount: 15, unit: 'g', kcalPerUnit: 4.86, proteinPerUnit: 0.165, carbsPerUnit: 0.421, fatPerUnit: 0.307, fiberPerUnit: 0.344, sodiumPerUnit: 0.16 },
    { key: 'barley', label: '大麥若葉粉', amount: 0, unit: 'g', kcalPerUnit: 3, proteinPerUnit: 0.15, carbsPerUnit: 0.5, fatPerUnit: 0.05, fiberPerUnit: 0.2 }
  ],
  ramen: {
    enabled: false,
    packageKcal: 450,
    packageProteinG: 9,
    packageCarbsG: 62,
    packageFatG: 18,
    packageSodiumMg: 1800,
    noodleRatio: 1,
    seasoningRatio: 1,
    oilRatio: 1,
    drankSoup: false,
    chickenG: 0,
    vegetablesG: 0
  }
})

export const emptyMealDetails = (): MealDetails => {
  const details = defaultMealDetails()
  return {
    breakfast: details.breakfast.map((line) => ({ ...line, amount: 0 })),
    lunch: details.lunch.map((line) => ({ ...line, amount: 0 })),
    dinner: details.lunch.map((line) => ({ ...line, amount: 0 })),
    evening: details.evening.map((line) => ({ ...line, amount: 0 })),
    ramen: { ...details.ramen, enabled: false, chickenG: 0, vegetablesG: 0 }
  }
}

export const emptyLog = (date: string): DailyLog => {
  const now = new Date().toISOString()
  const mealDetails = emptyMealDetails()
  return {
    id: date,
    date,
    weightCondition: 'morning_fasted',
    mealMode: 'quick',
    mealDetails,
    bowelMovement: 'unrecorded',
    createdAt: now,
    updatedAt: now
  }
}

export const migrateSettings = (settings?: Partial<ChallengeSettings>): ChallengeSettings => ({
  ...defaultSettings,
  ...settings,
  foodTemplates: (settings?.foodTemplates?.length ? settings.foodTemplates : defaultFoodTemplates()).map((template) => ({ ...template }))
})

export const migrateLog = (log: DailyLog): DailyLog => ({
  ...log,
  workouts: log.workouts?.map((workout) => ({
    ...workout,
    activityKcalMode: workout.activityKcalMode ?? 'included_in_daily_total'
  }))
})
