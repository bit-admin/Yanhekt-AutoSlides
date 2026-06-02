import { describe, it, expect, vi, afterEach } from 'vitest'
import { TaskCoordinator, type TaskContext, type TaskDriver } from './taskCoordinator'

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
    expect(driver.start).toHaveBeenCalledWith(task)
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
})
