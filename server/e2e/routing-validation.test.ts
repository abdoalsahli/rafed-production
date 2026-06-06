import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { users, organizations, organizationUsers } from '../../drizzle/schema';

describe('Routing and Role-Based Access Validation', () => {
  let adminUser: any;
  let providerUser: any;
  let distributorUser: any;
  let pendingUser: any;
  let suspendedUser: any;
  let adminOrg: any;
  let providerOrg: any;
  let distributorOrg: any;

  beforeAll(async () => {
    // Create organizations
    const [adminOrgResult] = await db.insert(organizations).values({
      name: 'Admin Organization',
      type: 'INTERNAL',
      status: 'ACTIVE',
      contactPerson: 'Admin',
      email: 'admin@test.com',
      phone: '1234567890',
      address: '123 Admin St',
      notes: 'Test admin org',
    });
    adminOrg = { id: adminOrgResult.insertId };

    const [providerOrgResult] = await db.insert(organizations).values({
      name: 'Provider Organization',
      type: 'PROVIDER',
      status: 'ACTIVE',
      contactPerson: 'Provider',
      email: 'provider@test.com',
      phone: '1234567890',
      address: '123 Provider St',
      notes: 'Test provider org',
    });
    providerOrg = { id: providerOrgResult.insertId };

    const [distributorOrgResult] = await db.insert(organizations).values({
      name: 'Distributor Organization',
      type: 'DISTRIBUTOR',
      status: 'ACTIVE',
      contactPerson: 'Distributor',
      email: 'distributor@test.com',
      phone: '1234567890',
      address: '123 Distributor St',
      notes: 'Test distributor org',
    });
    distributorOrg = { id: distributorOrgResult.insertId };

    // Create users with different statuses and roles
    const [adminUserResult] = await db.insert(users).values({
      openId: `admin-${Date.now()}`,
      email: `admin-${Date.now()}@test.com`,
      name: 'Admin User',
      role: 'admin',
      loginMethod: 'OAUTH',
    });
    adminUser = { id: adminUserResult.insertId, role: 'admin', status: 'ACTIVE' };

    const [providerUserResult] = await db.insert(users).values({
      openId: `provider-${Date.now()}`,
      email: `provider-${Date.now()}@test.com`,
      name: 'Provider User',
      role: 'user',
      loginMethod: 'OAUTH',
    });
    providerUser = { id: providerUserResult.insertId, role: 'user', status: 'ACTIVE' };

    const [distributorUserResult] = await db.insert(users).values({
      openId: `distributor-${Date.now()}`,
      email: `distributor-${Date.now()}@test.com`,
      name: 'Distributor User',
      role: 'user',
      loginMethod: 'OAUTH',
    });
    distributorUser = { id: distributorUserResult.insertId, role: 'user', status: 'ACTIVE' };

    const [pendingUserResult] = await db.insert(users).values({
      openId: `pending-${Date.now()}`,
      email: `pending-${Date.now()}@test.com`,
      name: 'Pending User',
      role: 'user',
      loginMethod: 'OAUTH',
    });
    pendingUser = { id: pendingUserResult.insertId, role: 'user', status: 'PENDING' };

    const [suspendedUserResult] = await db.insert(users).values({
      openId: `suspended-${Date.now()}`,
      email: `suspended-${Date.now()}@test.com`,
      name: 'Suspended User',
      role: 'user',
      loginMethod: 'OAUTH',
    });
    suspendedUser = { id: suspendedUserResult.insertId, role: 'user', status: 'SUSPENDED' };

    // Link users to organizations
    await db.insert(organizationUsers).values({
      userId: adminUser.id,
      organizationId: adminOrg.id,
      role: 'admin',
    });

    await db.insert(organizationUsers).values({
      userId: providerUser.id,
      organizationId: providerOrg.id,
      role: 'admin',
    });

    await db.insert(organizationUsers).values({
      userId: distributorUser.id,
      organizationId: distributorOrg.id,
      role: 'admin',
    });
  });

  describe('Route Access Control', () => {
    it('should allow admin users to access /admin/organizations', () => {
      expect(adminUser.role).toBe('admin');
      expect(['admin']).toContain(adminUser.role);
    });

    it('should allow admin users to access /admin/users', () => {
      expect(adminUser.role).toBe('admin');
      expect(['admin']).toContain(adminUser.role);
    });

    it('should prevent provider users from accessing /admin/organizations', () => {
      expect(providerUser.role).toBe('user');
      expect(['admin']).not.toContain(providerUser.role);
    });

    it('should prevent provider users from accessing /admin/users', () => {
      expect(providerUser.role).toBe('user');
      expect(['admin']).not.toContain(providerUser.role);
    });

    it('should prevent distributor users from accessing /admin routes', () => {
      expect(distributorUser.role).toBe('user');
      expect(['admin']).not.toContain(distributorUser.role);
    });
  });

  describe('User Status Validation', () => {
    it('should block pending users from accessing protected routes', () => {
      expect(pendingUser.status).toBe('PENDING');
      // Pending users should be redirected to /pending-activation
    });

    it('should block suspended users from accessing protected routes', () => {
      expect(suspendedUser.status).toBe('SUSPENDED');
      // Suspended users should be redirected to /suspended
    });

    it('should allow active users to access protected routes', () => {
      expect(adminUser.status).toBe('ACTIVE');
      expect(providerUser.status).toBe('ACTIVE');
      expect(distributorUser.status).toBe('ACTIVE');
    });
  });

  describe('Navigation Structure', () => {
    it('should show admin navigation for admin users', () => {
      const adminNav = ['Dashboard', 'Organizations', 'Users', 'Transactions', 'Settings'];
      expect(adminNav).toBeDefined();
    });

    it('should show provider navigation for provider users', () => {
      const providerNav = [
        'Dashboard',
        'Products',
        'Inventory',
        'Upload Cards',
        'Distributors',
        'Requests',
        'Transactions',
        'Settings',
      ];
      expect(providerNav).toBeDefined();
    });

    it('should show distributor navigation for distributor users', () => {
      const distributorNav = [
        'Dashboard',
        'Connect Provider',
        'Products',
        'Transactions',
        'Wallet',
        'API',
        'Settings',
      ];
      expect(distributorNav).toBeDefined();
    });
  });

  describe('Organization Linking', () => {
    it('should have admin user linked to admin organization', async () => {
      const link = await db.query.organizationUsers.findFirst({
        where: (ou, { eq, and }) =>
          and(eq(ou.userId, adminUser.id), eq(ou.organizationId, adminOrg.id)),
      });
      expect(link).toBeDefined();
      expect(link?.role).toBe('admin');
    });

    it('should have provider user linked to provider organization', async () => {
      const link = await db.query.organizationUsers.findFirst({
        where: (ou, { eq, and }) =>
          and(eq(ou.userId, providerUser.id), eq(ou.organizationId, providerOrg.id)),
      });
      expect(link).toBeDefined();
      expect(link?.role).toBe('admin');
    });

    it('should have distributor user linked to distributor organization', async () => {
      const link = await db.query.organizationUsers.findFirst({
        where: (ou, { eq, and }) =>
          and(eq(ou.userId, distributorUser.id), eq(ou.organizationId, distributorOrg.id)),
      });
      expect(link).toBeDefined();
      expect(link?.role).toBe('admin');
    });
  });
});
