import { reactive, computed } from 'vue'

export type TaskStatus = 'queued' | 'in_progress' | 'error' | 'completed'

export interface TaskItem {
  id: string
  name: string
  courseTitle: string
  sessionTitle: string
  sessionId: string
  status: TaskStatus
  progress: number
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface TaskQueueState {
  tasks: TaskItem[]
  isProcessing: boolean
  currentTaskId: string | null
}

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

  // Add task to queue
  addToQueue(taskData: {
    name: string
    courseTitle: string
    sessionTitle: string
    sessionId: string
  }): boolean {
    // Check if task already exists
    const existingTask = this.state.tasks.find(
      task => task.sessionId === taskData.sessionId &&
               task.name === taskData.name
    )

    if (existingTask) {
      return false // Task already exists
    }

    const newTask: TaskItem = {
      id: this.generateTaskId(),
      name: taskData.name,
      courseTitle: taskData.courseTitle,
      sessionTitle: taskData.sessionTitle,
      sessionId: taskData.sessionId,
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    }

    this.state.tasks.push(newTask)
    return true
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

    // Mark current task as queued if it's in progress
    if (this.state.currentTaskId) {
      const currentTask = this.state.tasks.find(task => task.id === this.state.currentTaskId)
      if (currentTask && currentTask.status === 'in_progress') {
        currentTask.status = 'queued'
        currentTask.progress = 0
        delete currentTask.startedAt
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

    task.status = status
    if (error) {
      task.error = error
    }

    if (status === 'in_progress') {
      task.startedAt = Date.now()
      task.progress = 0
    } else if (status === 'completed' || status === 'error') {
      task.completedAt = Date.now()
      task.progress = status === 'completed' ? 100 : 0

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
    if (task && task.status === 'in_progress') {
      task.progress = Math.max(0, Math.min(100, progress))
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
    nextTask.status = 'in_progress'
    nextTask.startedAt = Date.now()
    nextTask.progress = 0

    // Emit event to start slide extraction for this task
    this.emitTaskStartEvent(nextTask)
  }

  // Emit event to start task processing
  private emitTaskStartEvent(task: TaskItem): void {
    // First emit navigation event to go to the session
    const navigationEvent = new CustomEvent('taskNavigation', {
      detail: {
        taskId: task.id,
        sessionId: task.sessionId,
        courseTitle: task.courseTitle,
        sessionTitle: task.sessionTitle
      }
    })
    window.dispatchEvent(navigationEvent)

    // Then emit task start event (with a small delay to ensure navigation completes)
    setTimeout(() => {
      const taskEvent = new CustomEvent('taskStart', {
        detail: {
          taskId: task.id,
          sessionId: task.sessionId,
          courseTitle: task.courseTitle,
          sessionTitle: task.sessionTitle
        }
      })
      window.dispatchEvent(taskEvent)
    }, 500) // 500ms delay to allow navigation to complete
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