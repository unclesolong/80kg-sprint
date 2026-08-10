import { Check, Moon, Scale, Utensils } from 'lucide-react'
import type { RecordStage } from '../../types'
import type { TodayStageModel } from '../../viewModels/todayDashboard'

const icons = { morning: Scale, food: Utensils, evening: Moon }
const labels = { done: '已完成', current: '進行中', pending: '未開始' }

export function DailyStageRail({ stages, onOpen }: {
  stages: TodayStageModel[]
  onOpen: (stage: RecordStage) => void
}) {
  return <nav className="v6-stage-rail daily-flow flat-section" aria-label="今日三階段">
    {stages.map((stage) => {
      const Icon = icons[stage.id]
      return <button type="button" className={`v6-stage-step ${stage.status === 'done' ? 'done is-done' : stage.status === 'current' ? 'active is-current' : 'is-pending'}`} aria-current={stage.status === 'current' ? 'step' : undefined} onClick={() => onOpen(stage.id)} key={stage.id}>
        <span className="flow-icon">{stage.status === 'done' ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}</span>
        <strong>{stage.label}</strong>
        <small>{labels[stage.status]} · {stage.note}</small>
      </button>
    })}
  </nav>
}
