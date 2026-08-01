import { average, dailyDeficit, movingAverage, targetWeightForDate } from './calculations'
import type { ChallengeSettings, DailyLog } from './types'

export interface Advice { level: 'good' | 'near' | 'warn'; text: string }

export const buildAdvice = (current: DailyLog, logs: DailyLog[], settings: ChallengeSettings): Advice[] => {
  const advice: Advice[] = []
  const ordered = [...logs].filter((log) => log.date <= current.date).sort((a, b) => a.date.localeCompare(b.date))
  const previous = ordered.at(-2)

  if ((current.sleepHours ?? settings.sleepMinimumHours) < settings.sleepMinimumHours || (current.fatigueLevel ?? 1) >= 4) {
    advice.push({ level: 'near', text: `今天以恢復為先，不增加運動量；活動能量可暫降到約 ${Math.round(settings.activeKcalMinimum * .9)}–${settings.activeKcalMinimum} kcal。` })
  } else if ((current.activeKcal ?? 0) < settings.activeKcalMinimum) {
    advice.push({ level: 'near', text: '若身體感覺良好，可增加 15–20 分鐘輕鬆走路或超慢跑。' })
  } else {
    advice.push({ level: 'good', text: '活動能量已達基本目標，不需要為了湊數字再做長時間運動。' })
  }
  if ((current.intakeKcal ?? 0) > settings.intakeKcalMaximum) advice.push({ level: 'warn', text: '攝取較高，先檢查油、醬料、泡麵麵體與零食；不需要用懲罰性運動抵銷。' })
  if ((current.proteinG ?? 0) < settings.proteinMinimumG) advice.push({ level: 'near', text: '蛋白質可從雞胸肉、魚、蛋、Skyr、Magerquark 或無糖豆漿補足。' })
  if ((current.waterMl ?? 0) < settings.waterMinimumMl) advice.push({ level: 'near', text: '白開水尚未達標，請分次補水，不要短時間大量灌水。' })

  if (previous && (dailyDeficit(previous) ?? 0) > 1000 && (dailyDeficit(current) ?? 0) > 1000) {
    advice.push({ level: 'warn', text: '已連續兩天推估赤字超過 1000 kcal，建議增加 100–200 kcal 攝取或降低運動。' })
  }

  const recentBowel = ordered.slice(-3)
  const noBowel = recentBowel.filter((log) => log.bowelMovement !== 'yes').length
  const hardStool = ordered.slice(-2).length === 2 && ordered.slice(-2).every((log) => (log.bristolType ?? 7) <= 2)
  if (noBowel >= 3) advice.push({ level: 'warn', text: '已三天未排便，建議向藥師或醫師諮詢。若有劇烈腹痛、嘔吐、腹脹或血便，請就醫；本 App 不作診斷。' })
  else if (noBowel >= 2 || hardStool) advice.push({ level: 'near', text: '留意排便：維持飲水、蔬菜、奇亞籽與活動，不要為體重數字減少喝水或使用瀉藥。' })

  const morning = ordered.filter((log) => log.weightCondition === 'morning_fasted' && log.weightKg != null)
  const trends = movingAverage(morning.map((log) => log.weightKg), 3)
  const trend = trends.at(-1)
  if (trend != null && morning.length >= 3) {
    const threeDaysAgo = trends.at(-3)
    if (threeDaysAgo != null && threeDaysAgo - trend > 1) advice.push({ level: 'near', text: '3 日趨勢下降超過 1 kg，多數可能包含水分，不要繼續降低熱量。' })
    const completion = average(ordered.slice(-3).map((log) => {
      const intakeOk = (log.intakeKcal ?? -1) >= settings.intakeKcalMinimum && (log.intakeKcal ?? Infinity) <= settings.intakeKcalMaximum
      const activityOk = (log.activeKcal ?? 0) >= settings.activeKcalMinimum
      return intakeOk && activityOk ? 100 : intakeOk || activityOk ? 50 : 0
    })) ?? 0
    if (trend > targetWeightForDate(current.date, settings) + 0.3 && completion >= 80) {
      advice.push({ level: 'near', text: '趨勢略高於目標且執行穩定：只調整一項——每日減少約 100 kcal。' })
    }
  }
  return advice.slice(0, 4)
}
