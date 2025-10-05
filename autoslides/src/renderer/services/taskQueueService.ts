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

    // Emit task pause event to notify PlaybackPage to pause video
    if (this.state.currentTaskId) {
      const currentTask = this.state.tasks.find(task => task.id === this.state.currentTaskId)
      if (currentTask && currentTask.status === 'in_progress') {
        // Emit pause event before changing task status
        const pauseEvent = new CustomEvent('taskPause', {
          detail: {
            taskId: currentTask.id,
            sessionId: currentTask.sessionId
          }
        })
        window.dispatchEvent(pauseEvent)

        // Mark current task as queued
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
      // Emit pause event to notify PlaybackPage to stop video and slide extraction
      if (task.status === 'in_progress') {
        const pauseEvent = new CustomEvent('taskPause', {
          detail: {
            taskId: task.id,
            sessionId: task.sessionId
          }
        })
        window.dispatchEvent(pauseEvent)
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

  // Emit event to start task processing with improved timing
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

    // Wait for navigation and video loading with progressive delays
    this.waitForTaskReadiness(task)
  }

  // Wait for task readiness with progressive retry mechanism
  private waitForTaskReadiness(task: TaskItem): void {
    let retryCount = 0
    const maxRetries = 30 // 30 retries = up to 15 seconds
    const baseDelay = 500 // Start with 500ms

    const checkAndEmitTaskStart = () => {
      retryCount++

      // Calculate progressive delay (500ms, 750ms, 1000ms, then 1000ms)
      const delay = Math.min(baseDelay + (retryCount * 250), 1000)

      console.log(`Task readiness check ${retryCount}/${maxRetries} for task: ${task.id}`)

      // Check if task is still valid and processing
      const currentTask = this.state.tasks.find(t => t.id === task.id)
      if (!currentTask || currentTask.status !== 'in_progress' || !this.state.isProcessing) {
        console.log('Task no longer valid or processing stopped:', task.id)
        return
      }

      // Emit task start event
      const taskEvent = new CustomEvent('taskStart', {
        detail: {
          taskId: task.id,
          sessionId: task.sessionId,
          courseTitle: task.courseTitle,
          sessionTitle: task.sessionTitle,
          retryCount: retryCount
        }
      })
      window.dispatchEvent(taskEvent)

      // If we haven't reached max retries, schedule another attempt
      // This allows the PlaybackPage to handle the event and potentially succeed
      if (retryCount < maxRetries) {
        setTimeout(checkAndEmitTaskStart, delay)
      } else {
        console.warn('Max task start retries reached for task:', task.id)
        // Don't mark as error here - let the PlaybackPage handle timeout
      }
    }

    // Start the first attempt after initial navigation delay
    setTimeout(checkAndEmitTaskStart, baseDelay)
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