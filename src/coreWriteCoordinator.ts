export class CoreWriteBlockedError extends Error {
  constructor() {
    super('A bulk core-data operation is already in progress')
    this.name = 'CoreWriteBlockedError'
  }
}

/**
 * Serializes every write to the core IndexedDB. Bulk replacement/clear work
 * raises a synchronous barrier so edits based on the previous snapshot cannot
 * be queued behind it and silently reappear after the bulk transaction.
 */
export class CoreWriteCoordinator {
  private queue: Promise<void> = Promise.resolve()
  private bulkMutationActive = false

  get isBulkMutationActive(): boolean {
    return this.bulkMutationActive
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.bulkMutationActive) return Promise.reject(new CoreWriteBlockedError())
    return this.enqueue(operation)
  }

  runBulk<T>(operation: () => Promise<T>, options: { retainOnSuccess?: boolean } = {}): Promise<T> {
    if (this.bulkMutationActive) return Promise.reject(new CoreWriteBlockedError())
    this.bulkMutationActive = true

    const result = this.queue.then(operation).then(
      (value) => {
        if (!options.retainOnSuccess) this.bulkMutationActive = false
        return value
      },
      (error: unknown) => {
        this.bulkMutationActive = false
        throw error
      }
    )
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  whenIdle(): Promise<void> {
    return this.queue
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}
