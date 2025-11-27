import { apiKeyManager } from './api-key-manager';

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
  timestamp: number;
}

export class RequestQueueManager {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private concurrentLimit = 3; // Start conservatively to avoid TPM hits
  private activeRequests = 0;
  
  // Track request rates per API key
  private keyRequestTimestamps: Map<string, number[]> = new Map();
  private maxRequestsPerMinute = 30; // Groq limit is 30 req/min per key
  private recent429s: number[] = []; // timestamps of recent 429s
  
  async addRequest<T>(execute: (apiKey?: string) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: Math.random().toString(36).substr(2, 9),
        execute,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      };
      
      this.queue.push(request);
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeRequests < this.concurrentLimit) {
      const request = this.queue.shift();
      if (!request) continue;
      
      this.activeRequests++;
      this.executeRequest(request);
    }
    
    this.processing = false;
  }
  
  private async executeRequest(request: QueuedRequest) {
    try {
      // Get the next available API key that hasn't hit rate limit
      const apiKey = this.getAvailableApiKey();
      if (!apiKey) {
        // No keys available, requeue with delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.queue.unshift(request);
        this.activeRequests--;
        this.processQueue();
        return;
      }
      
      const result = await request.execute();
      request.resolve(result);
    } catch (error: any) {
      if (error?.message?.includes('rate_limit_exceeded') && request.retries < 3) {
        this.recent429s.push(Date.now());
        // Retry with exponential backoff
        request.retries++;
        const delay = Math.min(1500 * Math.pow(2, request.retries), 15000);
        
        setTimeout(() => {
          this.queue.unshift(request);
          this.processQueue();
        }, delay);
      } else {
        request.reject(error);
      }
    } finally {
      this.activeRequests--;
      // Adapt concurrency based on 429s in last minute
      const oneMinuteAgo = Date.now() - 60000;
      this.recent429s = this.recent429s.filter(ts => ts > oneMinuteAgo);
      if (this.recent429s.length > 6 && this.concurrentLimit > 2) {
        this.concurrentLimit = Math.max(2, this.concurrentLimit - 1);
      } else if (this.recent429s.length === 0 && this.concurrentLimit < 5) {
        this.concurrentLimit++;
      }
      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }
  
  private getAvailableApiKey(): string | null {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Try each API key
    for (let i = 0; i < 10; i++) {
      const key = apiKeyManager.getNextKey();
      
      // Get or create timestamp array for this key
      if (!this.keyRequestTimestamps.has(key)) {
        this.keyRequestTimestamps.set(key, []);
      }
      
      const timestamps = this.keyRequestTimestamps.get(key)!;
      
      // Remove old timestamps
      const recentTimestamps = timestamps.filter(ts => ts > oneMinuteAgo);
      this.keyRequestTimestamps.set(key, recentTimestamps);
      
      // Check if under rate limit
      if (recentTimestamps.length < this.maxRequestsPerMinute) {
        recentTimestamps.push(now);
        return key;
      }
    }
    
    return null;
  }
  
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing
    };
  }
}

// Singleton instance
export const requestQueueManager = new RequestQueueManager();
