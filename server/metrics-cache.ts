/**
 * Metrics Cache Manager
 * Caches expensive metrics calculations with TTL to reduce database load
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MetricsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private locks = new Map<string, Promise<any>>();
  private defaultTTL = 60000; // 60 seconds

  /**
   * Get cached value or compute it
   */
  async get<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Return cached value if valid
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Prevent thundering herd - only one computation per key
    if (this.locks.has(key)) {
      return this.locks.get(key)!;
    }

    // Compute new value
    const promise = compute()
      .then((data) => {
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          ttl,
        });
        this.locks.delete(key);
        return data;
      })
      .catch((error) => {
        this.locks.delete(key);
        throw error;
      });

    this.locks.set(key, promise);
    return promise;
  }

    /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.locks.delete(key);
  }

  /**
   * Invalidate all cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (pattern.test(key)) {
        this.invalidate(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.locks.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      locks: this.locks.size,
      memory: JSON.stringify(Array.from(this.cache.entries())).length,
    };
  }
}

export const metricsCache = new MetricsCache();
