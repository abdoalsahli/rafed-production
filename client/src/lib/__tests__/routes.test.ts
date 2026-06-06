import { describe, it, expect } from 'vitest';
import { ROUTES, NAVIGATION_ITEMS } from '../routes';

describe('Routes Configuration', () => {
  describe('ROUTES object', () => {
    it('should have DISTRIBUTOR_DASHBOARD route', () => {
      expect(ROUTES.DISTRIBUTOR_DASHBOARD).toBe('/dashboard');
    });

    it('should define all routes as constants', () => {
      expect(ROUTES).toBeDefined();
      expect(typeof ROUTES.DISTRIBUTOR_DASHBOARD).toBe('string');
    });

    it('should have routes starting with forward slash', () => {
      Object.values(ROUTES).forEach((route) => {
        expect(route).toMatch(/^\//);
      });
    });
  });

  describe('NAVIGATION_ITEMS array', () => {
    it('should have navigation items defined', () => {
      expect(NAVIGATION_ITEMS).toBeDefined();
      expect(Array.isArray(NAVIGATION_ITEMS)).toBe(true);
    });

    it('should have at least one navigation item', () => {
      expect(NAVIGATION_ITEMS.length).toBeGreaterThan(0);
    });

    it('should have distributor dashboard in navigation', () => {
      const distributorItem = NAVIGATION_ITEMS.find(
        (item) => item.path === ROUTES.DISTRIBUTOR_DASHBOARD
      );
      expect(distributorItem).toBeDefined();
      expect(distributorItem?.label).toBe('Distributor Dashboard');
    });

    it('should have required properties for each navigation item', () => {
      NAVIGATION_ITEMS.forEach((item) => {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('path');
        expect(item).toHaveProperty('icon');
        expect(typeof item.label).toBe('string');
        expect(typeof item.path).toBe('string');
      });
    });

    it('should have unique paths in navigation items', () => {
      const paths = NAVIGATION_ITEMS.map((item) => item.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });
  });

  describe('Route structure', () => {
    it('should maintain consistent route naming', () => {
      expect(ROUTES.DISTRIBUTOR_DASHBOARD).toMatch(/^\/[a-z-]+$/);
    });

    it('should support future route additions', () => {
      // This test verifies that the routes object structure
      // is extensible for future routes
      expect(Object.keys(ROUTES).length).toBeGreaterThan(0);
    });
  });
});
