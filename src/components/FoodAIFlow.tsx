import { useMemo, useRef, useState } from 'react'
import { Bot, Plus, Search } from 'lucide-react'
import { AIConsentDialog } from './planner/AIConsentDialog'
import { candidatesFromMetadata } from '../foodData/confirmedCache'
import type { FoodCandidate, FoodWeightState } from '../foodData/types'
import type { FoodMetadata } from '../planner/types'
import { createAIClient } from '../services/aiClient'
import type { ParsedFoodItem } from '../services/aiSchemas'
import { createFoodClient } from '../services/foodClient'
import type { MealLine } from '../types'

const sourceLabels: Record<FoodCandidate['source'], string> = { local: '本地資料', bls: 'BLS 開放資料', usda: 'USDA', open_food_facts: 'Open Food Facts', manual: '手動', ai_estimate: 'AI 估算' }
const basisLabels: Record<FoodCandidate['basis'], string> = { '100g': '每 100 g', '100ml': '每 100 ml', serving: '每份' }
const completenessLabels: Record<FoodCandidate['completeness'], string> = { complete: '完整營養', partial: '部分營養', calorie_protein_only: '熱量＋蛋白', estimated: '估算' }
const display = (value: number | undefined, unit: string, digits = 1) => value == null ? '—' : `${value.toLocaleString('zh-TW', { maximumFractionDigits: digits })} ${unit}`

const candidateLine = (candidate: FoodCandidate, amount: number, brand: string, proteinOverride?: number): MealLine => {
  const divider = candidate.basis === 'serving' ? 1 : 100
  const unit = candidate.basis === '100g' ? 'g' : candidate.basis === '100ml' ? 'ml' : '份'
  return {
    key: `provider-${candidate.source}-${crypto.randomUUID()}`,
    label: [brand.trim(), candidate.name].filter(Boolean).join(' · '),
    amount,
    unit,
    portionLabel: candidate.basis === 'serving' ? '份' : undefined,
    kcalPerUnit: candidate.kcal / divider,
    proteinPerUnit: (candidate.proteinG ?? proteinOverride as number) / divider,
    carbsPerUnit: candidate.carbsG == null ? undefined : candidate.carbsG / divider,
    fatPerUnit: candidate.fatG == null ? undefined : candidate.fatG / divider,
    fiberPerUnit: candidate.fiberG == null ? undefined : candidate.fiberG / divider,
    sodiumPerUnit: candidate.sodiumMg == null ? undefined : candidate.sodiumMg / divider
  }
}

export function FoodAIFlow({ online, aiEnabled, metadata, onEnableAI, onAIRun, onAdd, onManual }: {
  online: boolean
  aiEnabled: boolean
  metadata: FoodMetadata[]
  onEnableAI: () => Promise<void>
  onAIRun: (status: 'success' | 'fallback' | 'error', errorCode?: string) => void
  onAdd: (line: MealLine, candidate: FoodCandidate, confirmation: { brand?: string; weightState: FoodWeightState; preparation?: string }) => void
  onManual: () => void
}) {
  const cached = useMemo(() => candidatesFromMetadata(metadata), [metadata])
  const aiConsentRef = useRef(aiEnabled)
  aiConsentRef.current = aiEnabled
  const aiClient = useMemo(() => createAIClient({ hasConsent: () => aiConsentRef.current }), [])
  const foodClient = useMemo(() => createFoodClient({ hasConsent: () => aiConsentRef.current }), [])
  const [text, setText] = useState('')
  const [items, setItems] = useState<ParsedFoodItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [candidates, setCandidates] = useState<FoodCandidate[]>([])
  const [selected, setSelected] = useState<FoodCandidate>()
  const [amount, setAmount] = useState(100)
  const [brand, setBrand] = useState('')
  const [weightState, setWeightState] = useState<FoodWeightState>('unknown')
  const [proteinOverride, setProteinOverride] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showConsent, setShowConsent] = useState(false)

  const active = items[activeIndex]
  const configured = aiClient.configured && foodClient.configured
  const visibleCandidates = candidates.length ? candidates : (!online || !configured) ? cached.slice(0, 5) : []

  const searchItem = async (item: ParsedFoodItem, index: number) => {
    setActiveIndex(index); setSelected(undefined); setCandidates([]); setBusy(true); setMessage('正在搜尋可信食物資料…')
    const queryText = item.searchTerms[0] || item.normalizedName
    const result = await foodClient.search({ text: queryText, weightState: item.weightState, limit: 5 }, cached)
    const next = result.ok ? result.data : result.fallback ?? []
    setCandidates(next.slice(0, 5))
    setAmount(item.amount && item.amount > 0 ? item.amount : next[0]?.basis === 'serving' ? 1 : 100)
    setWeightState(item.weightState)
    setBrand(item.brand ?? '')
    setMessage(next.length ? (result.ok ? '請選擇資料來源，再確認份量、生熟與品牌。' : '外部來源暫時不可用，以下是已確認的離線候選。') : '找不到安全可用的候選；文字已保留，可重試或改用手動新增。')
    setBusy(false)
  }

  const parse = async () => {
    const normalized = text.trim()
    if (!normalized || busy) return
    setBusy(true); setItems([]); setCandidates([]); setSelected(undefined); setMessage('AI 只解析名稱、份量與生熟語意，不會估算營養。')
    const result = await aiClient.parseFood(normalized)
    if (!result.ok) {
      setMessage(`${result.error.message} 文字已保留，可重試或改用手動新增。`)
      onAIRun('fallback', result.error.code)
      setBusy(false)
      return
    }
    setItems(result.data.items)
    setMessage(result.data.items.length ? '解析完成；請逐項搜尋並確認資料來源。' : '沒有解析出可搜尋的食物；請修改文字或手動新增。')
    onAIRun('success')
    setBusy(false)
    if (result.data.items[0]) void searchItem(result.data.items[0], 0)
  }

  const startParse = () => {
    if (!aiEnabled) { setShowConsent(true); return }
    void parse()
  }

  const acceptConsent = async () => {
    setBusy(true)
    try { await onEnableAI(); aiConsentRef.current = true; setShowConsent(false); setBusy(false); window.setTimeout(() => void parse(), 0) }
    catch { setBusy(false); setMessage('AI 設定無法儲存；本地與手動新增仍可使用。') }
  }

  const selectCandidate = (candidate: FoodCandidate) => {
    setSelected(candidate)
    setAmount(active?.amount && active.amount > 0 ? active.amount : candidate.basis === 'serving' ? 1 : 100)
    setBrand(active?.brand ?? candidate.brand ?? '')
    setWeightState(active?.weightState ?? candidate.weightState ?? 'unknown')
    setProteinOverride('')
  }

  const addCandidate = () => {
    if (!selected || amount <= 0) return
    const protein = selected.proteinG ?? (proteinOverride === '' ? undefined : Number(proteinOverride))
    if (protein == null || !Number.isFinite(protein) || protein < 0) { setMessage('這個來源沒有蛋白質資料；請先輸入包裝或資料表上的蛋白質，未知值不會被當成 0。'); return }
    const confirmed: FoodCandidate = { ...selected, brand: brand.trim() || undefined, weightState, proteinG: protein, preparation: active?.preparation ?? selected.preparation }
    onAdd(candidateLine(confirmed, amount, brand, protein), confirmed, { brand: brand.trim() || undefined, weightState, preparation: active?.preparation ?? undefined })
    setMessage(`已把「${confirmed.name}」加入本次草稿；最後按儲存才會寫入紀錄。`)
    setSelected(undefined)
  }

  return <section className="food-ai-flow" aria-labelledby="food-ai-title">
    <div className="food-ai-intro"><Bot aria-hidden="true" /><div><h3 id="food-ai-title">用一句話拆解餐點</h3><p>AI 只解析語意；熱量與營養一定來自你確認的資料來源。</p></div></div>
    <label className="food-ai-text">描述吃了什麼<textarea rows={3} maxLength={500} placeholder="例如：午餐吃 180g 熟雞胸、半碗白飯和一顆蛋" value={text} onChange={(event) => setText(event.target.value)} /></label>
    <div className="food-ai-actions"><button type="button" className="primary" disabled={!text.trim() || busy || !online || !configured} onClick={startParse}><Search />{busy ? '處理中…' : !configured ? 'AI 尚未設定' : !online ? '離線時不可用' : '解析並搜尋'}</button><button type="button" onClick={onManual}>改用手動新增</button></div>
    {message && <p className="ai-status-message" role="status" aria-live="polite">{message}</p>}
    {items.length > 0 && <div className="parsed-food-list" aria-label="AI 解析項目">{items.map((item, index) => <button type="button" className={activeIndex === index ? 'active' : ''} key={`${item.rawText}-${index}`} onClick={() => void searchItem(item, index)}><strong>{item.normalizedName}</strong><small>{item.amount == null ? '份量待確認' : `${item.amount} ${item.unit ?? ''}`} · {item.weightState === 'unknown' ? '生熟待確認' : item.weightState === 'raw' ? '生重' : '熟重'}</small>{item.confirmationQuestion && <span>{item.confirmationQuestion}</span>}</button>)}</div>}
    {visibleCandidates.length > 0 && <><h3 className="food-candidate-heading">{candidates.length ? '搜尋候選' : '已確認的離線食物'}</h3><div className="food-candidate-list" aria-label={candidates.length ? '食物資料候選' : '已確認的離線食物'}>{visibleCandidates.map((candidate) => <button type="button" className={selected?.source === candidate.source && selected.sourceId === candidate.sourceId ? 'selected' : ''} key={`${candidate.source}:${candidate.sourceId}`} onClick={() => selectCandidate(candidate)}><header><span>{sourceLabels[candidate.source]}</span><small>{completenessLabels[candidate.completeness]}</small></header><strong>{candidate.brand ? `${candidate.brand} · ` : ''}{candidate.name}</strong><p>{basisLabels[candidate.basis]} · {candidate.weightState === 'raw' ? '生重' : candidate.weightState === 'cooked' ? '熟重' : '生熟未標示'}</p><dl><div><dt>熱量</dt><dd>{display(candidate.kcal, 'kcal', 0)}</dd></div><div><dt>蛋白</dt><dd>{display(candidate.proteinG, 'g')}</dd></div><div><dt>碳水</dt><dd>{display(candidate.carbsG, 'g')}</dd></div><div><dt>脂肪</dt><dd>{display(candidate.fatG, 'g')}</dd></div><div><dt>纖維</dt><dd>{display(candidate.fiberG, 'g')}</dd></div><div><dt>鈉</dt><dd>{display(candidate.sodiumMg, 'mg', 0)}</dd></div></dl></button>)}</div></>}
    {selected && <div className="food-candidate-confirm health-card"><h3>確認後加入草稿</h3><div className="food-confirm-grid"><label>份量<input type="number" min="0.1" step={selected.basis === 'serving' ? 0.5 : 1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><small>{selected.basis === '100g' ? 'g' : selected.basis === '100ml' ? 'ml' : '份'}</small></label><label>生熟<select value={weightState} onChange={(event) => setWeightState(event.target.value as FoodWeightState)}><option value="unknown">未確認</option><option value="raw">生重</option><option value="cooked">熟重</option></select></label><label className="wide">品牌（選填）<input value={brand} onChange={(event) => setBrand(event.target.value)} /></label>{selected.proteinG == null && <label className="wide missing-nutrient">蛋白質（資料來源缺少，必填）<input type="number" min="0" inputMode="decimal" value={proteinOverride} onChange={(event) => setProteinOverride(event.target.value)} /><small>{basisLabels[selected.basis]}的克數；未知不會自動填 0。</small></label>}</div><button type="button" className="primary" onClick={addCandidate}><Plus />加入本次草稿</button></div>}
    {showConsent && <AIConsentDialog busy={busy} onDecline={() => setShowConsent(false)} onAccept={() => void acceptConsent()} />}
  </section>
}
