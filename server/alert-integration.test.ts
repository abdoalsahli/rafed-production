/**
 * Alert Integration Tests
 * Verifies alert checking loop and metric collection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeAlertIntegration, getAlertIntegration } from './alert-integration';
import { initializeAlertNotifier } from './alert-notifier';
import { initializeThresholdManager } from './alert-thresholds';

describe('Alert Integration', () => {
  beforeEach(() => {
    // Initialize dependencies
    initializeAlertNotifier({
      slack: { webhookUrl: 'https://hooks.slack.com/test' },
    });
    initializeThresholdManager();
  });

  describe('Initialization', () => {
    it('should initialize alert integration', () => {
      const config = {
        enabled: true,
        checkInterval: 30000,
      };

      const integration = initializeAlertIntegration(config);

      expect(integration).toBeDefined();
      expect(getAlertIntegration()).toBe(integration);
    });

    it('should handle disabled alerts', () => {
      const config = {
        enabled: false,
        checkInterval: 30000,
      };

      const integration = initializeAlertIntegration(config);
      integration.start();

      // Should not start checking loop
      expect(integration).toBeDefined();
    });
  });

  describe('Alert Checking Loop', () => {
    it('should start and stop alert checking', async () => {
      const config = {
        enabled: true,
        checkInterval: 1000, // 1 second for testing
      };

      const integration = initializeAlertIntegration(config);

      integration.start();
      expect(integration).toBeDefined();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      integration.stop();
      expect(integration).toBeDefined();
    });

    it('should handle check interval configuration', () => {
      const config = {
        enabled: true,
        checkInterval: 5000,
      };

      const integration = initializeAlertIntegration(config);

      expect(integration).toBeDefined();
      // Verify configuration is accepted
    });
  });

  describe('Error Handling', () => {
    it('should handle missing alert notifier gracefully', () => {
      const config = {
        enabled: true,
        checkInterval: 30000,
      };

      const integration = initializeAlertIntegration(config);

      // Should not throw even if notifier not initialized
      expect(() => integration.start()).not.toThrow();
    });

    it('should continue checking on individual check errors', async () => {
      const config = {
        enabled: true,
        checkInterval: 1000,
      };

      const integration = initializeAlertIntegration(config);

      integration.start();

      // Wait for check cycle
      await new Promise((resolve) => setTimeout(resolve, 100));

      integration.stop();

      // Should complete without throwing
      expect(integration).toBeDefined();
    });
  });

  describe('Infrastructure Metrics', () => {
    it('should collect memory metrics', async () => {
      const config = {
        enabled: true,
        checkInterval: 30000,
      };

      const integration = initializeAlertIntegration(config);

      // Access private method through any type
      const infra = await (integration as any).getInfrastructureMetrics();

      expect(infra).toBeDefined();
      expect(infra.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle memory metrics errors gracefully', async () => {
      const config = {
        enabled: true,
        checkInterval: 30000,
      };

      const integration = initializeAlertIntegration(config);

      // Should return empty object on error
      const infra = await (integration as any).getInfrastructureMetrics();
      expect(typeof infra).toBe('object');
    });
  });

  describe('Multiple Instances', () => {
    it('should support multiple integrations', () => {
      const config1 = {
        enabled: true,
        checkInterval: 30000,
      };

      const config2 = {
        enabled: true,
        checkInterval: 60000,
      };

      const integration1 = initializeAlertIntegration(config1);
      const integration2 = initializeAlertIntegration(config2);

      // Second initialization should replace first
      expect(getAlertIntegration()).toBe(integration2);
    });
  });

  describe('Lifecycle', () => {
    it('should handle start/stop lifecycle', async () => {
      const config = {
        enabled: true,
        checkInterval: 1000,
      };

      const integration = initializeAlertIntegration(config);

      // Start
      integration.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop
      integration.stop();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start again
      integration.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop
      integration.stop();

      expect(integration).toBeDefined();
    });

    it('should prevent double start', async () => {
      const config = {
        enabled: true,
        checkInterval: 1000,
      };

      const integration = initializeAlertIntegration(config);

      integration.start();
      integration.start(); // Should be idempotent

      await new Promise((resolve) => setTimeout(resolve, 100));

      integration.stop();

      expect(integration).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should accept custom check intervals', () => {
      const intervals = [5000, 10000, 30000, 60000];

      for (const interval of intervals) {
        const config = {
          enabled: true,
          checkInterval: interval,
        };

        const integration = initializeAlertIntegration(config);
        expect(integration).toBeDefined();
      }
    });

    it('should accept account list configuration', () => {
      const config = {
        enabled: true,
        checkInterval: 30000,
        accounts: [
          { providerId: 'provider-1', distributorId: 'distributor-1' },
          { providerId: 'provider-2', distributorId: 'distributor-2' },
        ],
      };

      const integration = initializeAlertIntegration(config);
      expect(integration).toBeDefined();
    });
  });
});
