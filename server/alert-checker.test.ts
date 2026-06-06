/**
 * Alert Checker Tests
 * Verifies alert thresholds and triggering logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAlertChecker } from './alert-checker';
import { getThresholdManager, DEFAULT_THRESHOLDS, EARLY_PRODUCTION_THRESHOLDS } from './alert-thresholds';
import { getAlertNotifier, initializeAlertNotifier } from './alert-notifier';

describe('Alert Checker', () => {
  beforeEach(() => {
    // Initialize alert notifier with mock
    initializeAlertNotifier({
      slack: { webhookUrl: 'https://hooks.slack.com/test' },
    });
  });

  describe('Infrastructure Alerts', () => {
    it('should trigger connection pool saturation warning', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        connectionPoolActive: 40,
        connectionPoolMax: 50,
      };

      await checker.checkMetrics(snapshot);

      // Should trigger warning (80% threshold)
      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('warning');
      expect(call?.category).toBe('infrastructure');
    });

    it('should trigger memory usage critical alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        memoryUsage: 850 * 1024 * 1024, // 850MB
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('memory');
    });
  });

  describe('Queue Operation Alerts', () => {
    it('should trigger queue depth warning', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        queueDepth: 6000,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('warning');
      expect(call?.title).toContain('Queue depth');
    });

    it('should trigger queue depth critical alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        queueDepth: 9000,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('critical');
    });

    it('should trigger stale worker heartbeat alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        workerHeartbeatStale: true,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('heartbeat');
    });

    it('should trigger recovery count spike alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        recoveryCount: 6,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('warning');
      expect(call?.title).toContain('Recovery');
    });
  });

  describe('Performance Alerts', () => {
    it('should trigger P95 processing duration warning', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        processingDurationP95: 2500,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('warning');
      expect(call?.title).toContain('P95');
    });

    it('should trigger P99 processing duration critical alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        processingDurationP99: 6000,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('P99');
    });

    it('should trigger P99 queue wait critical alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        queueWaitP99: 3500,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('queue wait');
    });
  });

  describe('Financial Integrity Alerts', () => {
    it('should trigger ledger mismatch critical alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        ledgerMismatch: true,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('Ledger');
    });

    it('should trigger failed purchases spike warning', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        failedPurchases: 25,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('warning');
      expect(call?.title).toContain('spike');
    });

    it('should trigger failed purchase rate critical alert', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        failedPurchases: 15,
        totalPurchases: 100,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).toHaveBeenCalled();
      const call = notifySpy.mock.calls[0]?.[0];
      expect(call?.severity).toBe('critical');
      expect(call?.title).toContain('rate');
    });
  });

  describe('Threshold Management', () => {
    it('should use default thresholds', () => {
      const manager = getThresholdManager();
      const thresholds = manager.getThresholds('provider-1', 'distributor-1');

      expect(thresholds.queueDepth.warning).toBe(DEFAULT_THRESHOLDS.queueDepth.warning);
      expect(thresholds.queueDepth.critical).toBe(DEFAULT_THRESHOLDS.queueDepth.critical);
    });

    it('should support early production thresholds', () => {
      const manager = getThresholdManager();
      manager.setDefaults(EARLY_PRODUCTION_THRESHOLDS);

      const thresholds = manager.getThresholds('provider-1', 'distributor-1');

      expect(thresholds.queueDepth.warning).toBe(EARLY_PRODUCTION_THRESHOLDS.queueDepth.warning);
      expect(thresholds.queueDepth.warning).toBeLessThan(DEFAULT_THRESHOLDS.queueDepth.warning);
    });

    it('should support per-account overrides', () => {
      const manager = getThresholdManager();
      manager.setDefaults(DEFAULT_THRESHOLDS);

      manager.setAccountOverrides('provider-1', 'distributor-1', {
        queueDepth: {
          warning: 10000,
          critical: 15000,
        },
      });

      const thresholds = manager.getThresholds('provider-1', 'distributor-1');
      expect(thresholds.queueDepth.warning).toBe(10000);

      // Other account should use defaults
      const otherThresholds = manager.getThresholds('provider-2', 'distributor-2');
      expect(otherThresholds.queueDepth.warning).toBe(DEFAULT_THRESHOLDS.queueDepth.warning);
    });

    it('should clear account overrides', () => {
      const manager = getThresholdManager();
      manager.setDefaults(DEFAULT_THRESHOLDS);

      manager.setAccountOverrides('provider-1', 'distributor-1', {
        queueDepth: { warning: 10000, critical: 15000 },
      });

      manager.clearAccountOverrides('provider-1', 'distributor-1');

      const thresholds = manager.getThresholds('provider-1', 'distributor-1');
      expect(thresholds.queueDepth.warning).toBe(DEFAULT_THRESHOLDS.queueDepth.warning);
    });
  });

  describe('No False Positives', () => {
    it('should not alert when metrics are below thresholds', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        queueDepth: 1000, // Well below warning
        processingDurationP95: 500, // Well below warning
        failedPurchases: 2, // Well below warning
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).not.toHaveBeenCalled();
    });

    it('should not alert for healthy metrics', async () => {
      const checker = getAlertChecker();
      const notifier = getAlertNotifier();
      const notifySpy = vi.spyOn(notifier, 'notify');

      const snapshot = {
        timestamp: Date.now(),
        providerId: 'test-provider',
        distributorId: 'test-distributor',
        connectionPoolActive: 10,
        connectionPoolMax: 50,
        memoryUsage: 200 * 1024 * 1024,
        queueDepth: 100,
        oldestPendingAge: 10,
        processingDurationP95: 100,
        processingDurationP99: 200,
        queueWaitP95: 50,
        queueWaitP99: 100,
        ledgerMismatch: false,
        failedPurchases: 0,
        totalPurchases: 100,
      };

      await checker.checkMetrics(snapshot);

      expect(notifySpy).not.toHaveBeenCalled();
    });
  });
});
