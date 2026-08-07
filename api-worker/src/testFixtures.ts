import type {
  FoodParseOutput,
  PlanAIOutput,
  PlanGenerateRequest,
  SafetyBounds,
  WeeklyReviewAIOutput,
  WeeklyReviewRequest,
} from './contracts'

export const safetyBounds: SafetyBounds = {
  dailyCalories: { min: 1_500, max: 2_100, recommended: 1_800 },
  weeklyLossKg: { min: 0.2, max: 0.8, recommended: 0.5 },
  weeklyLossPercent: { min: 0.25, max: 1, recommended: 0.6 },
  proteinG: { min: 120, max: 165, recommended: 140 },
  waterMl: { min: 1_800, max: 3_500, recommended: 2_400 },
  aerobicMinutesPerWeek: { min: 60, max: 150, recommended: 100 },
  strengthDaysPerWeek: { min: 1, max: 4, recommended: 2 },
  earliestGoalDate: '2026-10-30',
  recommendedGoalDate: '2026-11-20',
  latestSuggestedGoalDate: '2027-01-15',
}

export const planRequest: PlanGenerateRequest = {
  profile: {
    age: 41,
    calculationSex: 'male',
    heightCm: 180,
    currentWeightKg: 80.2,
    goalWeightKg: 75,
    averageSteps: 6_800,
    workActivity: 'sedentary',
    exerciseSessionsPerWeek: 3,
    exerciseMinutesPerWeek: 90,
    dietaryPattern: 'omnivore',
    locale: 'zh-TW',
  },
  goalDate: '2026-11-20',
  safety: {
    status: 'approved',
    bounds: safetyBounds,
    limitations: [],
    kidneyDisease: false,
    currentInjuryOrPain: false,
    painLevel: 0,
  },
  localRecommendation: {
    selectedTargets: {
      calorieTargetKcal: 1_800,
      proteinMinG: 125,
      proteinMaxG: 155,
      waterTargetMl: 2_400,
      expectedWeeklyLossKg: 0.5,
      aerobicMinutesPerWeek: 100,
      strengthDaysPerWeek: 2,
      eveningReserveKcal: 170,
    },
    focusTasks: ['穩定紀錄三餐', '白開水分次達標'],
  },
}

export const planOutput: PlanAIOutput = {
  schemaVersion: 1,
  status: 'ok',
  selectedTargets: { ...planRequest.localRecommendation.selectedTargets },
  focusTasks: ['維持穩定紀錄', '優先補足飲水'],
  comment: {
    title: '先維持這份安全節奏',
    summary: '目前的目標落在本地安全邊界內，先穩定執行再依每週資料調整。',
    bullets: ['不再額外壓低熱量', '疼痛時不補跑'],
    tone: 'supportive',
  },
  assumptions: [{ code: 'aggregate_only', text: '使用你確認的基本資料與活動摘要。' }],
  warnings: [],
}

export const weeklyRequest: WeeklyReviewRequest = {
  weekStart: '2026-08-03',
  weekEnd: '2026-08-09',
  dataCompleteness: 0.86,
  summary: {
    averageWeightKg: 80.1,
    weightChangeKg: -0.4,
    averageIntakeKcal: 1_910,
    averageProteinG: 133,
    averageWaterMl: 2_200,
    averageActiveEnergyKcal: 360,
    painMax: 1,
    completedDays: 6,
  },
  currentVersion: { ...planRequest.localRecommendation.selectedTargets },
  safety: { ...planRequest.safety },
}

export const weeklyOutput: WeeklyReviewAIOutput = {
  schemaVersion: 1,
  decision: 'maintain',
  calorieAdjustmentKcal: 0,
  activityAdjustment: { aerobicMinutesDelta: 0, strengthDaysDelta: 0 },
  focusTasks: ['飲水達標', '晚餐穩定'],
  comment: {
    title: '本週維持計畫',
    summary: '資料完整度足夠，趨勢也在安全節奏內，下週不需要追加熱量赤字。',
    bullets: ['維持目前熱量', '持續觀察恢復'],
    tone: 'supportive',
  },
  warnings: [],
}

export const foodParseOutput: FoodParseOutput = {
  schemaVersion: 1,
  items: [
    {
      rawText: '雞胸200g',
      normalizedName: '雞胸肉',
      amount: 200,
      unit: 'g',
      preparation: null,
      weightState: 'unknown',
      brand: null,
      searchTerms: ['雞胸肉', 'chicken breast'],
      needsConfirmation: true,
      confirmationQuestion: '這是生重還是熟重？',
    },
  ],
  unparsedText: [],
}
