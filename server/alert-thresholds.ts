/**
 * Alert Thresholds Configuration
 * Centralized configuration for all alert thresholds
 * Supports per-environment and per-account overrides
 */

export interface AlertThresholds {
  // Infrastructure
  connectionPoolSaturation: {
    warning: number; // percentage (0-1)
    critical: number;
  };
  memoryUsage: {
    warning: number; // bytes
    critical: number;
  };
  serverErrors: {
    warning: number; // count in 5m
    critical: number;
  };
  serverRestarts: {
    critical: number; // count in 10m
  };

  // Queue Operations
  queueDepth: {
    warning: number;
    critical: number;
  };
  oldestPendingAge: {
    warning: number; // seconds
    critical: number;
  };
  recoveryCount: {
    warning: number; // count in 10m
  };

  // Performance
  processingDuration: {
    p95Warning: number; // milliseconds
    p99Critical: number;
  };
  queueWait: {
    p95Warning: number; // milliseconds
    p99Critical: number;
  };

  // Financial Integrity
  failedPurchases: {
    warning: number; // count in 10m
    criticalRate: number; // percentage (0-1)
  };
}

/**
 * Default thresholds for production
 * Tuned for early production rollout with conservative limits
 */
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  // Infrastructure
  connectionPoolSaturation: {
    warning: 0.8, // 80%
    critical: 0.95, // 95%
  },
  memoryUsage: {
    warning: 500 * 1024 * 1024, // 500MB
    critical: 800 * 1024 * 1024, // 800MB
  },
  serverErrors: {
    warning: 10, // 10 errors in 5m
    critical: 25, // 25 errors in 5m
  },
  serverRestarts: {
    critical: 2, // 2 restarts in 10m
  },

  // Queue Operations
  queueDepth: {
    warning: 5000,
    critical: 8000,
  },
  oldestPendingAge: {
    warning: 300, // 5 minutes
    critical: 600, // 10 minutes
  },
  recoveryCount: {
    warning: 5, // 5 recoveries in 10m
  },

  // Performance
  processingDuration: {
    p95Warning: 2000, // 2 seconds
    p99Critical: 5000, // 5 seconds
  },
  queueWait: {
    p95Warning: 1000, // 1 second
    p99Critical: 3000, // 3 seconds
  },

  // Financial Integrity
  failedPurchases: {
    warning: 20, // 20 failures in 10m
    criticalRate: 0.1, // 10% failure rate
  },
};

/**
 * Early production thresholds - more conservative
 * Use these for initial rollout to catch issues early
 */
export const EARLY_PRODUCTION_THRESHOLDS: AlertThresholds = {
  // Infrastructure - stricter
  connectionPoolSaturation: {
    warning: 0.7, // 70%
    critical: 0.85, // 85%
  },
  memoryUsage: {
    warning: 400 * 1024 * 1024, // 400MB
    critical: 600 * 1024 * 1024, // 600MB
  },
  serverErrors: {
    warning: 5, // 5 errors in 5m
    critical: 15, // 15 errors in 5m
  },
  serverRestarts: {
    critical: 1, // 1 restart in 10m
  },

  // Queue Operations - stricter
  queueDepth: {
    warning: 3000,
    critical: 5000,
  },
  oldestPendingAge: {
    warning: 180, // 3 minutes
    critical: 300, // 5 minutes
  },
  recoveryCount: {
    warning: 3, // 3 recoveries in 10m
  },

  // Performance - stricter
  processingDuration: {
    p95Warning: 1000, // 1 second
    p99Critical: 2000, // 2 seconds
  },
  queueWait: {
    p95Warning: 500, // 500ms
    p99Critical: 1500, // 1.5 seconds
  },

  // Financial Integrity - stricter
  failedPurchases: {
    warning: 10, // 10 failures in 10m
    criticalRate: 0.05, // 5% failure rate
  },
};

/**
 * Per-account threshold overrides
 * Allows different thresholds for different accounts
 */
export interface AccountThresholdOverride {
  providerId: string;
  distributorId: string;
  thresholds: Partial<AlertThresholds>;
}

class ThresholdManager {
  private defaultThresholds: AlertThresholds;
  private accountOverrides: Map<string, Partial<AlertThresholds>> = new Map();

  constructor(defaultThresholds: AlertThresholds = DEFAULT_THRESHOLDS) {
    this.defaultThresholds = defaultThresholds;
  }

  /**
   * Get thresholds for an account
   */
  getThresholds(providerId: string, distributorId: string): AlertThresholds {
    const key = `${providerId}:${distributorId}`;
    const overrides = this.accountOverrides.get(key);

    if (!overrides) {
      return this.defaultThresholds;
    }

    return this.mergeThresholds(this.defaultThresholds, overrides);
  }

  /**
   * Set account-specific threshold overrides
   */
  setAccountOverrides(
    providerId: string,
    distributorId: string,
    overrides: Partial<AlertThresholds>
  ): void {
    const key = `${providerId}:${distributorId}`;
    this.accountOverrides.set(key, overrides);
    console.log(`[THRESHOLD-MANAGER] Set overrides for ${key}`);
  }

  /**
   * Clear account-specific overrides
   */
  clearAccountOverrides(providerId: string, distributorId: string): void {
    const key = `${providerId}:${distributorId}`;
    this.accountOverrides.delete(key);
    console.log(`[THRESHOLD-MANAGER] Cleared overrides for ${key}`);
  }

  /**
   * Merge default and override thresholds
   */
  private mergeThresholds(
    defaults: AlertThresholds,
    overrides: Partial<AlertThresholds>
  ): AlertThresholds {
    return {
      connectionPoolSaturation: {
        ...defaults.connectionPoolSaturation,
        ...(overrides.connectionPoolSaturation || {}),
      },
      memoryUsage: {
        ...defaults.memoryUsage,
        ...(overrides.memoryUsage || {}),
      },
      serverErrors: {
        ...defaults.serverErrors,
        ...(overrides.serverErrors || {}),
      },
      serverRestarts: {
        ...defaults.serverRestarts,
        ...(overrides.serverRestarts || {}),
      },
      queueDepth: {
        ...defaults.queueDepth,
        ...(overrides.queueDepth || {}),
      },
      oldestPendingAge: {
        ...defaults.oldestPendingAge,
        ...(overrides.oldestPendingAge || {}),
      },
      recoveryCount: {
        ...defaults.recoveryCount,
        ...(overrides.recoveryCount || {}),
      },
      processingDuration: {
        ...defaults.processingDuration,
        ...(overrides.processingDuration || {}),
      },
      queueWait: {
        ...defaults.queueWait,
        ...(overrides.queueWait || {}),
      },
      failedPurchases: {
        ...defaults.failedPurchases,
        ...(overrides.failedPurchases || {}),
      },
    };
  }

  /**
   * Get all configured thresholds
   */
  getAll(): AlertThresholds {
    return this.defaultThresholds;
  }

  /**
   * Set default thresholds
   */
  setDefaults(thresholds: AlertThresholds): void {
    this.defaultThresholds = thresholds;
    console.log('[THRESHOLD-MANAGER] Default thresholds updated');
  }
}

// Singleton instance
let thresholdManager: ThresholdManager | null = null;

export function initializeThresholdManager(
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): ThresholdManager {
  thresholdManager = new ThresholdManager(thresholds);
  return thresholdManager;
}

export function getThresholdManager(): ThresholdManager {
  if (!thresholdManager) {
    thresholdManager = new ThresholdManager(DEFAULT_THRESHOLDS);
  }
  return thresholdManager;
}

export function useEarlyProductionThresholds(): void {
  const manager = getThresholdManager();
  manager.setDefaults(EARLY_PRODUCTION_THRESHOLDS);
  console.log('[THRESHOLD-MANAGER] Switched to early production thresholds');
}
