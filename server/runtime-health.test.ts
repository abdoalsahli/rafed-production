/**
 * Runtime Health Tests
 * Verifies runtime health metrics collection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectRuntimeHealth,
  trackError,
  trackEventLoopLag,
  recordRestart,
  resetHealthMetrics,
} from './runtime-health';

describe('Runtime Health Metrics', () => {
  beforeEach(() => {
    resetHealthMetrics();
  });

  describe('Memory Health', () => {
    it('should collect memory metrics', () => {
      const health = collectRuntimeHealth();

      expect(health.memory).toBeDefined();
      expect(health.memory.heapUsed).toBeGreaterThan(0);
      expect(health.memory.heapTotal).toBeGreaterThan(0);
      expect(health.memory.rssMemory).toBeGreaterThan(0);
      expect(health.memory.heapUsedPercent).toBeGreaterThanOrEqual(0);
      expect(health.memory.heapUsedPercent).toBeLessThanOrEqual(100);
    });

    it('should calculate heap usage percentage', () => {
      const health = collectRuntimeHealth();

      const expectedPercent = (health.memory.heapUsed / health.memory.heapTotal) * 100;
      expect(health.memory.heapUsedPercent).toBeCloseTo(expectedPercent, 1);
    });
  });

  describe('Connection Pool Health', () => {
    it('should collect connection pool metrics', () => {
      const health = collectRuntimeHealth();

      expect(health.connectionPool).toBeDefined();
      expect(health.connectionPool.activeConnections).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.idleConnections).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.maxConnections).toBeGreaterThan(0);
      expect(health.connectionPool.saturationPercent).toBeGreaterThanOrEqual(0);
    });

    it('should calculate saturation percentage', () => {
      const health = collectRuntimeHealth();

      const expectedSaturation =
        (health.connectionPool.activeConnections / health.connectionPool.maxConnections) * 100;
      expect(health.connectionPool.saturationPercent).toBeCloseTo(expectedSaturation, 1);
    });
  });

  describe('Cache Health', () => {
    it('should collect cache metrics', () => {
      const health = collectRuntimeHealth();

      expect(health.cache).toBeDefined();
      expect(health.cache.entries).toBeGreaterThanOrEqual(0);
      expect(health.cache.locks).toBeGreaterThanOrEqual(0);
      expect(health.cache.memory).toBeGreaterThanOrEqual(0);
      expect(health.cache.hitRatio).toBeGreaterThanOrEqual(0);
      expect(health.cache.hitRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('Worker Health', () => {
    it('should collect worker metrics', () => {
      const health = collectRuntimeHealth();

      expect(health.worker).toBeDefined();
      expect(health.worker.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(health.worker.staleHeartbeatCount).toBeGreaterThanOrEqual(0);
      expect(health.worker.recoveryCount).toBeGreaterThanOrEqual(0);
      expect(health.worker.lockAcquisitionFailures).toBeGreaterThanOrEqual(0);
      expect(health.worker.unexpectedStops).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Health', () => {
    it('should track errors', () => {
      trackError('Test error', 'error');
      trackError('Test warning', 'warning');
      trackError('Test critical', 'critical');

      const health = collectRuntimeHealth();

      expect(health.error.recentErrors.length).toBe(3);
      expect(health.error.errorCount24h).toBe(3);
    });

    it('should track error severity', () => {
      trackError('Critical error', 'critical');

      const health = collectRuntimeHealth();

      expect(health.error.lastCriticalError).toBeDefined();
      expect(health.error.lastCriticalError?.message).toBe('Critical error');
    });

    it('should limit error log size', () => {
      // Track more than max errors
      for (let i = 0; i < 150; i++) {
        trackError(`Error ${i}`, 'error');
      }

      const health = collectRuntimeHealth();

      // Should keep only recent errors (max 100)
      expect(health.error.recentErrors.length).toBeLessThanOrEqual(10);
    });

    it('should calculate error rate', () => {
      trackError('Error 1', 'error');
      trackError('Error 2', 'error');

      const health = collectRuntimeHealth();

      expect(health.error.errorRate).toBeGreaterThan(0);
    });
  });

  describe('Process Health', () => {
    it('should collect process metrics', () => {
      const health = collectRuntimeHealth();

      expect(health.process).toBeDefined();
      expect(health.process.uptime).toBeGreaterThan(0);
      expect(health.process.cpuUsage).toBeDefined();
      expect(health.process.cpuUsage.user).toBeGreaterThanOrEqual(0);
      expect(health.process.cpuUsage.system).toBeGreaterThanOrEqual(0);
      expect(health.process.eventLoopLag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Loop Lag Tracking', () => {
    it('should track event loop lag', () => {
      trackEventLoopLag(5);
      trackEventLoopLag(10);
      trackEventLoopLag(15);

      const health = collectRuntimeHealth();

      expect(health.process.eventLoopLag).toBeGreaterThan(0);
      expect(health.process.eventLoopLag).toBeLessThanOrEqual(15);
    });

    it('should calculate average lag', () => {
      trackEventLoopLag(10);
      trackEventLoopLag(20);
      trackEventLoopLag(30);

      const health = collectRuntimeHealth();

      // Average should be 20
      expect(health.process.eventLoopLag).toBeCloseTo(20, 1);
    });
  });

  describe('Restart Tracking', () => {
    it('should track restarts', () => {
      recordRestart();
      recordRestart();

      const health = collectRuntimeHealth();

      expect(health.error.restartCount).toBe(2);
    });
  });

  describe('Complete Health Snapshot', () => {
    it('should collect all health metrics', () => {
      const health = collectRuntimeHealth();

      expect(health.timestamp).toBeGreaterThan(0);
      expect(health.memory).toBeDefined();
      expect(health.connectionPool).toBeDefined();
      expect(health.cache).toBeDefined();
      expect(health.worker).toBeDefined();
      expect(health.error).toBeDefined();
      expect(health.process).toBeDefined();
    });

    it('should have consistent timestamps', () => {
      const before = Date.now();
      const health = collectRuntimeHealth();
      const after = Date.now();

      expect(health.timestamp).toBeGreaterThanOrEqual(before);
      expect(health.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      trackError('Error', 'error');
      trackEventLoopLag(10);
      recordRestart();

      resetHealthMetrics();

      const health = collectRuntimeHealth();

      expect(health.error.recentErrors.length).toBe(0);
      expect(health.error.errorCount24h).toBe(0);
      expect(health.error.restartCount).toBe(0);
      expect(health.error.lastCriticalError).toBeNull();
    });
  });
});
