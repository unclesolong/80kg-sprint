import { CheckCircle2, Sparkles } from 'lucide-react'
import {
  GROWTH_AFFINITY_DEFINITIONS,
  type GrowthAffinity,
  type GrowthImprintChoiceView
} from './types'

export interface ImprintChoiceProps {
  choice: GrowthImprintChoiceView
  onSelect?: (affinity: GrowthAffinity) => void
  onConfirm?: (affinity: GrowthAffinity) => void
}
export function ImprintChoice({ choice, onSelect, onConfirm }: ImprintChoiceProps) {
  const imprintOrdinal = choice.milestone === 4 ? '第一' : '第二'
  const recommendations = choice.recommendations.slice(0, 2)

  return <section className="growth-section growth-imprint-choice standard-card" aria-labelledby="growth-imprint-title">
    <header className="growth-section__header">
      <div><p className="eyebrow">LV{choice.milestone} MILESTONE</p><h2 id="growth-imprint-title">選擇{imprintOrdinal}印記</h2></div>
      <Sparkles aria-hidden="true" />
    </header>

    {choice.confirmed
      ? <div className="growth-imprint-choice__confirmed" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div><strong>已選擇 {GROWTH_AFFINITY_DEFINITIONS[choice.confirmed].imprintName}</strong><p>印記已保存；它只改變潤光的外觀與故事。</p></div>
        </div>
      : <>
          <p>系統依這一章取得的親和力推薦兩個方向，最後選擇由你決定。接近同分時不會自動替你分支。</p>
          <div className="growth-imprint-choice__options" role="group" aria-label={`${imprintOrdinal}印記候選`}>
            {recommendations.map((recommendation, index) => {
              const definition = GROWTH_AFFINITY_DEFINITIONS[recommendation.affinity]
              const selected = choice.selected === recommendation.affinity
              return <button
                className={`growth-touch-target growth-imprint-option ${selected ? 'growth-imprint-option--selected' : ''}`.trim()}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect?.(recommendation.affinity)}
                key={recommendation.affinity}
              >
                <span>{index === 0 ? '主要推薦' : '同樣適合'} · {definition.label}</span>
                <strong>{definition.imprintName}</strong>
                <small>{recommendation.reason ?? definition.description}</small>
                <b>{recommendation.score} 親和</b>
              </button>
            })}
          </div>
          <button
            className="primary growth-touch-target growth-imprint-choice__confirm"
            type="button"
            disabled={!choice.selected || !onConfirm}
            onClick={() => { if (choice.selected) onConfirm?.(choice.selected) }}
          >確認{imprintOrdinal}印記{choice.selected ? `：${GROWTH_AFFINITY_DEFINITIONS[choice.selected].imprintName}` : ''}</button>
          <small className="growth-imprint-choice__note">成熟後每月可免費重新調律一次；舊型態會保留在圖鑑。</small>
        </>}
  </section>
}
