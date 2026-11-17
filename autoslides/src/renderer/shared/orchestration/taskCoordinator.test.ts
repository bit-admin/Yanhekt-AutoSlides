import { describe, it, expect, vi, afterEach } from 'vitest'
import { isTaskCancelled, TaskCoordinator, type TaskContext, type TaskDriver } from './taskCoordinator'

// TaskCoordinator is a module singleton, so every registration must be torn down
// between tests. We collect unregister handles (including ones created inside a
// navigator) and run them in afterEach.
const cleanups: Array<() => void> = []
function track<T extends () => void>(unregister: T): T {
  cleanups.push(unregister)
  return unregister
}
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

const ctx = (over: Partial<TaskContext> = {}): TaskContext => ({
  taskId: 't1',
  sessionId: 's1',
  courseId: 'c1',
  courseTitle: 'Course',
  sessionTitle: 'Session',
  ...over
})

function makeDriver(over: Partial<TaskDriver> = {}): TaskDriver {
  return {
    mode: 'recorded',
    sessionId: 's1',
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    ...over
  }
}

describe('TaskCoordinator', () => {
  it('navigates then starts the matching recorded driver', async () => {
    const driver = makeDriver()
    track(TaskCoordinator.registerDriver(driver))
    const navigator = vi.fn()
    track(TaskCoordinator.registerNavigator(navigator))

    const task = ctx()
    await TaskCoordinator.runTask(task)

    expect(navigator).toHaveBeenCalledWith(task)
    expect(driver.start).toHaveBeenCalledWith(task, expect.any(AbortSignal))
  })

  it('waits for a driver that registers during navigation, then starts it', async () => {
    const driver = makeDriver()
    // The navigator mounts the page, which registers the driver.
    track(TaskCoordinator.registerNavigator(() => {
      track(TaskCoordinator.registerDriver(driver))
    }))

    await TaskCoordinator.runTask(ctx(), { driverTimeoutMs: 1000 })

    expect(driver.start).toHaveBeenCalledTimes(1)
  })

  it('rejects when no matching driver registers in time', async () => {
    track(TaskCoordinator.registerNavigator(() => {
      // Wrong session — never matches.
      track(TaskCoordinator.registerDriver(makeDriver({ sessionId: 'other' })))
    }))

    await expect(
      TaskCoordinator.runTask(ctx(), { driverTimeoutMs: 30 })
    ).rejects.toThrow(/did not become ready in time/)
  })

  it('does not match a live-mode driver', async () => {
    const liveDriver = makeDriver({ mode: 'live' })
    track(TaskCoordinator.registerDriver(liveDriver))

    await expect(
      TaskCoordinator.runTask(ctx(), { driverTimeoutMs: 30 })
    ).rejects.toThrow()
    expect(liveDriver.start).not.toHaveBeenCalled()
  })

  it('routes pauseTask to the matching driver', () => {
    const driver = makeDriver()
    track(TaskCoordinator.registerDriver(driver))

    const task = ctx()
    TaskCoordinator.pauseTask(task)
    expect(driver.pause).toHaveBeenCalledWith(task)
  })

  it('routes a Yanhe 2.0 task by its aita session, never to a Yanhekt driver of the same lecture', async () => {
    const yanhekt = makeDriver({ sessionId: '' })
    const yanhe2 = makeDriver({ sessionId: undefined, yanhe2SubId: 'sub-2' })
    const other = makeDriver({ sessionId: undefined, yanhe2SubId: 'sub-3' })
    track(TaskCoordinator.registerDriver(yanhekt))
    track(TaskCoordinator.registerDriver(other))
    track(TaskCoordinator.registerDriver(yanhe2))
    const session = { subId: 'sub-2' } as never
    const task = ctx({ sessionId: '', yanhe2: { account: 'a', session } })
    await TaskCoordinator.runTask(task, { driverTimeoutMs: 50 })
    expect(yanhe2.start).toHaveBeenCalledWith(task, expect.any(AbortSignal))
    expect(yanhekt.start).not.toHaveBeenCalled()
    expect(other.start).not.toHaveBeenCalled()

    // And a Yanhekt task never lands on a Yanhe 2.0 player.
    const plain = ctx({ taskId: 't2', sessionId: '' })
    await TaskCoordinator.runTask(plain, { driverTimeoutMs: 50 })
    expect(yanhekt.start).toHaveBeenCalledWith(plain, expect.any(AbortSignal))
  })
})

describe('TaskCoordinator: pausing or removing a task that is still starting', () => {
  it('does not start a driver that registers after the task was paused', async () => {
    const driver = makeDriver()
    const run = TaskCoordinator.runTask(ctx(), { driverTimeoutMs: 1000 })
    const outcome = run.then(() => 'started', (error: unknown) => (isTaskCancelled(error) ? 'cancelled' : 'failed'))

    TaskCoordinator.pauseTask(ctx())
    track(TaskCoordinator.registerDriver(driver))

    expect(await outcome).toBe('cancelled')
    expect(driver.start).not.toHaveBeenCalled()
  })

  it('aborts the signal a starting driver was given, and still tells it to pause', async () => {
    let seen: AbortSignal | undefined
    let release!: () => void
    const driver = makeDriver({
      start: vi.fn((_task: TaskContext, signal?: AbortSignal) => {
        seen = signal
        return new Promise<void>((resolve) => { release = resolve })
      }),
    })
    track(TaskCoordinator.registerDriver(driver))
    const run = TaskCoordinator.runTask(ctx())
    await Promise.resolve()
    await Promise.resolve()
    expect(seen?.aborted).toBe(false)

    TaskCoordinator.pauseTask(ctx())
    expect(seen?.aborted).toBe(true)
    expect(driver.pause).toHaveBeenCalledTimes(1)
    release()
    await run
  })

  it('leaves another task waiting when one is cancelled, and a re-queued task starts under its new run only', async () => {
    const other = makeDriver({ sessionId: 's2' })
    const otherRun = TaskCoordinator.runTask(ctx({ taskId: 't2', sessionId: 's2' }), { driverTimeoutMs: 1000 })
    const first = TaskCoordinator.runTask(ctx(), { driverTimeoutMs: 1000 }).catch((error: unknown) => isTaskCancelled(error))
    TaskCoordinator.pauseTask(ctx())
    expect(await first).toBe(true)

    const driver = makeDriver()
    const second = TaskCoordinator.runTask(ctx(), { driverTimeoutMs: 1000 })
    track(TaskCoordinator.registerDriver(driver))
    track(TaskCoordinator.registerDriver(other))
    await second
    await otherRun
    expect(driver.start).toHaveBeenCalledTimes(1)
    expect(other.start).toHaveBeenCalledTimes(1)
  })
})
