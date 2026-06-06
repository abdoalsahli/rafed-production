import { describe, it, expect } from 'vitest';
import { getRoleDashboardPath, getPostLoginRedirectPath } from './roleRedirect';

describe('roleRedirect', () => {
  describe('getRoleDashboardPath', () => {
    it('should return admin dashboard for admin role', () => {
      expect(getRoleDashboardPath('admin')).toBe('/admin/organizations');
    });

    it('should return provider dashboard for provider role', () => {
      expect(getRoleDashboardPath('provider')).toBe('/provider/dashboard');
    });

    it('should return distributor dashboard for distributor role', () => {
      expect(getRoleDashboardPath('distributor')).toBe('/distributor/dashboard');
    });

    it('should return fallback dashboard for unknown role', () => {
      expect(getRoleDashboardPath('unknown')).toBe('/admin/organizations');
    });

    it('should return fallback dashboard for null role', () => {
      expect(getRoleDashboardPath(null)).toBe('/admin/organizations');
    });

    it('should return fallback dashboard for undefined role', () => {
      expect(getRoleDashboardPath(undefined)).toBe('/admin/organizations');
    });

    it('should return fallback dashboard for empty string role', () => {
      expect(getRoleDashboardPath('')).toBe('/admin/organizations');
    });
  });

  describe('getPostLoginRedirectPath', () => {
    it('should redirect to pending-activation for pending status', () => {
      const user = { role: 'admin', status: 'PENDING' };
      expect(getPostLoginRedirectPath(user)).toBe('/pending-activation');
    });

    it('should redirect to pending-activation for lowercase pending status', () => {
      const user = { role: 'admin', status: 'pending' };
      expect(getPostLoginRedirectPath(user)).toBe('/pending-activation');
    });

    it('should redirect to suspended for suspended status', () => {
      const user = { role: 'admin', status: 'SUSPENDED' };
      expect(getPostLoginRedirectPath(user)).toBe('/suspended');
    });

    it('should redirect to suspended for lowercase suspended status', () => {
      const user = { role: 'admin', status: 'suspended' };
      expect(getPostLoginRedirectPath(user)).toBe('/suspended');
    });

    it('should redirect to admin dashboard for active admin user', () => {
      const user = { role: 'admin', status: 'ACTIVE' };
      expect(getPostLoginRedirectPath(user)).toBe('/admin/organizations');
    });

    it('should redirect to provider dashboard for active provider user', () => {
      const user = { role: 'provider', status: 'ACTIVE' };
      expect(getPostLoginRedirectPath(user)).toBe('/provider/dashboard');
    });

    it('should redirect to distributor dashboard for active distributor user', () => {
      const user = { role: 'distributor', status: 'ACTIVE' };
      expect(getPostLoginRedirectPath(user)).toBe('/distributor/dashboard');
    });

    it('should redirect to dashboard for user without status field', () => {
      const user = { role: 'admin' };
      expect(getPostLoginRedirectPath(user)).toBe('/admin/organizations');
    });

    it('should redirect to fallback dashboard for user without role', () => {
      const user = { status: 'ACTIVE' };
      expect(getPostLoginRedirectPath(user)).toBe('/admin/organizations');
    });

    it('should redirect to fallback dashboard for empty user object', () => {
      const user = {};
      expect(getPostLoginRedirectPath(user)).toBe('/admin/organizations');
    });

    it('should redirect to fallback dashboard for null user', () => {
      expect(getPostLoginRedirectPath(null)).toBe('/admin/organizations');
    });

    it('should redirect to fallback dashboard for undefined user', () => {
      expect(getPostLoginRedirectPath(undefined)).toBe('/admin/organizations');
    });
  });
});
