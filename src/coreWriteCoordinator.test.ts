import { describe, expect, it } from 'vitest'
import { CoreWriteBlockedError, CoreWriteCoordinator } from './coreWriteCoordinator'

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('CoreWriteCoordinator', () => {
  it('runs ordinary writes in FIFO order', async () => {
    const coordinator = new CoreWriteCoordinator()
    const firstGate = deferred<void>()
    const events: string[] = []

    const first = coordinator.run(async () => {
      events.push('first:start')
      await firstGate.promise
      events.push('first:end')
    })
    const second = coordinator.run(async () => { events.push('second') })

    await Promise.resolve()
    expect(events).toEqual(['first:start'])
    firstGate.resolve()
    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second'])
  })

  it('waits for prior writes and blocks edits queued during a bulk replacement', async () => {
    const coordinator = new CoreWriteCoordinator()
    const priorGate = deferred<void>()
    const bulkGate = deferred<void>()
    const events: string[] = []

    const prior = coordinator.run(async () => {
      events.push('prior:start')
      await priorGate.promise
      events.push('prior:end')
    })
    const bulk = coordinator.runBulk(async () => {
      events.push('bulk:start')
      await bulkGate.promise
      events.push('bulk:end')
    })

    expect(coordinator.isBulkMutationActive).toBe(true)
    await expect(coordinator.run(async () => { events.push('stale-edit') })).rejects.toBeInstanceOf(CoreWriteBlockedError)
    priorGate.resolve()
    await prior
    await Promise.resolve()
    expect(events).toEqual(['prior:start', 'prior:end', 'bulk:start'])
    bulkGate.resolve()
    await bulk
    expect(coordinator.isBulkMutationActive).toBe(false)
    expect(events).toEqual(['prior:start', 'prior:end', 'bulk:start', 'bulk:end'])
  })

  it('releases the barrier after a failed bulk operation', async () => {
    const coordinator = new CoreWriteCoordinator()

    await expect(coordinator.runBulk(async () => { throw new Error('replace failed') })).rejects.toThrow('replace failed')
    expect(coordinator.isBulkMutationActive).toBe(false)
    await expect(coordinator.run(async () => 'saved')).resolves.toBe('saved')
    await coordinator.whenIdle()
  })

  it('does not poison the queue after an ordinary write fails', async () => {
    const coordinator = new CoreWriteCoordinator()

    await expect(coordinator.run(async () => { throw new Error('food save failed') })).rejects.toThrow('food save failed')
    await expect(coordinator.run(async () => 'next write saved')).resolves.toBe('next write saved')
  })

  it('allows only one bulk operation to acquire the barrier', async () => {
    const coordinator = new CoreWriteCoordinator()
    const gate = deferred<void>()
    const first = coordinator.runBulk(async () => { await gate.promise })

    await expect(coordinator.runBulk(async () => undefined)).rejects.toBeInstanceOf(CoreWriteBlockedError)
    gate.resolve()
    await first
  })

  it('can retain the barrier after a successful hand-off that must reload the page', async () => {
    const coordinator = new CoreWriteCoordinator()

    await expect(coordinator.runBulk(async () => 'update-started', { retainOnSuccess: true })).resolves.toBe('update-started')
    expect(coordinator.isBulkMutationActive).toBe(true)
    await expect(coordinator.run(async () => 'stale-after-update')).rejects.toBeInstanceOf(CoreWriteBlockedError)
  })
})
