// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GrowthAchievementView,
  GrowthCompanionView,
  GrowthHabitatView,
  GrowthMissionView,
  GrowthXpBreakdownView
} from '../components/growth'
import { GrowthPage } from './GrowthPage'

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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
    rewarded: false,
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
    xpReward: 10,
    rewarded: false
  },
  {
    id: 'mission-recovery',
    title: '採用恢復替代',
    description: '今天不要求補做活動。',
    category: 'recovery',
    progress: 1,
    target: 1,
    status: 'completed',
    xpReward: 10,
    rewarded: true
  },
  {
    id: 'mission-over-limit',
    title: '不應出現的第四項任務',
    category: 'activity',
    progress: 0,
    target: 1,
    status: 'available',
    xpReward: 10,
    rewarded: false
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

const xpEntries: GrowthXpBreakdownView['entries'] = [
  ...Array.from({ length: 31 }, (_, index) => ({
    id: `daily-${index}`,
    taskId: `daily-task-${index}`,
    cadence: 'daily' as const,
    periodKey: `2026-08-${String(Math.max(1, 11 - Math.floor(index / 3))).padStart(2, '0')}`,
    xp: 10,
    category: 'awareness' as const,
    affinityDelta: 1,
    creditedAt: '2026-08-11T08:00:00.000Z',
    title: index === 0 ? '完成今日結算' : '完成生活紀錄',
    metric: 'daily_finalized',
    missionStatus: 'completed' as const,
    attribution: 'mission' as const
  })),
  {
    id: 'weekly-1',
    taskId: 'weekly-task-1',
    cadence: 'weekly',
    periodKey: '2026-08-10',
    xp: 20,
    category: 'recovery',
    affinityDelta: 2,
    creditedAt: '2026-08-11T08:00:00.000Z',
    title: '完成本週恢復節奏',
    metric: 'weekly_recovery',
    missionStatus: 'completed',
    attribution: 'mission'
  }
]

const xpBreakdown: GrowthXpBreakdownView = {
  displayedXp: 330,
  attributedXp: 330,
  residualXp: 0,
  integrity: 'exact',
  daily: { count: 31, xp: 310 },
  weekly: { count: 1, xp: 20 },
  todayPeriodXp: 10,
  byCategory: {
    awareness: { count: 31, xp: 310 },
    nourishment: { count: 0, xp: 0 },
    activity: { count: 0, xp: 0 },
    recovery: { count: 1, xp: 20 }
  },
  entries: xpEntries
}

describe('GrowthPage', () => {
  it('shows the approved star-tide habitat in the main companion player', () => {
    const stageThreeCompanion: GrowthCompanionView = {
      ...companion,
      xp: 160,
      growthNode: 3
    }
    const { container } = render(<GrowthPage
      companion={stageThreeCompanion}
      missions={missions}
      xpBreakdown={{ ...xpBreakdown, displayedXp: 160 }}
      achievements={achievements}
      habitat={habitat}
    />)

    const player = screen.getByRole('img', { name: /潤光目前型態/ })
    expect(player.getAttribute('data-growth-scene-composition')).toBe('embedded_habitat')
    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src)
      .toContain('luminous-stage-03-idle-primary-habitat-poster-v1.webp')
    expect(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')?.src)
      .toContain('luminous-stage-03-idle-primary-50fps-v1.mp4')
    expect(container.querySelectorAll('.growth-stage-animation__habitat')).toHaveLength(0)
  })

  it('resolves the approved stage-six runtime through the main player wiring', () => {
    const stageSixCompanion: GrowthCompanionView = {
      ...companion,
      xp: 640,
      growthNode: 6
    }
    const { container } = render(<GrowthPage
      companion={stageSixCompanion}
      missions={missions}
      xpBreakdown={{ ...xpBreakdown, displayedXp: 640 }}
      achievements={achievements}
      habitat={habitat}
    />)

    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src)
      .toContain('luminous-stage-06-idle-primary-habitat-poster-v3.webp')
    expect(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')?.src)
      .toContain('luminous-stage-06-idle-primary-50fps-v3.mp4')
    expect(container.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(14)
  })

  it('resolves the approved stage-five runtime through the main player wiring', () => {
    const stageFiveCompanion: GrowthCompanionView = {
      ...companion,
      xp: 460,
      growthNode: 5
    }
    const { container } = render(<GrowthPage
      companion={stageFiveCompanion}
      missions={missions}
      xpBreakdown={{ ...xpBreakdown, displayedXp: 460 }}
      achievements={achievements}
      habitat={habitat}
    />)

    expect(container.querySelector<HTMLImageElement>('.growth-stage-animation__poster')?.src)
      .toContain('luminous-stage-05-idle-primary-habitat-poster-v4.webp')
    expect(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')?.src)
      .toContain('luminous-stage-05-idle-primary-50fps-v4.mp4')
    expect(container.querySelectorAll('.growth-ambient-stars__particle')).toHaveLength(14)
  })

  it('keeps the hero concise and opens the complete 12-stage journey in a sheet', async () => {
    const user = userEvent.setup()
    const { container } = render(<GrowthPage
      companion={companion}
      missions={missions}
      xpBreakdown={xpBreakdown}
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
    expect(fallbackImage?.src).toContain('luminous-stage-04-idle-primary-habitat-poster-v1.webp')
    expect(container.querySelector<HTMLVideoElement>('.growth-stage-animation__video')?.src)
      .toContain('luminous-stage-04-idle-primary-50fps-v1.mp4')
    expect(container.querySelectorAll('.growth-stage-animation__habitat')).toHaveLength(0)
    expect(screen.queryAllByText('浮珠')).toHaveLength(0)

    await user.click(screen.getByRole('tab', { name: /旅程/ }))
    await user.click(screen.getByRole('button', { name: /查看完整階段與親和力/ }))
    const journeyDialog = screen.getByRole('dialog', { name: '十二階與四印記' })
    expect(journeyDialog).toBeTruthy()
    expect(journeyDialog.querySelectorAll('.growth-node-rail__item')).toHaveLength(12)
    expect(journeyDialog.querySelector('.growth-node-rail__item--current')?.textContent).toContain('Lv4')
    expect(screen.getByText('四種親和力')).toBeTruthy()
  })

  it('shows one section at a time and opens collection content in separate sheets', async () => {
    const user = userEvent.setup()
    const onOpenMission = vi.fn()
    const onOpenCompendium = vi.fn()
    render(<GrowthPage
      companion={companion}
      missions={missions}
      xpBreakdown={xpBreakdown}
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

    expect(screen.queryByRole('region', { name: '成就牆' })).toBeNull()
    await user.click(screen.getByRole('tab', { name: /收藏/ }))
    await user.click(screen.getByRole('button', { name: /成就牆/ }))
    expect(screen.getByRole('region', { name: '成就牆' }).textContent).toContain('第一次週回顧')
    expect(document.querySelector<HTMLImageElement>('.growth-achievement-card__art img')?.src).toContain('art/growth/achievements/first_weekly_review.webp')
    expect(document.querySelector('.growth-achievement-card__art svg')).toBeNull()

    await user.click(screen.getByRole('button', { name: '關閉成就牆・1/2' }))
    await user.click(screen.getByRole('button', { name: /泉眼棲境/ }))
    expect(screen.getByRole('region', { name: '棲境居民' }).textContent).toContain('晨露珠')
    expect(screen.getByRole('region', { name: '收藏圖鑑' }).textContent).toContain('尚未發現')
    await user.click(screen.getByRole('button', { name: '查看完整圖鑑' }))
    expect(onOpenCompendium).toHaveBeenCalledTimes(1)
  })

  it('explains the exact XP total, shows paged entries and restores focus when the sheet closes', async () => {
    const user = userEvent.setup()
    render(<GrowthPage companion={companion} missions={missions} xpBreakdown={xpBreakdown} achievements={achievements} habitat={habitat} />)

    const xpButton = screen.getByRole('button', { name: /330 XP.*查看來源/ })
    await user.click(xpButton)
    const dialog = screen.getByRole('dialog', { name: '你的 XP 從哪裡來？' })
    expect(within(dialog).getByText('31 筆・310 XP')).toBeTruthy()
    expect(within(dialog).getByText('1 筆・20 XP')).toBeTruthy()
    expect(within(dialog).getByText('這 330 XP 都能對應到下方任務明細。')).toBeTruthy()
    expect(within(dialog).getByText('成就只解鎖收藏，不另外增加 XP；體重下降、極低熱量與超額運動都不會加成。')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '再顯示 12 筆' })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '你的 XP 從哪裡來？' })).toBeNull()
    expect(document.activeElement).toBe(xpButton)
  })

  it('supports arrow-key navigation between the three sections', async () => {
    const user = userEvent.setup()
    render(<GrowthPage companion={companion} missions={missions} xpBreakdown={xpBreakdown} achievements={achievements} habitat={habitat} />)

    const missionTab = screen.getByRole('tab', { name: /任務/ })
    missionTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /旅程/ }).getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /收藏/ }).getAttribute('aria-selected')).toBe('true')
  })
})
