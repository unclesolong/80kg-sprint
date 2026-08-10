// @vitest-environment jsdom

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../defaults'
import { emptyOnboardingDraft, Onboarding, settingsFromOnboardingDraft } from './Onboarding'

afterEach(cleanup)

const validDraft = {
  baselineWeightKg: '82.4',
  heightCm: '178',
  targetWeightKg: '74.5',
  startDate: '2026-08-10',
  finalWeighInDate: '2026-11-10'
}

describe('Onboarding', () => {
  it('uses neutral branding, fields and actions without exposing legacy defaults', () => {
    const html = renderToStaticMarkup(createElement(Onboarding, {
      initial: defaultSettings,
      onComplete: vi.fn(),
      onImportBackup: vi.fn()
    }))

    expect(html).toContain('FAT LOSS JOURNAL')
    expect(html).toContain('減脂追蹤')
    expect(html).toContain('建立你的基本追蹤設定')
    expect(html).toContain('正式起始晨重')
    expect(html).toContain('目前目標體重')
    expect(html).toContain('開始追蹤日期')
    expect(html).toContain('階段檢視日期')
    expect(html).toContain('儲存基本設定並開始')
    expect(html).toContain('匯入既有 JSON 備份')
    expect(html).toContain('type="file"')
    expect(html).toContain('accept=".json,application/json"')
    expect(html).toContain('資料預設只儲存在此裝置。')
    expect(html).not.toContain('7 DAY RESET')
    expect(html).not.toContain('回到 80 公斤')
    expect(html).not.toContain('開始 7 天計畫')
    expect(html).not.toContain('value="80"')
    expect(html).not.toContain('value="81.1"')
    expect(html).not.toContain('value="2026-08-01"')
  })

  it('merges valid draft fields into a new ChallengeSettings object only on submit preparation', () => {
    const result = settingsFromOnboardingDraft(defaultSettings, validDraft)
    expect(result).toMatchObject({
      baselineWeightKg: 82.4,
      heightCm: 178,
      targetWeightKg: 74.5,
      startDate: '2026-08-10',
      finalWeighInDate: '2026-11-10',
      onboarded: true
    })
    expect(result).not.toBe(defaultSettings)
    expect(defaultSettings.targetWeightKg).toBe(80)
  })

  it('rejects incomplete or non-forward date ranges', () => {
    expect(settingsFromOnboardingDraft(defaultSettings, emptyOnboardingDraft())).toBeUndefined()
    expect(settingsFromOnboardingDraft(defaultSettings, {
      baselineWeightKg: '82.4',
      heightCm: '178',
      targetWeightKg: '74.5',
      startDate: '2026-08-10',
      finalWeighInDate: '2026-08-10'
    })).toBeUndefined()
  })

  it.each([
    ['a false result', vi.fn().mockResolvedValue(false)],
    ['a rejected save', vi.fn().mockRejectedValue(new Error('storage failed'))]
  ])('awaits %s, preserves the draft and reports that nothing was saved', async (_case, onComplete) => {
    render(createElement(Onboarding, { initial: defaultSettings, initialDraft: validDraft, onComplete }))
    fireEvent.click(screen.getByRole('button', { name: '儲存基本設定並開始' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('基本設定尚未儲存'))
    expect((screen.getByLabelText(/目前目標體重/) as HTMLInputElement).value).toBe('74.5')
  })

  it('passes the selected JSON File to the import callback and clears the input', async () => {
    const onImportBackup = vi.fn().mockResolvedValue(undefined)
    const { container } = render(createElement(Onboarding, {
      initial: defaultSettings,
      onComplete: vi.fn(),
      onImportBackup
    }))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onImportBackup).toHaveBeenCalledWith(file))
    await waitFor(() => expect(input.value).toBe(''))
  })
})
