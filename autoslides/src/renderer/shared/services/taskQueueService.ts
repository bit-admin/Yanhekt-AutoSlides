import { reactive, computed } from 'vue'
import { PostProcessingService, type PostProcessJob } from './postProcessingService'
import { configStore } from './configStore'
import { TaskCoordinator, type TaskContext } from '@shared/orchestration/taskCoordinator'
import { reduceTask, type TaskEvent } from '@shared/orchestration/taskMachine'
import { overrides } from '../overrideRegistry'

// How many tasks may run concurrently. Mirrors the main-process clamp (1–10) so
// a hand-edited config.json above the UI cap of 5 still works for power users.
const getParallelTasks = (): number => {
  const raw = configStore.parallelTasks ?? 2
  return Math.max(1, Math.min(10, raw))
}

export type TaskStatus = 'queued' | 'in_progress' | 'error' | 'completed'

export interface TaskItem {
  id: string
  name: string
  courseTitle: string
  sessionTitle: string
  sessionId: string
  courseId: string
  status: TaskStatus
  progress: number
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  // Post-processing tracking
  postProcessJobId?: string
  outputPath?: string
  extractedSlideFiles?: string[]
}

export interface TaskQueueState {
  tasks: TaskItem[]
  isProcessing: boolean
  // Tasks currently playing + extracting. Up to `parallelTasks` at once; each
  // runs in its own playback tab. Post-processing still funnels into the single
  // serial PostProcessingService queue.
  activeTaskIds: string[]
}

export type TaskQueueAddResult =
  | { added: true; item: TaskItem }
  | { added: false; existingItem: TaskItem }

class TaskQueueService {
  private state: TaskQueueState = reactive({
    tasks: [],
    isProcessing: false,
    activeTaskIds: []
  })

  // Computed properties for easy access
  get tasks() {
    return this.state.tasks
  }

  get isProcessing() {
    return this.state.isProcessing
  }

  // First active task — kept for backward compatibility with single-task UI.
  get currentTask() {
    const id = this.state.activeTaskIds[0]
    return id ? this.state.tasks.find(task => task.id === id) ?? null : null
  }

  get activeTaskCount() {
    return this.state.activeTaskIds.length
  }

  get queuedCount() {
    return this.state.tasks.filter(task => task.status === 'queued').length
  }

  get inProgressCount() {
    return this.state.tasks.filter(task => task.status === 'in_progress').length
  }

  get completedCount() {
    return this.state.tasks.filter(task => task.status === 'completed').length
  }

  get errorCount() {
    return this.state.tasks.filter(task => task.status === 'error').length
  }

  /**
   * The single writer of a task's status/progress fields. Runs the event through
   * the pure machine and applies its patch, translating the timestamp sentinels.
   */
  private applyTask(task: TaskItem, event: TaskEvent): void {
    const patch = reduceTask(task.status, event)
    if (!patch) return
    if (patch.status !== undefined) task.status = patch.status
    if (patch.progress !== undefined) task.progress = patch.progress
    if (patch.error !== undefined) task.error = patch.error
    if (patch.startedAt === 'now') task.startedAt = Date.now()
    else if (patch.startedAt === 'clear') delete task.startedAt
    if (patch.completedAt === 'now') task.completedAt = Date.now()
  }

  private toContext(task: TaskItem): TaskContext {
    return {
      taskId: task.id,
      sessionId: task.sessionId,
      courseId: task.courseId,
      courseTitle: task.courseTitle,
      sessionTitle: task.sessionTitle
    }
  }

  // Add task to queue
  addToQueue(taskData: {
    name: string
    courseTitle: string
    sessionTitle: string
    sessionId: string
    courseId: string
  }): TaskQueueAddResult {
    // Check if task already exists
    const existingTask = this.state.tasks.find(
      task => task.sessionId === taskData.sessionId &&
               task.name === taskData.name
    )

    if (existingTask) {
      return { added: false, existingItem: existingTask }
    }

    const newTask: TaskItem = {
      id: this.generateTaskId(),
      name: taskData.name,
      courseTitle: taskData.courseTitle,
      sessionTitle: taskData.sessionTitle,
      sessionId: taskData.sessionId,
      courseId: taskData.courseId,
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    }

    this.state.tasks.push(newTask)
    return { added: true, item: newTask }
  }

  // Start processing queue
  startQueue(): void {
    if (overrides.suppressRealWork) return // demo mode never runs real extraction
    if (this.state.isProcessing) {
      return // Already processing
    }

    this.state.isProcessing = true
    this.fillSlots()
  }

  // Pause processing queue
  pauseQueue(): void {
    this.state.isProcessing = false

    // Tell every active task's playback driver to stop, then revert each to
    // queued so they can be picked up again on the next startQueue.
    for (const taskId of [...this.state.activeTaskIds]) {
      const task = this.state.tasks.find(t => t.id === taskId)
      if (task && task.status === 'in_progress') {
        TaskCoordinator.pauseTask(this.toContext(task))
        this.applyTask(task, { type: 'PAUSE' })
      }
    }
    this.state.activeTaskIds = []
  }

  // Clear completed and error tasks
  clearCompleted(): void {
    this.state.tasks = this.state.tasks.filter(
      task => task.status !== 'completed' && task.status !== 'error'
    )
  }

  // Remove specific task
  removeTask(taskId: string): void {
    const taskIndex = this.state.tasks.findIndex(task => task.id === taskId)
    if (taskIndex === -1) return

    const task = this.state.tasks[taskIndex]

    // If removing an active task, stop its driver and free its slot.
    if (this.state.activeTaskIds.includes(task.id)) {
      // Tell the playback driver to stop video + slide extraction.
      if (task.status === 'in_progress') {
        TaskCoordinator.pauseTask(this.toContext(task))
      }

      this.removeActive(task.id)
      this.state.tasks.splice(taskIndex, 1)

      if (this.state.isProcessing) {
        this.fillSlots()
      }
    } else {
      this.state.tasks.splice(taskIndex, 1)
    }
  }

  // Update task status
  updateTaskStatus(taskId: string, status: TaskStatus, error?: string): void {
    const task = this.state.tasks.find(task => task.id === taskId)
    if (!task) return

    const event: TaskEvent =
      status === 'in_progress' ? { type: 'START' }
        : status === 'completed' ? { type: 'COMPLETE' }
          : status === 'error' ? { type: 'FAIL', error: error ?? '' }
            : { type: 'PAUSE' }
    this.applyTask(task, event)

    if (status === 'completed' || status === 'error') {
      // Free this task's slot and pull in the next queued task (if any).
      if (this.state.activeTaskIds.includes(task.id)) {
        this.removeActive(task.id)
        if (this.state.isProcessing) {
          this.fillSlots()
        }
      }
    }
  }

  // Update task progress
  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.state.tasks.find(task => task.id === taskId)
    if (task) {
      this.applyTask(task, { type: 'PROGRESS', value: progress })
    }
  }

  // Get next queued task (skipping any already running).
  private getNextQueuedTask(): TaskItem | null {
    return this.state.tasks.find(
      task => task.status === 'queued' && !this.state.activeTaskIds.includes(task.id)
    ) || null
  }

  private removeActive(taskId: string): void {
    const idx = this.state.activeTaskIds.indexOf(taskId)
    if (idx !== -1) this.state.activeTaskIds.splice(idx, 1)
  }

  // Launch queued tasks until `parallelTasks` are running concurrently. Called
  // on startQueue and whenever a slot frees up (task complete/error/remove).
  private fillSlots(): void {
    if (!this.state.isProcessing) return

    const limit = getParallelTasks()
    while (this.state.activeTaskIds.length < limit) {
      const next = this.getNextQueuedTask()
      if (!next) break
      this.startTask(next)
    }

    // Nothing running and nothing queued — the queue has drained.
    if (this.state.activeTaskIds.length === 0 && !this.hasQueuedTasks) {
      this.state.isProcessing = false
    }
  }

  // Start one task: claim a slot, then drive it through the coordinator
  // (navigate → open its playback tab → wait for the driver → start it).
  // Resolves once running; rejects if the page never becomes ready, in which
  // case we fail the task so the slot frees and the queue advances.
  private startTask(task: TaskItem): void {
    this.state.activeTaskIds.push(task.id)
    this.applyTask(task, { type: 'START' })

    void TaskCoordinator.runTask(this.toContext(task)).catch((err) => {
      console.warn('[TaskQueue] Failed to start task:', task.id, err)
      const message = err instanceof Error ? err.message : String(err)
      // Only fail if the task is still active (a pause/remove may have moved on).
      if (this.state.activeTaskIds.includes(task.id)) {
        this.updateTaskStatus(task.id, 'error', message)
      }
    })
  }

  // Generate unique task ID
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  // Get task by ID
  getTask(taskId: string): TaskItem | null {
    return this.state.tasks.find(task => task.id === taskId) || null
  }

  // Check if queue has tasks
  get hasQueuedTasks(): boolean {
    return this.queuedCount > 0
  }

  // Check if queue is empty
  get isEmpty(): boolean {
    return this.state.tasks.length === 0
  }

  // Start post-processing for a completed task
  startPostProcessing(taskId: string, outputPath: string, imageFiles: string[]): string | null {
    const task = this.state.tasks.find(t => t.id === taskId)
    if (!task) {
      console.warn(`[TaskQueue] Cannot start post-processing: task ${taskId} not found`)
      return null
    }

    if (imageFiles.length === 0) {
      console.log(`[TaskQueue] No images to post-process for task ${taskId}`)
      return null
    }

    // Store info on the task
    task.outputPath = outputPath
    task.extractedSlideFiles = imageFiles

    // Create post-processing job
    const jobId = PostProcessingService.addJob(taskId, outputPath, imageFiles)
    task.postProcessJobId = jobId

    console.log(`[TaskQueue] Started post-processing job ${jobId} for task ${taskId}`)
    return jobId
  }

  // Get post-processing job for a task
  getPostProcessJob(taskId: string): PostProcessJob | undefined {
    const task = this.state.tasks.find(t => t.id === taskId)
    if (!task || !task.postProcessJobId) {
      return undefined
    }
    return PostProcessingService.getJob(task.postProcessJobId)
  }
}

// Create singleton instance
export const TaskQueue = new TaskQueueService()

// Export reactive computed properties for components
export const taskQueueState = computed(() => ({
  tasks: TaskQueue.tasks,
  isProcessing: TaskQueue.isProcessing,
  currentTask: TaskQueue.currentTask,
  queuedCount: TaskQueue.queuedCount,
  inProgressCount: TaskQueue.inProgressCount,
  completedCount: TaskQueue.completedCount,
  errorCount: TaskQueue.errorCount,
  hasQueuedTasks: TaskQueue.hasQueuedTasks,
  isEmpty: TaskQueue.isEmpty
}))
