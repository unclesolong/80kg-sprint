import { useState } from 'react'
import { CalendarDays, CheckCircle2, History, Sparkles } from 'lucide-react'
import {
  DAILY_MISSION_XP,
  MAX_DAILY_REWARDS,
  MAX_WEEKLY_REWARDS,
  WEEKLY_MISSION_XP
} from '../../growth/engine'
import {
  GROWTH_AFFINITIES,
  GROWTH_AFFINITY_DEFINITIONS,
  type GrowthXpBreakdownView,
  type GrowthXpEntryView
} from './types'

const INITIAL_ENTRY_LIMIT = 20

const formatPeriod = (entry: GrowthXpEntryView): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.periodKey)
  const date = match ? `${Number(match[2])}/${Number(match[3])}` : entry.periodKey
  return entry.cadence === 'weekly' ? `${date} 起的一週` : `${date} 紀錄`
}

export interface GrowthXpBreakdownProps {
  breakdown: GrowthXpBreakdownView
}

export function GrowthXpBreakdown({ breakdown }: GrowthXpBreakdownProps) {
  const [entryLimit, setEntryLimit] = useState(INITIAL_ENTRY_LIMIT)
  const visibleEntries = breakdown.entries.slice(0, entryLimit)
  const remainingEntries = breakdown.entries.length - visibleEntries.length

  return <div className="growth-xp-breakdown">
    <section className="growth-xp-summary" aria-label="XP 來源摘要">
      <div className="growth-xp-summary__total">
        <span>目前累積</span>
        <strong>{breakdown.displayedXp.toLocaleString('zh-TW')} XP</strong>
      </div>
      <dl>
        <div><dt>每日任務</dt><dd>{breakdown.daily.count} 筆・{breakdown.daily.xp.toLocaleString('zh-TW')} XP</dd></div>
        <div><dt>每週任務</dt><dd>{breakdown.weekly.count} 筆・{breakdown.weekly.xp.toLocaleString('zh-TW')} XP</dd></div>
        <div><dt>今日紀錄</dt><dd>+{breakdown.todayPeriodXp.toLocaleString('zh-TW')} XP</dd></div>
      </dl>
      {breakdown.integrity === 'exact'
        ? <p className="growth-xp-summary__explanation"><CheckCircle2 aria-hidden="true" />這 {breakdown.displayedXp.toLocaleString('zh-TW')} XP 都能對應到下方任務明細。</p>
        : breakdown.integrity === 'residual'
          ? <p className="growth-xp-summary__notice"><History aria-hidden="true" />另有 {breakdown.residualXp.toLocaleString('zh-TW')} XP 來自較早版本或匯入進度，現有資料沒有逐筆任務名稱。</p>
          : <p className="growth-xp-summary__notice"><History aria-hidden="true" />任務明細曾經過修正或匯入；畫面以目前累積 XP 為準。</p>}
    </section>

    <section className="growth-xp-rules" aria-labelledby="growth-xp-rules-title">
      <h3 id="growth-xp-rules-title">XP 怎麼獲得？</h3>
      <ul>
        <li><span>每日</span><strong>完成一項 +{DAILY_MISSION_XP} XP</strong><small>每天最多 {MAX_DAILY_REWARDS} 項</small></li>
        <li><span>每週</span><strong>完成一項 +{WEEKLY_MISSION_XP} XP</strong><small>每週最多 {MAX_WEEKLY_REWARDS} 項</small></li>
        <li><span>安全</span><strong>恢復任務等值</strong><small>未完成不扣分、不歸零</small></li>
      </ul>
      <p>成就只解鎖收藏，不另外增加 XP；體重下降、極低熱量與超額運動都不會加成。</p>
      <p>第一次開啟培育功能時，系統會依最近 14 天可確認的既有紀錄補發，所以起始 XP 可能不是 0。</p>
    </section>

    <section className="growth-xp-affinities" aria-labelledby="growth-xp-affinities-title">
      <h3 id="growth-xp-affinities-title">XP 來自哪些任務？</h3>
      <dl>
        {GROWTH_AFFINITIES.map((affinity) => <div key={affinity}>
          <dt>{GROWTH_AFFINITY_DEFINITIONS[affinity].label}</dt>
          <dd>{breakdown.byCategory[affinity].xp.toLocaleString('zh-TW')} XP</dd>
        </div>)}
      </dl>
    </section>

    <section className="growth-xp-history" aria-labelledby="growth-xp-history-title">
      <header><div><h3 id="growth-xp-history-title">逐筆 XP 明細</h3><p>依任務所屬日期排列；補登也會放回原日期。</p></div><span>{breakdown.entries.length} 筆</span></header>
      {visibleEntries.length === 0
        ? <p className="growth-section__empty">目前尚無可列出的任務明細。</p>
        : <ol>
            {visibleEntries.map((entry) => <li key={entry.id}>
              <span className={`growth-xp-history__icon growth-xp-history__icon--${entry.category}`} aria-hidden="true"><Sparkles /></span>
              <span className="growth-xp-history__copy">
                <strong>{entry.title}</strong>
                <small><CalendarDays aria-hidden="true" />{formatPeriod(entry)}・{entry.cadence === 'weekly' ? '每週任務' : '每日任務'}{entry.attribution === 'orphan' ? '・舊任務資料' : ''}</small>
              </span>
              <b>+{entry.xp} XP</b>
            </li>)}
          </ol>}
      {remainingEntries > 0 && <button className="growth-xp-history__more growth-touch-target" type="button" onClick={() => setEntryLimit((current) => current + INITIAL_ENTRY_LIMIT)}>再顯示 {Math.min(INITIAL_ENTRY_LIMIT, remainingEntries)} 筆</button>}
    </section>
  </div>
}
