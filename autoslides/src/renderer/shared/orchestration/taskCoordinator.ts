// Typed coordinator replacing the TaskQueue ↔ PlaybackPage window-CustomEvent
// handshake (Chain B).
//
// Previously TaskQueue dispatched `taskNavigation` / `taskStart` and then spun a
// 30-retry `waitForTaskReadiness` loop because it had no way to know when the
// PlaybackPage had mounted and become ready, relying on an `acknowledgedTasks`
// Set to stop the storm. Here the PlaybackPage registers a typed `TaskDriver`
// on mount; the coordinator routes a task to the matching driver, waiting (once,
// with a timeout) for the driver to appear after navigation, then awaits its
// `start()`. No global events, no retry storm, no acknowledgment Set.

export interface TaskContext {
  taskId: string
  sessionId: string
  courseId: string
  courseTitle: string
  sessionTitle: string
}

export interface TaskDriver {
  mode: 'live' | 'recorded'
  sessionId?: string
  /** Begin playback + slide extraction; resolves once running, rejects on failure. */
  start(task: TaskContext): Promise<void>
  /** Stop playback + slide extraction (queue paused / current task removed). */
  pause(task: TaskContext): void
  /** Resume a previously-paused task (currently unused — kept for parity). */
  resume(task: TaskContext): Promise<void>
}

export type TaskNavigator = (task: TaskContext) => void

const DEFAULT_DRIVER_TIMEOUT_MS = 15000

class TaskCoordinatorClass {
  private drivers = new Set<TaskDriver>()
  private navigator: TaskNavigator | null = null
  private driverWaiters = new Set<() => void>()

  /** Register a playback driver (PlaybackPage on mount). Returns an unregister fn. */
  registerDriver(driver: TaskDriver): () => void {
    this.drivers.add(driver)
    // Wake anything waiting for a matching driver to appear. Iterate a snapshot;
    // each waiter self-removes from driverWaiters on match (via its cleanup) and
    // a non-matching waiter stays registered so a later driver can still wake it.
    // (Critical under parallel tasks: multiple waiters coexist, and one driver
    // registering must not orphan the others.)
    const waiters = [...this.driverWaiters]
    waiters.forEach((w) => w())
    return () => {
      this.drivers.delete(driver)
    }
  }

  /** Register the app's navigation handler (MainContent). Returns an unregister fn. */
  registerNavigator(navigator: TaskNavigator): () => void {
    this.navigator = navigator
    return () => {
      if (this.navigator === navigator) this.navigator = null
    }
  }

  private findDriver(task: TaskContext): TaskDriver | null {
    // The automated queue only drives recorded-mode sessions; a driver matches
    // by mode + sessionId, exactly the filter the old window-event handlers used.
    return (
      [...this.drivers].find(
        (d) => d.mode === 'recorded' && d.sessionId === task.sessionId
      ) || null
    )
  }

  private waitForDriver(task: TaskContext, timeoutMs: number): Promise<TaskDriver> {
    const existing = this.findDriver(task)
    if (existing) return Promise.resolve(existing)

    return new Promise<TaskDriver>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        clearTimeout(timer)
        this.driverWaiters.delete(onChange)
      }
      const onChange = () => {
        const driver = this.findDriver(task)
        if (driver && !settled) {
          settled = true
          cleanup()
          resolve(driver)
        }
      }
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          cleanup()
          reject(new Error('Task failed to start: playback page did not become ready in time'))
        }
      }, timeoutMs)
      this.driverWaiters.add(onChange)
    })
  }

  /**
   * Drive one task: navigate to its session (mounts the PlaybackPage, which
   * registers its driver), wait for that driver, then start it. Resolves once
   * the task is running; rejects if no driver registers in time or start fails.
   */
  async runTask(task: TaskContext, opts?: { driverTimeoutMs?: number }): Promise<void> {
    this.navigator?.(task)
    const driver = await this.waitForDriver(task, opts?.driverTimeoutMs ?? DEFAULT_DRIVER_TIMEOUT_MS)
    await driver.start(task)
  }

  /** Pause the task on its matching driver (no-op if none registered). */
  pauseTask(task: TaskContext): void {
    this.findDriver(task)?.pause(task)
  }
}

export const TaskCoordinator = new TaskCoordinatorClass()
