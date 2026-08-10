// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MealLine } from '../types'
import { CopyMealPreviewSheet } from './CopyMealPreviewSheet'
import { MealItemActionSheet } from './MealItemActionSheet'

const line: MealLine = { key: 'line-1', label: '雞胸肉', amount: 200, unit: 'g', kcalPerUnit: 1.2, proteinPerUnit: .225 }
const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((onResolve) => { resolve = onResolve })
  return { promise, resolve }
}

beforeEach(() => { document.body.innerHTML = '<div class="app-shell"></div>' })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('meal operation sheets', () => {
  it('prevents duplicate action and Escape-close while a mutation is pending', async () => {
    const user = userEvent.setup()
    const pending = deferred<void>()
    const onDelete = vi.fn(() => pending.promise)
    const onClose = vi.fn()
    render(<MealItemActionSheet line={line} meal="lunch" onClose={onClose} onMove={vi.fn()} onDuplicate={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: '刪除' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
    expect((screen.getByRole('button', { name: '關閉餐點操作' }) as HTMLButtonElement).disabled).toBe(true)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    pending.resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('shows an in-dialog error and stays open when a meal mutation fails', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn().mockRejectedValue(new Error('save failed'))
    const onClose = vi.fn()
    render(<MealItemActionSheet line={line} meal="lunch" onClose={onClose} onMove={vi.fn()} onDuplicate={onDuplicate} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '複製一份' }))
    expect((await screen.findByRole('alert')).textContent).toContain('儲存失敗')
    expect(screen.getByRole('dialog', { name: '雞胸肉' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('defaults copy to append and reports a failed confirmation inside the sheet', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('沿用失敗，今天的餐點沒有變更'))
    render(<CopyMealPreviewSheet title="沿用昨天早餐" sourceTitle="昨天早餐" sourceRows={[{ label: '早餐', count: 1 }]} currentTitle="今天早餐" currentRows={[]} itemCount={1} scope="meal" onCancel={vi.fn()} onConfirm={onConfirm} />)

    expect((screen.getByRole('radio', { name: /追加到今天這餐/ }) as HTMLInputElement).checked).toBe(true)
    await user.click(screen.getByRole('button', { name: '加入 1 項' }))
    expect((await screen.findByRole('alert')).textContent).toContain('沿用失敗')
    expect(screen.getByRole('dialog', { name: '沿用昨天早餐' })).toBeTruthy()
  })
})
