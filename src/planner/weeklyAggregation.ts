import { average, dailyDeficit, effectiveActiveKcal } from '../calculations'
import type { DailyLog } from '../types'
import type { AIComment, PlanVersion, WeeklyAggregate } from './types'

const validAverage = (values: Array<number | undefined>) => average(values)

export const aggregateWeek = (logs: DailyLog[], weekStart: string, weekEnd: string, previousLogs: DailyLog[] = []): { dataCompleteness: number; summary: WeeklyAggregate } => {
  const week = logs.filter((log) => log.date >= weekStart && log.date <= weekEnd)
  const previousMorning = previousLogs.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const morning = week.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const intake = week.filter((log) => log.intakeKcal != null)
  const finalized = week.filter((log) => log.dayFinalized)
  const fieldsPerDay = week.map((log) => [log.weightKg, log.intakeKcal, log.proteinG, log.waterMl, effectiveActiveKcal(log), log.steps, log.sleepHours, log.lowerLegTightness].filter((value) => value != null).length + (log.dayFinalized ? 1 : 0))
  const completeness = week.length ? Math.round(fieldsPerDay.reduce((sum, value) => sum + value, 0) / (week.length * 9) * 100) : 0
  const currentWeight = validAverage(morning.map((log) => log.weightKg))
  const previousWeight = validAverage(previousMorning.map((log) => log.weightKg))
  return {
    dataCompleteness: completeness,
    summary: {
      morningWeightCount: morning.length,
      intakeDayCount: intake.length,
      finalizedDayCount: finalized.length,
      averageMorningWeightKg: currentWeight,
      previousAverageMorningWeightKg: previousWeight,
      weightTrendKg: currentWeight != null && previousWeight != null ? Math.round((currentWeight - previousWeight) * 10) / 10 : undefined,
      averageIntakeKcal: validAverage(week.map((log) => log.intakeKcal)),
      averageProteinG: validAverage(week.map((log) => log.proteinG)),
      averageWaterMl: validAverage(week.map((log) => log.waterMl)),
      averageActiveKcal: validAverage(week.map(effectiveActiveKcal)),
      averageSteps: validAverage(week.map((log) => log.steps)),
      averageSleepHours: validAverage(week.map((log) => log.sleepHours)),
      averageFatigue: validAverage(week.map((log) => log.fatigueLevel)),
      averageHunger: validAverage(week.map((log) => log.hungerLevel)),
      averagePain: validAverage(week.map((log) => log.lowerLegTightness)),
      highSaltMealCount: week.filter((log) => log.highSaltMeal).length,
      bowelMovementDays: week.filter((log) => log.bowelMovement === 'yes').length,
      cumulativeFinalizedDeficitKcal: Math.round(finalized.reduce((sum, log) => sum + (dailyDeficit(log) ?? 0), 0))
    }
  }
}

export const buildLocalWeeklyComment = (summary: WeeklyAggregate, completeness: number): { decision: 'maintain' | 'improve_data_first' | 'recovery_priority'; comment: AIComment; warnings: string[] } => {
  if (summary.morningWeightCount < 4 || summary.intakeDayCount < 4 || summary.finalizedDayCount < 4 || completeness < 55) return {
    decision: 'improve_data_first',
    comment: { title: '先補足資料，不調整熱量', summary: '本週有效紀錄不足，維持目前設定會比根據零碎數字調整更安全。', bullets: ['至少記錄 4 次晨重', '完成 4 天飲食與日結', '下週再比較趨勢'], tone: 'neutral' },
    warnings: ['資料不足，不調整熱量']
  }
  if ((summary.averagePain ?? 0) >= 2.5 || (summary.averageFatigue ?? 0) >= 4) return {
    decision: 'recovery_priority',
    comment: { title: '本週先把恢復放在前面', summary: '疼痛或疲勞訊號偏高；維持熱量，不增加跑步或補償性活動。', bullets: ['保持正餐與飲水', '改用不痛的低衝擊活動', '症狀持續請尋求專業評估'], tone: 'caution' },
    warnings: ['恢復優先，不提高活動量']
  }
  return {
    decision: 'maintain',
    comment: { title: '本週維持計畫', summary: '紀錄完整度足以觀察方向，目前不需要因單日波動改動熱量。', bullets: ['維持目前熱量範圍', '晚餐與飲水保持穩定', '下週使用相同條件比較晨重'], tone: 'supportive' },
    warnings: []
  }
}

export const buildNextWeekVersion = (current: PlanVersion, effectiveFrom: string, comment: AIComment): PlanVersion => ({
  ...current,
  id: `version-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  effectiveFrom,
  comment,
  createdAt: new Date().toISOString(),
  createdBy: 'manual'
})

export const validateWeeklyCalorieAdjustment = (adjustment: number) => [-150, -100, 0, 100, 150].includes(adjustment)
