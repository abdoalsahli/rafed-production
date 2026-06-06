/**
 * Queue Configuration System
 * Centralized, configurable queue parameters
 */

export interface QueueConfig {
  maxQueueDepth: number;
  staleProcessingSeconds: number;
  lockTimeoutSeconds: number;
  heartbeatIntervalSeconds: number;
  recoveryIntervalSeconds: number;
  maxRecoveryAttempts: number;
  alertThresholds: {
    queueDepthWarning: number;
    queueDepthCritical: number;
    p95ProcessingWarningMs: number;
    p99ProcessingCriticalMs: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: QueueConfig = {
  maxQueueDepth: 10000,
  staleProcessingSeconds: 60,
  lockTimeoutSeconds: 30,
  heartbeatIntervalSeconds: 5,
  recoveryIntervalSeconds: 30,
  maxRecoveryAttempts: 3,
  alertThresholds: {
    queueDepthWarning: 5000,
    queueDepthCritical: 8000,
    p95ProcessingWarningMs: 2000,
    p99ProcessingCriticalMs: 5000,
  },
};

// Per-account overrides (future feature)
const ACCOUNT_OVERRIDES: Map<string, Partial<QueueConfig>> = new Map();

/**
 * Get queue configuration
 */
export function getQueueConfig(
  providerId?: number,
  distributorId?: number
): QueueConfig {
  // Check for per-account override
  if (providerId && distributorId) {
    const key = `${providerId}:${distributorId}`;
    const override = ACCOUNT_OVERRIDES.get(key);
    if (override) {
      return { ...DEFAULT_CONFIG, ...override };
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * Set per-account override
 */
export function setAccountOverride(
  providerId: number,
  distributorId: number,
  override: Partial<QueueConfig>
): void {
  const key = `${providerId}:${distributorId}`;
  const current = ACCOUNT_OVERRIDES.get(key) || {};
  ACCOUNT_OVERRIDES.set(key, { ...current, ...override });
}

/**
 * Clear per-account override
 */
export function clearAccountOverride(providerId: number, distributorId: number): void {
  const key = `${providerId}:${distributorId}`;
  ACCOUNT_OVERRIDES.delete(key);
}

/**
 * Get all active overrides
 */
export function getAllOverrides(): Map<string, Partial<QueueConfig>> {
  return new Map(ACCOUNT_OVERRIDES);
}

/**
 * Reset to defaults
 */
export function resetToDefaults(): void {
  ACCOUNT_OVERRIDES.clear();
}
