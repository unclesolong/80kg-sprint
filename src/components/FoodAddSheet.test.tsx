// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { defaultFoodTemplates, emptyMealDetails } from '../defaults'
import type { MealDetails } from '../types'
import { FoodAddSheet } from './FoodAddSheet'

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

const baseProps = (overrides: Partial<React.ComponentProps<typeof FoodAddSheet>> = {}): React.ComponentProps<typeof FoodAddSheet> => ({
  open: true,
  date: '2026-08-10',
  logs: [],
  defaultMeal: 'lunch',
  details: emptyMealDetails(),
  templates: defaultFoodTemplates(),
  foods: [],
  online: false,
  aiEnabled: false,
  metadata: [],
  onEnableAI: vi.fn().mockResolvedValue(undefined),
  onAIRun: vi.fn(),
  onCommitMetadata: vi.fn().mockResolvedValue(undefined),
  onApply: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn(),
  ...overrides
})

const openCommonAndAddChicken = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '常用' }))
  await user.click(screen.getByRole('button', { name: /^雞肉.*建議/ }))
}

beforeEach(() => {
  document.body.innerHTML = '<div class="app-shell"></div>'
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FoodAddSheet batch draft interactions', () => {
  it('opens the real manual form without a competing search field and saves a four-digit calorie value', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(<FoodAddSheet {...baseProps({ initialTab: 'manual', onApply })} />)

    const nameInput = screen.getByPlaceholderText('例如：公司午餐') as HTMLInputElement
    await waitFor(() => expect(document.activeElement).toBe(nameInput))
    expect(screen.queryByLabelText('搜尋食物')).toBeNull()

    await user.type(nameInput, '自製雞肉捲')
    await user.type(screen.getByLabelText('熱量 kcal *'), '1250')
    await user.click(screen.getByRole('button', { name: '加入本次草稿' }))

    expect(screen.getByRole('button', { name: '儲存 1 項' })).toBeTruthy()
    expect(screen.getByText(/1250 kcal/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '儲存 1 項' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))

    const nextDetails = onApply.mock.calls[0][0] as MealDetails
    expect(nextDetails.lunch.find((line) => line.label === '自製雞肉捲')).toMatchObject({ amount: 1, kcalPerUnit: 1250 })
  })

  it('always lets a search query become a prefilled manual food', async () => {
    const user = userEvent.setup()
    render(<FoodAddSheet {...baseProps()} />)

    const searchInput = screen.getByPlaceholderText('搜尋食物、套餐、我的食物…')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '關閉新增食物' })))
    await user.type(searchInput, '自製雞肉捲')
    await user.click(screen.getByRole('button', { name: /手動新增「自製雞肉捲」/ }))

    const nameInput = screen.getByPlaceholderText('例如：公司午餐') as HTMLInputElement
    expect(nameInput.value).toBe('自製雞肉捲')
    expect(screen.queryByLabelText('搜尋食物')).toBeNull()
    expect(screen.getByRole('button', { name: '手動新增' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps the draft local through search and meal changes, then confirms before closing', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<FoodAddSheet {...baseProps({ onApply, onClose })} />)

    await openCommonAndAddChicken(user)
    expect(screen.getByRole('button', { name: '儲存 1 項' })).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '查看草稿' }))
    const draft = screen.getByRole('region', { name: '本次新增草稿' })
    expect(within(draft).getByText('午餐')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('加入餐次'), 'dinner')
    await user.type(screen.getByPlaceholderText('搜尋食物、套餐、我的食物…'), '雞肉')
    expect(screen.getByRole('button', { name: '儲存 1 項' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^雞肉.*常用/ }))

    expect(screen.getByRole('button', { name: '儲存 2 項' })).toBeTruthy()
    expect(within(draft).getByText('午餐')).toBeTruthy()
    expect(within(draft).getByText('晚餐')).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '關閉新增食物' }))
    expect(screen.getByRole('alertdialog', { name: '尚有 2 項未儲存' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('retains every draft row when the legacy DailyLog write fails', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn<(details: MealDetails) => Promise<void>>().mockRejectedValue(new Error('indexeddb unavailable'))
    const onClose = vi.fn()
    render(<FoodAddSheet {...baseProps({ onApply, onClose })} />)

    await openCommonAndAddChicken(user)
    await user.click(screen.getByRole('button', { name: '儲存 1 項' }))

    expect((await screen.findByRole('alert')).textContent).toContain('儲存失敗，草稿仍保留')
    expect(screen.getByRole('button', { name: '儲存 1 項' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks Escape and close controls while one atomic save is in flight', async () => {
    const user = userEvent.setup()
    const pending = deferred<void>()
    const onApply = vi.fn(() => pending.promise)
    const onClose = vi.fn()
    render(<FoodAddSheet {...baseProps({ onApply, onClose })} />)

    await openCommonAndAddChicken(user)
    await user.click(screen.getByRole('button', { name: '儲存 1 項' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))

    const closeButton = document.querySelector<HTMLButtonElement>('button[aria-label="關閉新增食物"]')
    expect(closeButton?.disabled).toBe(true)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: '批次新增食物' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()

    pending.resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
