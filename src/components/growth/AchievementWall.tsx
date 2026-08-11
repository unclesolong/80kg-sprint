import type { GrowthAchievementView } from './types'

const statusLabels = {
  locked: '尚未解鎖',
  earned: '已解鎖',
  equipped: '已裝備'
} as const

export interface AchievementWallProps {
  achievements: readonly GrowthAchievementView[]
  onOpenAchievement?: (achievementId: string) => void
}

export const getDefaultGrowthAchievementArtworkUrl = (achievementId: string) =>
  `${import.meta.env.BASE_URL}art/growth/achievements/${encodeURIComponent(achievementId)}.webp`

export function AchievementWall({ achievements, onOpenAchievement }: AchievementWallProps) {
  const earnedCount = achievements.filter((achievement) => achievement.status !== 'locked').length

  return <section className="growth-section growth-achievement-wall standard-card" aria-labelledby="growth-achievements-title">
    <header className="growth-section__header">
      <div><p className="eyebrow">COLLECTION</p><h2 id="growth-achievements-title">成就牆</h2></div>
      <span>{earnedCount}／{achievements.length}</span>
    </header>
    <p>成就解鎖收藏圖層，不提供健康數值加成，也不以體重或赤字排名。</p>

    {achievements.length === 0
      ? <p className="growth-section__empty">完成第一筆完整紀錄後，第一枚成就會出現在這裡。</p>
      : <ul className="growth-achievement-grid">
          {achievements.map((achievement) => {
            const artworkUrl = achievement.artworkUrl?.trim() || getDefaultGrowthAchievementArtworkUrl(achievement.id)
            const content = <>
              <span className="growth-achievement-card__art" aria-hidden="true">
                <img src={artworkUrl} alt="" loading="lazy" decoding="async" draggable={false} />
              </span>
              <span className="growth-achievement-card__copy">
                <strong>{achievement.title}</strong>
                <small>{achievement.description}</small>
                <b>{achievement.unlockedLabel ?? statusLabels[achievement.status]}</b>
              </span>
            </>
            return <li key={achievement.id}>
              {onOpenAchievement
                ? <button
                    className={`growth-touch-target growth-achievement-card growth-achievement-card--${achievement.status}`}
                    type="button"
                    onClick={() => onOpenAchievement(achievement.id)}
                    aria-label={`${achievement.title}，${statusLabels[achievement.status]}`}
                  >{content}</button>
                : <article className={`growth-achievement-card growth-achievement-card--${achievement.status}`}>{content}</article>}
            </li>
          })}
        </ul>}
  </section>
}
