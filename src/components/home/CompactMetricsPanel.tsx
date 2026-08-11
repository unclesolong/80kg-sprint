import type { TodayDashboardModel } from '../../viewModels/todayDashboard'

const rounded = (value: number) => Math.round(value).toLocaleString('zh-TW')

export function CompactMetricsPanel({ model }: { model: TodayDashboardModel }) {
  const calorieGuidance = model.targets.guidance.calories
  const activityGuidance = model.targets.guidance.activity
  const waterGuidance = model.targets.guidance.water
  const caloriesOver = model.calories.overMaximumKcal > 0
  const dinnerLogged = model.dinner.eatenKcal > 0
  const metrics = [
    {
      key: 'calories',
      label: calorieGuidance ? '今天還可吃' : '今日已記錄',
      value: calorieGuidance
        ? caloriesOver ? `超出 ${rounded(model.calories.overMaximumKcal)}` : rounded(model.calories.remainingToMaximumKcal)
        : rounded(model.calories.consumedKcal),
      unit: 'kcal',
      note: calorieGuidance
        ? caloriesOver ? '仍可正常安排下一餐，不需要用懲罰性運動抵銷' : `計畫上限 ${rounded(model.calories.maximumKcal)} kcal`
        : '純記錄模式；建立計畫後顯示參考範圍',
      className: calorieGuidance ? caloriesOver ? 'is-over' : model.calories.remainingToMaximumKcal <= 200 ? 'is-near' : '' : ''
    },
    {
      key: 'dinner',
      label: calorieGuidance ? dinnerLogged ? '晚餐' : '下一餐參考' : '下一餐參考',
      value: calorieGuidance ? dinnerLogged ? `${rounded(model.dinner.eatenKcal)}／${rounded(model.dinner.budgetKcal)}` : rounded(model.dinner.budgetKcal) : '尚未設定',
      unit: calorieGuidance ? 'kcal' : '',
      note: !calorieGuidance
        ? '完成計畫後才會產生個人化建議'
        : dinnerLogged
        ? model.dinner.overKcal > 0 ? `超出 ${rounded(model.dinner.overKcal)} kcal` : `還有 ${rounded(model.dinner.remainingKcal)} kcal 空間`
        : '依今日其他餐點與預留項目計算',
      className: calorieGuidance && model.dinner.overKcal > 0 ? 'is-over' : ''
    },
    {
      key: 'activity',
      label: activityGuidance ? '活動還差' : '活動能量',
      value: activityGuidance
        ? model.activity.basicGoalReached ? '已達基本目標' : rounded(model.activity.remainingToMinimumKcal)
        : model.activity.effectiveKcal == null ? '尚未記錄' : rounded(model.activity.effectiveKcal),
      unit: activityGuidance ? model.activity.basicGoalReached ? '' : 'kcal' : model.activity.effectiveKcal == null ? '' : 'kcal',
      note: activityGuidance
        ? model.activity.effectiveKcal == null ? '可從穿戴裝置或其他來源填入' : `目前 ${rounded(model.activity.effectiveKcal)}／${rounded(model.activity.minimumKcal)} kcal`
        : '純記錄模式；不追活動目標',
      className: model.activity.basicGoalReached ? 'is-complete' : ''
    },
    {
      key: 'water',
      label: waterGuidance ? '白水還差' : '今日飲水',
      value: waterGuidance ? model.water.remainingMl === 0 ? '已達目標' : rounded(model.water.remainingMl) : rounded(model.water.currentMl),
      unit: waterGuidance && model.water.remainingMl === 0 ? '' : 'ml',
      note: waterGuidance ? `目前 ${rounded(model.water.currentMl)}／${rounded(model.water.targetMl)} ml` : '純記錄模式；尚未設定目標',
      className: waterGuidance && model.water.remainingMl === 0 ? 'is-complete' : 'is-info'
    }
  ]

  return <section className="v6-compact-metrics standard-card" aria-label="今日可用資源">
    {metrics.map((metric) => <article className={`v6-compact-metric ${metric.className}`} key={metric.key}>
      <span>{metric.label}</span>
      <strong>{metric.value}{metric.unit && <small>{metric.unit}</small>}</strong>
      <p>{metric.note}</p>
    </article>)}
  </section>
}
