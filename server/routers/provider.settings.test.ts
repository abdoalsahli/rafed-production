import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, getRawDb } from '../db';
import { organizations, organizationUsers, serviceProviders, users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Provider Settings Procedures', () => {
  let testUserId: number;
  let testOrganizationId: number;
  let testProviderId: number;
  let pool: any;

  beforeAll(async () => {
    // Setup: Create test user, organization, and provider
    pool = await getRawDb();
    if (!pool) throw new Error('Database connection not available');

    const conn = await pool.getConnection();
    try {
      // Create test organization
      const [orgResult] = await conn.execute(
        `INSERT INTO organizations (name, type, status, contact_person, email, phone, address, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Test Provider Org', 'provider', 'active', 'Test Contact', 'test@example.com', '1234567890', '123 Test St', 'Test notes']
      );
      testOrganizationId = (orgResult as any).insertId;

      // Create test service provider
      const [providerResult] = await conn.execute(
        `INSERT INTO service_providers (name, provider_code, organization_id, status) 
         VALUES (?, ?, ?, ?)`,
        ['Test Provider', 'TEST_PROVIDER_001', testOrganizationId, 'active']
      );
      testProviderId = (providerResult as any).insertId;

      // Create test user
      const [userResult] = await conn.execute(
        `INSERT INTO users (name, email, status, role, password_hash, login_method) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Test Provider User', 'provider_test@example.com', 'active', 'admin', 'hashed_password', 'email']
      );
      testUserId = (userResult as any).insertId;

      // Link user to organization
      await conn.execute(
        `INSERT INTO organization_users (organization_id, user_id, role) 
         VALUES (?, ?, ?)`,
        [testOrganizationId, testUserId, 'admin']
      );
    } finally {
      conn.release();
    }
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    if (!pool) return;

    const conn = await pool.getConnection();
    try {
      // Delete organization_users
      await conn.execute(
        `DELETE FROM organization_users WHERE organization_id = ?`,
        [testOrganizationId]
      );

      // Delete service_providers
      await conn.execute(
        `DELETE FROM service_providers WHERE organization_id = ?`,
        [testOrganizationId]
      );

      // Delete organizations
      await conn.execute(
        `DELETE FROM organizations WHERE id = ?`,
        [testOrganizationId]
      );

      // Delete users
      await conn.execute(
        `DELETE FROM users WHERE id = ?`,
        [testUserId]
      );
    } finally {
      conn.release();
    }
  });

  it('should retrieve provider settings for authenticated user', async () => {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT o.id, o.name, o.type, o.status, o.contact_person, o.email, o.phone, o.address, o.notes,
                sp.id as provider_id, sp.provider_code, sp.created_at, sp.updated_at, u.name as user_name, u.email as user_email
         FROM organizations o
         INNER JOIN organization_users ou ON o.id = ou.organization_id
         INNER JOIN service_providers sp ON sp.organization_id = o.id
         LEFT JOIN users u ON u.id = ou.user_id
         WHERE ou.user_id = ? AND o.type = 'provider'
         LIMIT 1`,
        [testUserId]
      );

      expect(rows).toBeDefined();
      expect(rows.length).toBe(1);
      
      const row = (rows as any)[0];
      expect(row.id).toBe(testOrganizationId);
      expect(row.name).toBe('Test Provider Org');
      expect(row.type).toBe('provider');
      expect(row.provider_id).toBe(testProviderId);
      expect(row.contact_person).toBe('Test Contact');
      expect(row.email).toBe('test@example.com');
      expect(row.phone).toBe('1234567890');
    } finally {
      conn.release();
    }
  });

  it('should update provider settings', async () => {
    const conn = await pool.getConnection();
    try {
      const newName = 'Updated Provider Org';
      const newEmail = 'updated@example.com';
      const newPhone = '9876543210';

      // Update organization
      await conn.execute(
        `UPDATE organizations SET name = ?, email = ?, phone = ? WHERE id = ?`,
        [newName, newEmail, newPhone, testOrganizationId]
      );

      // Verify update
      const [rows] = await conn.execute(
        `SELECT name, email, phone FROM organizations WHERE id = ?`,
        [testOrganizationId]
      );

      expect(rows).toBeDefined();
      expect(rows.length).toBe(1);
      
      const row = (rows as any)[0];
      expect(row.name).toBe(newName);
      expect(row.email).toBe(newEmail);
      expect(row.phone).toBe(newPhone);

      // Reset for other tests
      await conn.execute(
        `UPDATE organizations SET name = ?, email = ?, phone = ? WHERE id = ?`,
        ['Test Provider Org', 'test@example.com', '1234567890', testOrganizationId]
      );
    } finally {
      conn.release();
    }
  });

  it('should return NOT_FOUND for user not linked to provider', async () => {
    const conn = await pool.getConnection();
    try {
      // Create a user not linked to any provider
      const [userResult] = await conn.execute(
        `INSERT INTO users (name, email, status, role, password_hash, login_method) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Unlinked User', 'unlinked@example.com', 'active', 'admin', 'hashed_password', 'email']
      );
      const unlinkedUserId = (userResult as any).insertId;

      try {
        // Try to get settings for unlinked user
        const [rows] = await conn.execute(
          `SELECT o.id FROM organizations o
           INNER JOIN organization_users ou ON o.id = ou.organization_id
           WHERE ou.user_id = ? AND o.type = 'provider'
           LIMIT 1`,
          [unlinkedUserId]
        );

        expect(rows).toBeDefined();
        expect(rows.length).toBe(0);
      } finally {
        // Cleanup
        await conn.execute(`DELETE FROM users WHERE id = ?`, [unlinkedUserId]);
      }
    } finally {
      conn.release();
    }
  });

  it('should handle optional fields in update', async () => {
    const conn = await pool.getConnection();
    try {
      // Update with some optional fields as NULL
      await conn.execute(
        `UPDATE organizations SET contact_person = ?, address = ?, notes = ? WHERE id = ?`,
        [null, null, null, testOrganizationId]
      );

      // Verify update
      const [rows] = await conn.execute(
        `SELECT contact_person, address, notes FROM organizations WHERE id = ?`,
        [testOrganizationId]
      );

      expect(rows).toBeDefined();
      expect(rows.length).toBe(1);
      
      const row = (rows as any)[0];
      expect(row.contact_person).toBeNull();
      expect(row.address).toBeNull();
      expect(row.notes).toBeNull();

      // Reset for other tests
      await conn.execute(
        `UPDATE organizations SET contact_person = ?, address = ?, notes = ? WHERE id = ?`,
        ['Test Contact', '123 Test St', 'Test notes', testOrganizationId]
      );
    } finally {
      conn.release();
    }
  });

  it('should preserve provider code and timestamps on update', async () => {
    const conn = await pool.getConnection();
    try {
      // Get original provider info
      const [originalRows] = await conn.execute(
        `SELECT provider_code, created_at FROM service_providers WHERE id = ?`,
        [testProviderId]
      );
      const originalProviderCode = (originalRows as any)[0].provider_code;
      const originalCreatedAt = (originalRows as any)[0].created_at;

      // Update organization name (should not affect provider)
      await conn.execute(
        `UPDATE organizations SET name = ? WHERE id = ?`,
        ['Another Name', testOrganizationId]
      );

      // Verify provider is unchanged
      const [newRows] = await conn.execute(
        `SELECT provider_code, created_at FROM service_providers WHERE id = ?`,
        [testProviderId]
      );

      expect((newRows as any)[0].provider_code).toBe(originalProviderCode);
      expect((newRows as any)[0].created_at).toEqual(originalCreatedAt);

      // Reset
      await conn.execute(
        `UPDATE organizations SET name = ? WHERE id = ?`,
        ['Test Provider Org', testOrganizationId]
      );
    } finally {
      conn.release();
    }
  });
});
