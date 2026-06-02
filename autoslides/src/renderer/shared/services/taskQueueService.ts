import { reactive, computed } from 'vue'
import { PostProcessingService, type PostProcessJob } from './postProcessingService'
import { TaskCoordinator, type TaskContext } from '@shared/orchestration/taskCoordinator'
import { reduceTask, type TaskEvent } from '@shared/orchestration/taskMachine'

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
  currentTaskId: string | null
}

export type TaskQueueAddResult =
  | { added: true; item: TaskItem }
  | { added: false; existingItem: TaskItem }

class TaskQueueService {
  private state: TaskQueueState = reactive({
    tasks: [],
    isProcessing: false,
    currentTaskId: null
  })

  // Computed properties for easy access
  get tasks() {
    return this.state.tasks
  }

  get isProcessing() {
    return this.state.isProcessing
  }

  get currentTask() {
    return this.state.currentTaskId
      ? this.state.tasks.find(task => task.id === this.state.currentTaskId)
      : null
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
    if (this.state.isProcessing) {
      return // Already processing
    }

    this.state.isProcessing = true
    this.processNextTask()
  }

  // Pause processing queue
  pauseQueue(): void {
    this.state.isProcessing = false

    // Tell the current task's playback driver to stop, then revert the task to
    // queued so it can be picked up again on the next startQueue.
    if (this.state.currentTaskId) {
      const currentTask = this.state.tasks.find(task => task.id === this.state.currentTaskId)
      if (currentTask && currentTask.status === 'in_progress') {
        TaskCoordinator.pauseTask(this.toContext(currentTask))
        this.applyTask(currentTask, { type: 'PAUSE' })
      }
      this.state.currentTaskId = null
    }
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

    // If removing current task, stop processing and move to next
    if (task.id === this.state.currentTaskId) {
      // Tell the playback driver to stop video + slide extraction.
      if (task.status === 'in_progress') {
        TaskCoordinator.pauseTask(this.toContext(task))
      }

      this.state.currentTaskId = null
      this.state.tasks.splice(taskIndex, 1)

      if (this.state.isProcessing) {
        this.processNextTask()
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
      // If this was the current task, move to next
      if (task.id === this.state.currentTaskId) {
        this.state.currentTaskId = null
        if (this.state.isProcessing) {
          this.processNextTask()
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

  // Get next queued task
  private getNextQueuedTask(): TaskItem | null {
    return this.state.tasks.find(task => task.status === 'queued') || null
  }

  // Process next task in queue
  private processNextTask(): void {
    if (!this.state.isProcessing) {
      return
    }

    const nextTask = this.getNextQueuedTask()
    if (!nextTask) {
      // No more tasks to process
      this.state.isProcessing = false
      this.state.currentTaskId = null
      return
    }

    // Start processing the next task
    this.state.currentTaskId = nextTask.id
    this.applyTask(nextTask, { type: 'START' })

    // Drive the task through the coordinator: navigate → wait for the playback
    // driver → start it. Resolves once running; rejects if the page never
    // becomes ready or initialization fails, in which case we fail the task so
    // the queue advances instead of stalling forever.
    void TaskCoordinator.runTask(this.toContext(nextTask)).catch((err) => {
      console.warn('[TaskQueue] Failed to start task:', nextTask.id, err)
      const message = err instanceof Error ? err.message : String(err)
      // Only fail if the task is still the current in-flight one (a pause/remove
      // may have moved on in the meantime).
      if (this.state.currentTaskId === nextTask.id) {
        this.updateTaskStatus(nextTask.id, 'error', message)
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
