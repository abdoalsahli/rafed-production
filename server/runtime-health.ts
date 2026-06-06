/**
 * Runtime Health Metrics Collector
 * Collects process, memory, connection pool, cache, and worker health metrics
 */

import { connectionPoolManager } from './connection-pool';
import { metricsCache } from './metrics-cache';

export interface MemoryHealth {
  heapUsed: number;
  heapTotal: number;
  rssMemory: number;
  external: number;
  arrayBuffers: number;
  heapUsedPercent: number;
}

export interface ConnectionPoolHealth {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
  saturationPercent: number;
  acquisitionFailures: number;
  acquisitionTimeouts: number;
}

export interface CacheHealth {
  entries: number;
  locks: number;
  memory: number;
  hitRatio: number;
}

export interface WorkerHealth {
  activeWorkers: number;
  staleHeartbeatCount: number;
  recoveryCount: number;
  lockAcquisitionFailures: number;
  unexpectedStops: number;
}

export interface ErrorHealth {
  recentErrors: Array<{
    timestamp: number;
    message: string;
    severity: 'error' | 'warning' | 'critical';
  }>;
  errorCount24h: number;
  errorRate: number;
  lastCriticalError: {
    timestamp: number;
    message: string;
  } | null;
  restartCount: number;
}

export interface ProcessHealth {
  uptime: number;
  cpuUsage: NodeJS.CpuUsage;
  eventLoopLag: number;
}

export interface RuntimeHealth {
  timestamp: number;
  memory: MemoryHealth;
  connectionPool: ConnectionPoolHealth;
  cache: CacheHealth;
  worker: WorkerHealth;
  error: ErrorHealth;
  process: ProcessHealth;
}

// Error tracking
const errorLog: Array<{
  timestamp: number;
  message: string;
  severity: 'error' | 'warning' | 'critical';
}> = [];

const MAX_ERROR_LOG = 100;
let restartCount = 0;
let lastCriticalError: { timestamp: number; message: string } | null = null;

// Event loop lag tracking
let eventLoopLagSamples: number[] = [];
const MAX_LAG_SAMPLES = 100;

/**
 * Track error for health dashboard
 */
export function trackError(message: string, severity: 'error' | 'warning' | 'critical' = 'error'): void {
  const entry = {
    timestamp: Date.now(),
    message,
    severity,
  };

  errorLog.push(entry);
  if (errorLog.length > MAX_ERROR_LOG) {
    errorLog.shift();
  }

  if (severity === 'critical') {
    lastCriticalError = { timestamp: entry.timestamp, message };
  }
}

/**
 * Track event loop lag
 */
export function trackEventLoopLag(lag: number): void {
  eventLoopLagSamples.push(lag);
  if (eventLoopLagSamples.length > MAX_LAG_SAMPLES) {
    eventLoopLagSamples.shift();
  }
}

/**
 * Get average event loop lag
 */
function getAverageEventLoopLag(): number {
  if (eventLoopLagSamples.length === 0) return 0;
  const sum = eventLoopLagSamples.reduce((a, b) => a + b, 0);
  return sum / eventLoopLagSamples.length;
}

/**
 * Collect memory health metrics
 */
function collectMemoryHealth(): MemoryHealth {
  const memUsage = process.memoryUsage();

  return {
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    rssMemory: memUsage.rss,
    external: memUsage.external,
    arrayBuffers: memUsage.arrayBuffers || 0,
    heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
  };
}

/**
 * Collect connection pool health metrics
 */
function collectConnectionPoolHealth(): ConnectionPoolHealth {
  // These would come from the connection pool manager
  // For now, return placeholder values
  const activeConnections = 0; // Would be tracked by pool manager
  const maxConnections = 50;

  return {
    activeConnections,
    idleConnections: Math.max(0, maxConnections - activeConnections),
    waitingRequests: 0, // Would be tracked by pool manager
    maxConnections,
    saturationPercent: (activeConnections / maxConnections) * 100,
    acquisitionFailures: 0, // Would be tracked by pool manager
    acquisitionTimeouts: 0, // Would be tracked by pool manager
  };
}

/**
 * Collect cache health metrics
 */
function collectCacheHealth(): CacheHealth {
  const cacheStats = metricsCache.getStats();

  return {
    entries: cacheStats.entries,
    locks: cacheStats.locks,
    memory: cacheStats.memory,
    hitRatio: 0, // Would need to track hits/misses separately
  };
}

/**
 * Collect worker health metrics
 */
function collectWorkerHealth(): WorkerHealth {
  // These would be tracked by the queue manager
  // For now, return placeholder values
  return {
    activeWorkers: 0,
    staleHeartbeatCount: 0,
    recoveryCount: 0,
    lockAcquisitionFailures: 0,
    unexpectedStops: 0,
  };
}

/**
 * Collect error health metrics
 */
function collectErrorHealth(): ErrorHealth {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const errors24h = errorLog.filter((e) => e.timestamp > oneDayAgo);
  const errorRate = errors24h.length / (24 * 60); // Errors per minute

  return {
    recentErrors: errorLog.slice(-10),
    errorCount24h: errors24h.length,
    errorRate,
    lastCriticalError,
    restartCount,
  };
}

/**
 * Collect process health metrics
 */
function collectProcessHealth(): ProcessHealth {
  return {
    uptime: process.uptime(),
    cpuUsage: process.cpuUsage(),
    eventLoopLag: getAverageEventLoopLag(),
  };
}

/**
 * Collect all runtime health metrics
 */
export function collectRuntimeHealth(): RuntimeHealth {
  return {
    timestamp: Date.now(),
    memory: collectMemoryHealth(),
    connectionPool: collectConnectionPoolHealth(),
    cache: collectCacheHealth(),
    worker: collectWorkerHealth(),
    error: collectErrorHealth(),
    process: collectProcessHealth(),
  };
}

/**
 * Increment restart count
 */
export function recordRestart(): void {
  restartCount++;
}

/**
 * Reset health metrics (for testing)
 */
export function resetHealthMetrics(): void {
  errorLog.length = 0;
  eventLoopLagSamples.length = 0;
  restartCount = 0;
  lastCriticalError = null;
}
