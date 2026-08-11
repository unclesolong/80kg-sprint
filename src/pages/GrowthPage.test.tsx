// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  GrowthAchievementView,
  GrowthCompanionView,
  GrowthHabitatView,
  GrowthMissionView
} from '../components/growth'
import { GrowthPage } from './GrowthPage'

afterEach(cleanup)

const companion: GrowthCompanionView = {
  displayName: '潤光',
  xp: 330,
  growthNode: 4,
  affinities: { awareness: 6, nourishment: 4, activity: 8, recovery: 7 }
}

const missions: GrowthMissionView[] = [
  {
    id: 'mission-awareness',
    title: '完成晚間感受',
    description: '記下疲勞與飢餓感受。',
    category: 'awareness',
    progress: 0,
    target: 1,
    status: 'available',
    xpReward: 10,
    actionLabel: '去記錄'
  },
  {
    id: 'mission-water',
    title: '完成今日飲水節奏',
    category: 'nourishment',
    progress: 1_700,
    target: 2_500,
    progressLabel: '1,700／2,500 ml',
    status: 'in_progress',
    xpReward: 10
  },
  {
    id: 'mission-recovery',
    title: '採用恢復替代',
    description: '今天不要求補做活動。',
    category: 'recovery',
    progress: 1,
    target: 1,
    status: 'completed',
    xpReward: 10
  },
  {
    id: 'mission-over-limit',
    title: '不應出現的第四項任務',
    category: 'activity',
    progress: 0,
    target: 1,
    status: 'available',
    xpReward: 10
  }
]

const achievements: GrowthAchievementView[] = [
  {
    id: 'first_weekly_review',
    title: '第一次週回顧',
    description: '完成第一次每週整理。',
    category: 'resilience',
    status: 'earned'
  },
  {
    id: 'body_listened',
    title: '聽見身體',
    description: '在需要時完成恢復替代。',
    category: 'recovery',
    status: 'locked'
  }
]

const habitat: GrowthHabitatView = {
  name: '泉眼棲境',
  description: '任務完成後，棲境會留下收藏物與來訪居民。',
  residents: [
    { id: 'resident-pearl', name: '晨露珠', description: '完成覺察任務後來訪。', status: 'resident' },
    { id: 'resident-hidden', name: '未知居民', description: '還需要新的生活印記。', status: 'undiscovered' }
  ],
  collection: [
    { id: 'collection-ring', name: '第二環軌', description: '第一次週回顧收藏。', unlocked: true },
    { id: 'collection-hidden', name: '月光衛星滴', description: '完成相關成就後揭曉。', unlocked: false }
  ]
}

describe('GrowthPage', () => {
  it('renders the current luminous companion, all 12 nodes and its matching default stage artwork', () => {
    const { container } = render(<GrowthPage
      companion={companion}
      missions={missions}
      imprintChoice={{
        milestone: 4,
        recommendations: [
          { affinity: 'activity', score: 8 },
          { affinity: 'recovery', score: 7 }
        ]
      }}
      achievements={achievements}
      habitat={habitat}
    />)

    expect(screen.getByRole('heading', { name: '培育與成就' })).toBeTruthy()
    expect(screen.getByText('Lv4 · 潤團・萌翼')).toBeTruthy()
    expect(screen.getByRole('img', { name: '潤光目前型態：潤團・萌翼' })).toBeTruthy()
    const fallbackImage = container.querySelector<HTMLImageElement>('.growth-companion__artwork img')
    expect(fallbackImage?.src).toContain('art/growth/luminous-stage-04.webp')
    expect(container.querySelectorAll('.growth-node-rail__item')).toHaveLength(12)
    expect(container.querySelector('.growth-node-rail__item--current')?.textContent).toContain('Lv4')
  })

  it('caps today at three missions and exposes achievements, residents and compendium content', async () => {
    const user = userEvent.setup()
    const onOpenMission = vi.fn()
    const onOpenCompendium = vi.fn()
    render(<GrowthPage
      companion={companion}
      missions={missions}
      achievements={achievements}
      habitat={habitat}
      onOpenMission={onOpenMission}
      onOpenCompendium={onOpenCompendium}
    />)

    const missionRegion = screen.getByRole('region', { name: '今日培育任務' })
    expect(within(missionRegion).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText('不應出現的第四項任務')).toBeNull()
    expect(missionRegion.textContent).not.toContain('未達標')
    await user.click(screen.getByRole('button', { name: '去記錄：完成晚間感受' }))
    expect(onOpenMission).toHaveBeenCalledWith('mission-awareness')

    expect(screen.getByRole('region', { name: '成就牆' }).textContent).toContain('第一次週回顧')
    expect(document.querySelector<HTMLImageElement>('.growth-achievement-card__art img')?.src).toContain('art/growth/achievements/first_weekly_review.webp')
    expect(document.querySelector('.growth-achievement-card__art svg')).toBeNull()
    expect(screen.getByRole('region', { name: '棲境居民' }).textContent).toContain('晨露珠')
    expect(screen.getByRole('region', { name: '收藏圖鑑' }).textContent).toContain('尚未發現')
    await user.click(screen.getByRole('button', { name: '查看完整圖鑑' }))
    expect(onOpenCompendium).toHaveBeenCalledTimes(1)
  })
})
