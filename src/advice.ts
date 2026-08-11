import { average, dailyDeficit, effectiveActiveKcal, movingAverage, targetWeightForDate } from './calculations'
import type { ChallengeSettings, DailyLog } from './types'

export interface Advice { level: 'good' | 'near' | 'warn'; text: string }

export const buildAdvice = (current: DailyLog, logs: DailyLog[], settings: ChallengeSettings): Advice[] => {
  const advice: Advice[] = []
  const ordered = [...logs].filter((log) => log.date <= current.date).sort((a, b) => a.date.localeCompare(b.date))
  const previous = ordered.at(-2)
  const currentActivity = effectiveActiveKcal(current)
  const guidanceEnabled = (settings.guidanceMode ?? (settings.onboarded ? 'legacy_targets' : 'tracking_only')) !== 'tracking_only'
  const calorieGuidanceEnabled = guidanceEnabled && settings.intakeKcalMaximum > 0
  const proteinGuidanceEnabled = guidanceEnabled && settings.proteinMinimumG > 0
  const waterGuidanceEnabled = guidanceEnabled && settings.waterMinimumMl > 0
  const sleepGuidanceEnabled = guidanceEnabled && settings.sleepMinimumHours > 0
  const activityGuidanceEnabled = guidanceEnabled && settings.activeKcalMinimum > 0
  const discomfortIncreasing = previous?.lowerLegTightness != null && current.lowerLegTightness != null && current.lowerLegTightness > previous.lowerLegTightness
  const concerningPainNote = /腫脹|發紅|尖銳|無法.*走|不能.*走/.test(current.painNotes ?? '')

  if (concerningPainNote) {
    advice.push({ level: 'warn', text: '備註提到較明顯的不適；請停止勉強運動，若持續或影響日常活動，尋求醫療專業評估。本 App 不作診斷。' })
  }
  if ((current.lowerLegTightness ?? 0) >= 3) {
    advice.push({ level: 'warn', text: '今天的不適程度較高，請休息或只做不會加重症狀的低強度活動；不必為了達成活動數字勉強運動。' })
  } else if (current.lowerLegTightness === 2) {
    advice.push({ level: 'near', text: '今天已有活動相關不適，先避免會加重症狀的運動；日常活動自然且沒有惡化即可。' })
  } else if (discomfortIncreasing) {
    advice.push({ level: 'near', text: '活動相關不適正在上升，今天不要提高運動量，先觀察恢復。' })
  } else if ((sleepGuidanceEnabled && (current.sleepHours ?? settings.sleepMinimumHours) < settings.sleepMinimumHours) || (current.fatigueLevel ?? 1) >= 4) {
    advice.push({ level: 'near', text: activityGuidanceEnabled
      ? `今天以恢復為先，不增加運動量；活動能量可低於平日參考值 ${settings.activeKcalMinimum} kcal。`
      : '今天以恢復為先，不需要增加運動量；依身體感受安排休息或輕度活動。' })
  } else if (activityGuidanceEnabled && currentActivity == null) {
    advice.push({ level: 'near', text: '活動資料尚未記錄；可填入穿戴裝置摘要，或只記錄今天的運動時間與感受。' })
  } else if (activityGuidanceEnabled && currentActivity != null && currentActivity < settings.activeKcalMinimum) {
    advice.push({ level: 'near', text: '目前活動尚未達參考目標；若稍晚身體感覺良好，可選擇一段輕鬆、熟悉的活動。' })
  } else if (activityGuidanceEnabled) {
    advice.push({ level: 'good', text: '目前活動能量已達基本目標，不需要為了湊數字再做長時間運動。' })
  }
  if (calorieGuidanceEnabled && current.intakeKcal != null && current.intakeKcal > settings.intakeKcalMaximum) advice.push({ level: 'warn', text: '攝取高於目前計畫範圍，可檢查份量以及容易漏記的油脂、醬料、飲料或零食；不需要用懲罰性運動抵銷。' })
  if (proteinGuidanceEnabled && current.proteinG != null && current.proteinG < settings.proteinMinimumG) advice.push({ level: 'near', text: '蛋白質尚未達計畫範圍，下一餐可選擇自己習慣且符合飲食需求的蛋白質來源。' })
  if (waterGuidanceEnabled && current.waterMl != null && current.waterMl < settings.waterMinimumMl) advice.push({ level: 'near', text: '白開水尚未達計畫參考量，請分次補水，不要短時間大量灌水。' })

  if (previous && (dailyDeficit(previous) ?? 0) > 1000 && (dailyDeficit(current) ?? 0) > 1000) {
    advice.push({ level: 'warn', text: '已連續兩天推估赤字超過 1000 kcal，建議增加 100–200 kcal 攝取或降低運動。' })
  }

  const recentBowel = ordered.slice(-3)
  const noBowel = recentBowel.filter((log) => log.bowelMovement === 'none').length
  const hardStool = ordered.slice(-2).length === 2 && ordered.slice(-2).every((log) => (log.bristolType ?? 7) <= 2)
  if (noBowel >= 3) advice.push({ level: 'warn', text: '已三天未排便，建議向藥師或醫師諮詢。若有劇烈腹痛、嘔吐、腹脹或血便，請就醫；本 App 不作診斷。' })
  else if (noBowel >= 2 || hardStool) advice.push({ level: 'near', text: '留意排便：維持飲水、富含纖維的食物與日常活動，不要為體重數字減少喝水或自行使用瀉藥。' })

  const morning = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const trends = movingAverage(morning.map((log) => log.weightKg), 3)
  const trend = trends.at(-1)
  if (calorieGuidanceEnabled && activityGuidanceEnabled && trend != null && morning.length >= 3) {
    const threeDaysAgo = trends.at(-3)
    if (threeDaysAgo != null && threeDaysAgo - trend > 1) advice.push({ level: 'near', text: '3 日趨勢下降超過 1 kg，多數可能包含水分，不要繼續降低熱量。' })
    const completion = average(ordered.slice(-3).map((log) => {
      const intakeOk = (log.intakeKcal ?? -1) >= settings.intakeKcalMinimum && (log.intakeKcal ?? Infinity) <= settings.intakeKcalMaximum
      const activityOk = (effectiveActiveKcal(log) ?? 0) >= settings.activeKcalMinimum
      return intakeOk && activityOk ? 100 : intakeOk || activityOk ? 50 : 0
    })) ?? 0
    if (trend > targetWeightForDate(current.date, settings) + 0.3 && completion >= 80) {
      advice.push({ level: 'near', text: '趨勢略高於目標且執行穩定：只調整一項——每日減少約 100 kcal。' })
    }
  }
  return advice.slice(0, 4)
}
