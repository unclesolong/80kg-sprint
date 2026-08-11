import { Check, Clock3, Eye, MoonStar, Sprout, Wind } from 'lucide-react'
import {
  GROWTH_AFFINITY_DEFINITIONS,
  type GrowthAffinity,
  type GrowthMissionStatus,
  type GrowthMissionView
} from './types'

const affinityIcons = {
  awareness: Eye,
  nourishment: Sprout,
  activity: Wind,
  recovery: MoonStar
} satisfies Record<GrowthAffinity, typeof Eye>

const statusLabels: Readonly<Record<GrowthMissionStatus, string>> = {
  available: '可以開始',
  in_progress: '進行中',
  waiting_record: '等待紀錄',
  completed: '已完成',
  superseded: '已由恢復任務替代',
  expired: '已結束，不扣分'
}
export const MAX_DAILY_GROWTH_MISSIONS = 3

export interface TodayGrowthMissionsProps {
  missions: readonly GrowthMissionView[]
  onOpenMission?: (missionId: string) => void
}

export function TodayGrowthMissions({ missions, onOpenMission }: TodayGrowthMissionsProps) {
  const visibleMissions = missions.slice(0, MAX_DAILY_GROWTH_MISSIONS)
  const completedCount = visibleMissions.filter((mission) => mission.status === 'completed' || mission.status === 'superseded').length

  return <section className="growth-section growth-missions standard-card" aria-labelledby="growth-missions-title">
    <header className="growth-section__header">
      <div><p className="eyebrow">TODAY</p><h2 id="growth-missions-title">今日培育任務</h2></div>
      <span>{completedCount}／{visibleMissions.length} 完成</span>
    </header>

    {visibleMissions.length === 0
      ? <p className="growth-section__empty">今天沒有需要補做的任務。休息不會扣分，潤光也不會倒退。</p>
      : <ul className="growth-mission-list">
          {visibleMissions.map((mission) => {
            const affinity = GROWTH_AFFINITY_DEFINITIONS[mission.category]
            const Icon = mission.status === 'completed' ? Check : affinityIcons[mission.category]
            const progressMaximum = Math.max(1, mission.target)
            const progressValue = Math.min(progressMaximum, Math.max(0, mission.progress))
            const progressLabel = mission.progressLabel ?? `${progressValue}／${progressMaximum}`
            const rewardLabel = mission.rewarded
              ? `已獲得 +${mission.xpReward} XP`
              : mission.status === 'completed'
                ? '本期獎勵已達上限'
                : `完成可得 +${mission.xpReward} XP`
            return <li className={`growth-mission growth-mission--${mission.status}`} key={mission.id}>
              <div className="growth-mission__icon" aria-hidden="true"><Icon /></div>
              <div className="growth-mission__body">
                <div className="growth-mission__title"><strong>{mission.title}</strong><span>{statusLabels[mission.status]}</span></div>
                {mission.description && <p>{mission.description}</p>}
                <progress max={progressMaximum} value={progressValue} aria-label={`${mission.title}：${progressLabel}`}>{progressLabel}</progress>
                <div className="growth-mission__meta">
                  <span>{affinity.resourceName} · {rewardLabel}</span>
                  <span><Clock3 aria-hidden="true" />{progressLabel}</span>
                </div>
              </div>
              {onOpenMission && <button
                className="growth-touch-target growth-mission__action"
                type="button"
                onClick={() => onOpenMission(mission.id)}
                aria-label={`${mission.actionLabel ?? '查看任務'}：${mission.title}`}
              >{mission.actionLabel ?? '查看'}</button>}
            </li>
          })}
        </ul>}
    <p className="growth-missions__safety-note">任務未完成不扣分、不枯萎，也不會清空既有成長。</p>
  </section>
}
