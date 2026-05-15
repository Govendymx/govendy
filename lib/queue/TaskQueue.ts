
type TaskType = 'critical' | 'background' | 'compaction';

interface Task {
  id: string;
  type: TaskType;
  fn: () => Promise<void>;
  timestamp: number;
  priority: number; // Higher is more important
}

interface QueueMetrics {
  avgProcessingTime: number;
  tasksCompleted: number;
  lastProcessingTimes: number[];
  compactionCount: number;
}

export class TaskQueue {
  private queue: Task[] = [];
  private processing = false;
  private lastCompactionTime = 0;
  private pendingCompactionTimer: NodeJS.Timeout | null = null;
  private readonly COMPACTION_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly IDLE_THRESHOLD = 50; 
  private readonly MAX_CRITICAL_WAIT = 2000; // 2 seconds

  private metrics: QueueMetrics = {
    avgProcessingTime: 0,
    tasksCompleted: 0,
    lastProcessingTimes: [],
    compactionCount: 0
  };

  private static instance: TaskQueue;

  private constructor() {
    // Start monitoring loop
    if (typeof window !== 'undefined') {
      setInterval(() => this.monitorPerformance(), 30000);
    }
  }

  public static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  public enqueue(
    fn: () => Promise<void>,
    type: TaskType = 'background',
    id?: string
  ): void {
    const task: Task = {
      id: id || Math.random().toString(36).substring(7),
      type,
      fn,
      timestamp: Date.now(),
      priority: this.getPriority(type)
    };

    // Throttling logic for compaction with deferred execution (Smart Thresholds)
    if (type === 'compaction') {
      const now = Date.now();
      const timeSinceLast = now - this.lastCompactionTime;
      
      if (timeSinceLast < this.COMPACTION_INTERVAL) {
        const delay = this.COMPACTION_INTERVAL - timeSinceLast;
        console.log(`[TaskQueue] Compaction deferred. Waiting ${Math.ceil(delay / 1000)}s to optimize system load.`);
        
        // Debounce: Clear existing timer to avoid multiple scheduled compactions
        if (this.pendingCompactionTimer) {
          clearTimeout(this.pendingCompactionTimer);
        }

        // Schedule for later execution
        this.pendingCompactionTimer = setTimeout(() => {
          this.enqueue(fn, type, id);
          this.pendingCompactionTimer = null;
        }, delay);
        
        return;
      }
    }

    // Remove existing task with same ID if exists (debounce behavior)
    if (id) {
      this.queue = this.queue.filter(t => t.id !== id);
    }

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority); // Sort by priority desc

    this.process();
  }

  private getPriority(type: TaskType): number {
    switch (type) {
      case 'critical': return 100;
      case 'compaction': return 50;
      case 'background': return 10;
      default: return 0;
    }
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    // Use requestIdleCallback for background/compaction tasks to prioritize system responsiveness
    const nextTask = this.queue[0];
    if (nextTask && nextTask.type !== 'critical' && typeof window !== 'undefined' && (window as any).requestIdleCallback) {
      (window as any).requestIdleCallback(async (deadline: any) => {
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          await this.executeNext();
        } else {
          this.processing = false; // Yield and try again later
          setTimeout(() => this.process(), 100);
        }
      }, { timeout: 2000 });
    } else {
      await this.executeNext();
    }
  }

  private async executeNext() {
    const task = this.queue.shift();
    if (!task) {
        this.processing = false;
        return;
    }

    const startTime = Date.now();
      
    // Check for critical task timeout warning
    if (task.type === 'critical' && startTime - task.timestamp > this.MAX_CRITICAL_WAIT) {
      console.warn(`[TaskQueue] Critical task ${task.id} delayed by ${startTime - task.timestamp}ms`);
    }

    try {
      await task.fn();
      
      if (task.type === 'compaction') {
        this.lastCompactionTime = Date.now();
        this.metrics.compactionCount++;
      }

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration);

    } catch (error) {
      console.error(`[TaskQueue] Error processing task ${task.id}:`, error);
    }

    this.processing = false;
    
    // Continue processing if queue is not empty
    if (this.queue.length > 0) {
      // Small delay to yield to main thread
      setTimeout(() => this.process(), 0);
    }
  }

  private updateMetrics(duration: number) {
    this.metrics.tasksCompleted++;
    this.metrics.lastProcessingTimes.push(duration);
    
    // Keep last 50 samples
    if (this.metrics.lastProcessingTimes.length > 50) {
      this.metrics.lastProcessingTimes.shift();
    }

    const sum = this.metrics.lastProcessingTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgProcessingTime = sum / this.metrics.lastProcessingTimes.length;
  }

  private monitorPerformance() {
    if (this.metrics.avgProcessingTime > 2000) {
      console.warn('[TaskQueue] High average processing time:', this.metrics.avgProcessingTime.toFixed(2), 'ms');
    }
    
    // Verify 95% < 10s requirement
    const slowTasks = this.metrics.lastProcessingTimes.filter(t => t > 10000).length;
    const total = this.metrics.lastProcessingTimes.length;
    if (total > 0) {
      const slowRatio = slowTasks / total;
      if (slowRatio > 0.05) {
        console.error('[TaskQueue] SLA Violation: >5% of tasks taking >10s');
      }
    }

    console.log('[TaskQueue Status]', {
      pending: this.queue.length,
      completed: this.metrics.tasksCompleted,
      avgTime: this.metrics.avgProcessingTime.toFixed(0) + 'ms',
      lastCompaction: this.lastCompactionTime > 0 ? new Date(this.lastCompactionTime).toLocaleTimeString() : 'Never'
    });
  }
}

export const taskQueue = TaskQueue.getInstance();
