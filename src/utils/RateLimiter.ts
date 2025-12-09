/**
 * Rate limiter for API calls
 * Ensures we don't exceed rate limits (e.g., Jina.ai 20 requests/second)
 */
export class RateLimiter {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  private processing = 0;
  private lastExecutionTime = 0;

  constructor(
    private maxConcurrent: number = 20,
    private minInterval: number = 50 // 50ms = 20 requests/second
  ) {}

  /**
   * Add a function to the rate-limited queue
   */
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  /**
   * Process queued requests
   */
  private async process(): Promise<void> {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;

    if (timeSinceLastExecution < this.minInterval) {
      const delay = this.minInterval - timeSinceLastExecution;
      await this.sleep(delay);
    }

    const item = this.queue.shift();
    if (!item) return;

    this.processing++;
    this.lastExecutionTime = Date.now();

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.processing--;
      this.process(); // Process next item
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      maxConcurrent: this.maxConcurrent
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
