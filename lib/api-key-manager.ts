// API Key Manager for load balancing and rate limit handling
export class APIKeyManager {
  private apiKeys: string[] = (
    process.env.GROQ_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || []
  );

  // Track rate limits for each key
  private keyStatus: Map<string, {
    rateLimited: boolean;
    rateLimitExpiry: number;
    requestCount: number;
    lastReset: number;
  }> = new Map();

  // Current key index for round-robin
  private currentKeyIndex = 0;

  constructor() {
    // Initialize status for each key
    this.apiKeys.forEach(key => {
      this.keyStatus.set(key, {
        rateLimited: false,
        rateLimitExpiry: 0,
        requestCount: 0,
        lastReset: Date.now()
      });
    });
  }

  // Get the next available API key
  getNextKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('No GROQ_API_KEYS configured');
    }
    const now = Date.now();
    let attempts = 0;
    
    while (attempts < this.apiKeys.length) {
      const key = this.apiKeys[this.currentKeyIndex];
      const status = this.keyStatus.get(key)!;
      
      // Reset hourly counter if needed
      if (now - status.lastReset > 3600000) { // 1 hour
        status.requestCount = 0;
        status.lastReset = now;
      }
      
      // Check if key is rate limited
      if (status.rateLimited && now < status.rateLimitExpiry) {
        // Skip this key, try next
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        attempts++;
        continue;
      }
      
      // If rate limit expired, reset flag
      if (status.rateLimited && now >= status.rateLimitExpiry) {
        status.rateLimited = false;
      }
      
       // Use this key
      status.requestCount++;
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      
      console.log(`Using API key index ${this.currentKeyIndex - 1}, requests: ${status.requestCount}`);
      return key;
    }
    
    // All keys are rate limited - return the one with shortest wait time
    let bestKey = this.apiKeys[0];
    let shortestWait = Infinity;
    
    this.apiKeys.forEach(key => {
      const status = this.keyStatus.get(key)!;
      const waitTime = status.rateLimitExpiry - now;
      if (waitTime < shortestWait) {
        shortestWait = waitTime;
        bestKey = key;
      }
    });
    
     console.warn('All API keys rate limited, using best available');
    return bestKey;
  }

  // Mark a key as rate limited
  markRateLimited(key: string, waitSeconds: number = 60) {
    const status = this.keyStatus.get(key);
    if (status) {
      status.rateLimited = true;
      status.rateLimitExpiry = Date.now() + (waitSeconds * 1000);
      console.log(`API key rate limited, will retry after ${waitSeconds}s`);
    }
  }

  // Respect Retry-After header seconds when available
  markRateLimitedRetryAfter(key: string, retryAfterHeader?: string) {
    const seconds = retryAfterHeader ? Math.max(1, parseInt(retryAfterHeader, 10)) : 60;
    this.markRateLimited(key, seconds);
  }

  // Get statistics
  getStats() {
    const stats = {
      totalKeys: this.apiKeys.length,
      availableKeys: 0,
      rateLimitedKeys: 0,
      totalRequests: 0
    };
    
    const now = Date.now();
    this.keyStatus.forEach((status) => {
      stats.totalRequests += status.requestCount;
      if (status.rateLimited && now < status.rateLimitExpiry) {
        stats.rateLimitedKeys++;
      } else {
        stats.availableKeys++;
      }
    });
    
    return stats;
  }
}

// Singleton instance
export const apiKeyManager = new APIKeyManager();
