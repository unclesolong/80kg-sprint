import { average, cumulativeDeficit, dailyDeficit, estimatedTDEE, fatEquivalentKg, linearRegressionProjection, movingAverage } from './calculations'
import type { BackupPayload, ChallengeSettings, CustomFood, DailyLog } from './types'

export const makeBackup = (settings: ChallengeSettings, logs: DailyLog[], foods: CustomFood[]): BackupPayload => ({
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  settings,
  logs,
  foods
})

export const downloadText = (filename: string, content: string, type = 'text/plain;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const show = (value: number | undefined, suffix = '') => value == null ? '—' : `${Math.round(value * 10) / 10}${suffix}`

export const buildWeeklySummary = (settings: ChallengeSettings, logs: DailyLog[], today: string): string => {
  const ordered = [...logs].filter((log) => log.date >= settings.startDate && log.date <= settings.finalWeighInDate).sort((a, b) => a.date.localeCompare(b.date))
  const morning = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const trend = movingAverage(morning.map((log) => log.weightKg), 3).at(-1)
  const prediction = linearRegressionProjection(morning.map((log) => ({ date: log.date, weight: log.weightKg! })), settings.finalWeighInDate)
  const cumulative = cumulativeDeficit(ordered, settings)
  const records = ordered.map((log) => `日期：${log.date}
晨間體重：${log.weightCondition === 'morning_fasted' ? show(log.weightKg, ' kg') : '—'}
腰圍：${show(log.waistCm, ' cm')}
攝取熱量：${show(log.intakeKcal, ' kcal')}
蛋白質：${show(log.proteinG, ' g')}
Apple Watch靜態能量：${show(log.restingKcal, ' kcal')}
Apple Watch活動能量：${show(log.activeKcal, ' kcal')}
推估總消耗：${show(estimatedTDEE(log), ' kcal')}
推估赤字：${show(dailyDeficit(log), ' kcal')}
步數：${show(log.steps)}
運動分鐘：${show(log.exerciseMinutes, ' 分')}
超慢跑分鐘：${show(log.slowJogMinutes, ' 分')}
平均運動心率：${show(log.averageExerciseHeartRate, ' bpm')}
白開水：${show(log.waterMl, ' ml')}
睡眠：${show(log.sleepHours, ' 小時')}
排便：${log.bowelMovement === 'yes' ? '有' : '無'}
Bristol型態：${show(log.bristolType)}
高鹽餐：${log.highSaltMeal ? '是' : '否'}
疲勞：${show(log.fatigueLevel)}
飢餓：${show(log.hungerLevel)}
備註：${log.notes || '—'}`).join('\n\n')
  const day = Math.max(1, Math.min(Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${settings.startDate}T12:00:00`).getTime()) / 86_400_000) + 1, Math.max(1, Math.round((new Date(`${settings.finalWeighInDate}T12:00:00`).getTime() - new Date(`${settings.startDate}T12:00:00`).getTime()) / 86_400_000))))
  const completeness = ordered.length ? Math.round(ordered.filter((log) => log.intakeKcal != null && log.activeKcal != null && log.weightKg != null).length / ordered.length * 100) : 0
  return `【80KG Sprint 一週紀錄】
挑戰日期：${settings.startDate} 至 ${settings.finalWeighInDate}
基準體重：${settings.baselineWeightKg} kg
目標體重：${settings.targetWeightKg} kg
今日為第幾天：第 ${day} 天

每日紀錄：
${records || '尚無紀錄'}

目前統計：
3日平均體重：${show(trend, ' kg')}
實際體重變化：${morning.length ? show(morning.at(-1)!.weightKg! - settings.baselineWeightKg, ' kg') : '—'}
平均攝取：${show(average(ordered.map((log) => log.intakeKcal)), ' kcal')}
平均活動能量：${show(average(ordered.map((log) => log.activeKcal)), ' kcal')}
平均推估赤字：${show(average(ordered.map(dailyDeficit)), ' kcal')}
累積推估赤字：${show(cumulative, ' kcal')}
脂肪等值估算：${show(fatEquivalentKg(cumulative), ' kg')}
最終日預測體重：${prediction == null ? '資料不足（需至少3筆晨間體重）' : `${show(prediction, ' kg')}（約 ±0.5 kg 水分波動，預測不是保證）`}
資料完整率：${completeness}%`
}

export const buildCsv = (logs: DailyLog[]): string => {
  const headers = ['日期', '體重kg', '量測條件', '腰圍cm', '活動kcal', '靜態kcal', '攝取kcal', '蛋白質g', '白開水ml', '步數', '運動分鐘', '超慢跑分鐘', '平均心率', '睡眠小時', '排便', 'Bristol', '疲勞', '飢餓', '備註']
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [...logs].sort((a, b) => a.date.localeCompare(b.date)).map((log) => [log.date, log.weightKg, log.weightCondition, log.waistCm, log.activeKcal, log.restingKcal, log.intakeKcal, log.proteinG, log.waterMl, log.steps, log.exerciseMinutes, log.slowJogMinutes, log.averageExerciseHeartRate, log.sleepHours, log.bowelMovement, log.bristolType, log.fatigueLevel, log.hungerLevel, log.notes].map(escape).join(','))
  return `\uFEFF${headers.map(escape).join(',')}\n${rows.join('\n')}`
}
