import type { TodayDashboardModel } from '../../viewModels/todayDashboard'

const rounded = (value: number) => Math.round(value).toLocaleString('zh-TW')

export function CompactMetricsPanel({ model }: { model: TodayDashboardModel }) {
  const caloriesOver = model.calories.overMaximumKcal > 0
  const dinnerLogged = model.dinner.eatenKcal > 0
  const metrics = [
    {
      key: 'calories',
      label: '今天還可吃',
      value: caloriesOver ? `超出 ${rounded(model.calories.overMaximumKcal)}` : rounded(model.calories.remainingToMaximumKcal),
      unit: 'kcal',
      note: caloriesOver ? '晚餐仍正常吃，優先蛋白質與蔬菜' : `上限 ${rounded(model.calories.maximumKcal)} kcal`,
      className: caloriesOver ? 'is-over' : model.calories.remainingToMaximumKcal <= 200 ? 'is-near' : ''
    },
    {
      key: 'dinner',
      label: dinnerLogged ? '晚餐' : '今晚主餐預算',
      value: dinnerLogged ? `${rounded(model.dinner.eatenKcal)}／${rounded(model.dinner.budgetKcal)}` : rounded(model.dinner.budgetKcal),
      unit: 'kcal',
      note: dinnerLogged
        ? model.dinner.overKcal > 0 ? `超出 ${rounded(model.dinner.overKcal)} kcal` : `還有 ${rounded(model.dinner.remainingKcal)} kcal 空間`
        : '已扣早餐、午餐與晚間預留',
      className: model.dinner.overKcal > 0 ? 'is-over' : ''
    },
    {
      key: 'activity',
      label: '活動還差',
      value: model.activity.basicGoalReached ? '已達基本目標' : rounded(model.activity.remainingToMinimumKcal),
      unit: model.activity.basicGoalReached ? '' : 'kcal',
      note: model.activity.effectiveKcal == null ? '今晚抄入 Watch 活動能量' : `目前 ${rounded(model.activity.effectiveKcal)}／${rounded(model.activity.minimumKcal)} kcal`,
      className: model.activity.basicGoalReached ? 'is-complete' : ''
    },
    {
      key: 'water',
      label: '白水還差',
      value: model.water.remainingMl === 0 ? '已達目標' : rounded(model.water.remainingMl),
      unit: model.water.remainingMl === 0 ? '' : 'ml',
      note: `目前 ${rounded(model.water.currentMl)}／${rounded(model.water.targetMl)} ml`,
      className: model.water.remainingMl === 0 ? 'is-complete' : 'is-info'
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
