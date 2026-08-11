// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImprintChoice } from './ImprintChoice'
import type { GrowthImprintChoiceView } from './types'

afterEach(cleanup)

const choice: GrowthImprintChoiceView = {
  milestone: 4,
  recommendations: [
    { affinity: 'activity', score: 8, reason: '這一章完成較多活動節奏任務' },
    { affinity: 'recovery', score: 7, reason: '也穩定完成恢復與睡眠任務' }
  ]
}

describe('ImprintChoice', () => {
  it('keeps the recommendation as a user-confirmed choice', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(<ImprintChoice choice={choice} onSelect={onSelect} onConfirm={onConfirm} />)

    expect(screen.getByRole('button', { name: /疾潮/ }).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('button', { name: /確認第一印記/ }) as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: /^同樣適合.*月幕/ }))
    expect(onSelect).toHaveBeenCalledWith('recovery')
    expect(onConfirm).not.toHaveBeenCalled()

    rerender(<ImprintChoice choice={{ ...choice, selected: 'recovery' }} onSelect={onSelect} onConfirm={onConfirm} />)
    expect(screen.getByRole('button', { name: /^同樣適合.*月幕/ }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: '確認第一印記：月幕' }))
    expect(onConfirm).toHaveBeenCalledWith('recovery')
  })

  it('renders a saved Lv7 decision without offering another confirmation', () => {
    render(<ImprintChoice choice={{ ...choice, milestone: 7, confirmed: 'activity' }} />)

    expect(screen.getByRole('status').textContent).toContain('已選擇 疾潮')
    expect(screen.queryByRole('button', { name: /確認第二印記/ })).toBeNull()
  })
})
