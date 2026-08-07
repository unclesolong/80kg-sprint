import { activityTotals, average, dailyDeficit, effectiveActiveKcal, estimatedTDEE, fatEquivalentKg, finalizedCumulativeDeficit, finalizedDeficit, movingAverage, weightPrediction } from './calculations'
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
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

const show = (value: number | undefined, suffix = '') => value == null ? '—' : `${Math.round(value * 10) / 10}${suffix}`

export const buildWeeklySummary = (settings: ChallengeSettings, logs: DailyLog[], today: string): string => {
  const ordered = [...logs].filter((log) => log.date >= settings.startDate && log.date <= settings.finalWeighInDate).sort((a, b) => a.date.localeCompare(b.date))
  const morning = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const trend = movingAverage(morning.map((log) => log.weightKg), 3).at(-1)
  const prediction = weightPrediction(morning.map((log) => ({ date: log.date, weight: log.weightKg! })), settings.finalWeighInDate)
  const finalized = ordered.filter((log) => log.dayFinalized)
  const cumulative = finalizedCumulativeDeficit(ordered, settings)
  const records = ordered.map((log) => {
    const activity = activityTotals(log)
    return `日期：${log.date}
晨間體重：${log.weightCondition === 'morning_fasted' ? show(log.weightKg, ' kg') : '—'}
腰圍：${show(log.waistCm, ' cm')}
攝取熱量：${show(log.intakeKcal, ' kcal')}
蛋白質：${show(log.proteinG, ' g')}
碳水：${show(log.carbsG, ' g')}
脂肪：${show(log.fatG, ' g')}
纖維：${show(log.fiberG, ' g')}
鈉：${show(log.sodiumMg, ' mg')}
Apple Watch靜態能量：${show(log.restingKcal, ' kcal')}
Apple Watch／活動摘要：${show(log.activeKcal, ' kcal')}
尚未反映的運動加計：${show(activity.additionalWorkoutActiveKcal, ' kcal')}
目前活動能量合計：${show(activity.effectiveActiveKcal, ' kcal')}
推估總消耗：${show(estimatedTDEE(log), ' kcal')}
日結狀態：${log.dayFinalized ? `已結算${log.finalizedAt ? `（${log.finalizedAt}）` : ''}` : log.needsRefinalization ? '資料已變更，需重新結算' : '尚未結算'}
最終推估赤字：${show(finalizedDeficit(log), ' kcal')}
步數：${show(log.steps)}
運動分鐘：${show(log.exerciseMinutes, ' 分')}
超慢跑分鐘：${show(log.slowJogMinutes, ' 分')}
平均運動心率：${show(log.averageExerciseHeartRate, ' bpm')}
靜息心率：${show(log.restingHeartRate, ' bpm')}
HRV：${show(log.heartRateVariabilityMs, ' ms')}
運動明細：${log.workouts?.length ? log.workouts.map((workout) => `${workout.title} ${workout.durationMinutes}分${workout.distanceKm == null ? '' : ` ${workout.distanceKm}km`}${workout.activeKcal == null ? '' : ` ${workout.activeKcal}kcal`}（${workout.source === 'apple_watch' ? 'Apple Watch' : '手動'}；${workout.activityKcalMode === 'add_to_daily_total' ? '尚未包含，另行加計' : '已包含於摘要'}）`).join('；') : '—'}
白開水：${show(log.waterMl, ' ml')}
前一晚睡眠：${show(log.sleepHours, ' 小時')}${log.sleepStartedAt || log.sleepEndedAt ? `（${log.sleepStartedAt || '—'} → ${log.sleepEndedAt || '—'}，歸在醒來日）` : ''}
排便：${log.bowelMovement === 'yes' ? '有' : '無'}
Bristol型態：${show(log.bristolType)}
高鹽餐：${log.highSaltMeal ? '是' : '否'}
疲勞：${show(log.fatigueLevel)}
飢餓：${show(log.hungerLevel)}
下肢／足底不適：${show(log.lowerLegTightness, '/5')}
疼痛備註：${log.painNotes || '—'}
備註：${log.notes || '—'}`
  }).join('\n\n')
  const day = Math.max(1, Math.min(Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${settings.startDate}T12:00:00`).getTime()) / 86_400_000) + 1, Math.max(1, Math.round((new Date(`${settings.finalWeighInDate}T12:00:00`).getTime() - new Date(`${settings.startDate}T12:00:00`).getTime()) / 86_400_000))))
  const reportEnd = today < settings.finalWeighInDate ? today : settings.finalWeighInDate
  const expectedDays = reportEnd < settings.startDate ? 0 : Math.max(1, Math.round((new Date(`${reportEnd}T12:00:00`).getTime() - new Date(`${settings.startDate}T12:00:00`).getTime()) / 86_400_000) + 1)
  const completeness = expectedDays ? Math.round(ordered.filter((log) => log.date <= reportEnd && log.intakeKcal != null && effectiveActiveKcal(log) != null && log.weightKg != null).length / expectedDays * 100) : 0
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
平均活動能量：${show(average(ordered.map(effectiveActiveKcal)), ' kcal')}
已結算天數：${finalized.length} 天
平均最終赤字：${show(average(finalized.map(dailyDeficit)), ' kcal')}
累積最終赤字：${show(cumulative, ' kcal')}
脂肪等值估算：${show(fatEquivalentKg(cumulative), ' kg')}
最終日預測體重：${prediction.confidence === 'insufficient' ? `資料不足（目前 ${prediction.sampleCount} 筆，需至少 7 筆晨間體重）` : `${prediction.value!.toFixed(1)} kg（${prediction.confidence === 'low' ? '低信心；' : '趨勢估算；'}約 ±0.5 kg 水分波動，預測不是保證）`}
資料完整率：${completeness}%（以挑戰開始至 ${reportEnd} 的預期天數計算）

分析提醒：活動合計只加上標記為「尚未包含」的運動；已包含於 Apple Watch／摘要的明細不重複計算。只有按下「完成今日結算」的日期會納入平均與累積赤字；日間資料不當作最終結果。此摘要是紀錄與估算，不是醫療診斷。`
}

export const buildCsv = (logs: DailyLog[]): string => {
  const headers = ['日期', '已結算', '結算時間', '需重新結算', '最終赤字kcal', '體重kg', '量測條件', '腰圍cm', '活動摘要kcal', '待同步運動kcal', '目前活動合計kcal', '靜態kcal', '攝取kcal', '蛋白質g', '碳水g', '脂肪g', '纖維g', '鈉mg', '白開水ml', '步數', '距離km', '運動分鐘', '運動明細數', '運動明細JSON', '平均心率', '靜息心率', 'HRVms', '睡眠開始', '睡眠結束', '睡眠小時', '排便', 'Bristol', '疲勞', '飢餓', '下肢足底不適0至5', '疼痛備註', '備註']
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [...logs].sort((a, b) => a.date.localeCompare(b.date)).map((log) => {
    const activity = activityTotals(log)
    return [log.date, log.dayFinalized ? '是' : '否', log.finalizedAt, log.needsRefinalization ? '是' : '否', finalizedDeficit(log), log.weightKg, log.weightCondition, log.waistCm, log.activeKcal, activity.additionalWorkoutActiveKcal, activity.effectiveActiveKcal, log.restingKcal, log.intakeKcal, log.proteinG, log.carbsG, log.fatG, log.fiberG, log.sodiumMg, log.waterMl, log.steps, log.distanceKm, log.exerciseMinutes, log.workouts?.length ?? 0, log.workouts?.length ? JSON.stringify(log.workouts) : '', log.averageExerciseHeartRate, log.restingHeartRate, log.heartRateVariabilityMs, log.sleepStartedAt, log.sleepEndedAt, log.sleepHours, log.bowelMovement, log.bristolType, log.fatigueLevel, log.hungerLevel, log.lowerLegTightness, log.painNotes, log.notes].map(escape).join(',')
  })
  return `\uFEFF${headers.map(escape).join(',')}\n${rows.join('\n')}`
}
