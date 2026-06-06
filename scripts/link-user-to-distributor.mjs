#!/usr/bin/env node

/**
 * Link a user to a distributor organization
 * Usage: DATABASE_URL=... node scripts/link-user-to-distributor.mjs <userId> [distributorOrgId]
 */

import mysql from 'mysql2/promise';
import { URL } from 'url';

const userId = parseInt(process.argv[2]);
const distributorOrgId = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!userId || isNaN(userId)) {
  console.error('Usage: node scripts/link-user-to-distributor.mjs <userId> [distributorOrgId]');
  process.exit(1);
}

function parseConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    const config = {
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.split('/')[1],
      port: url.port ? parseInt(url.port) : 3306,
    };
    
    // Handle SSL parameter
    const sslParam = url.searchParams.get('ssl');
    if (sslParam) {
      try {
        config.ssl = JSON.parse(sslParam);
      } catch {
        config.ssl = { rejectUnauthorized: false };
      }
    }
    
    return config;
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error.message);
    process.exit(1);
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const config = parseConnectionString(dbUrl);
  console.log(`Connecting to ${config.host}:${config.port}/${config.database}...`);

  const conn = await mysql.createConnection(config);

  try {
    // Get or create a distributor organization
    let orgId = distributorOrgId;
    
    if (!orgId) {
      // Find first distributor organization
      const [orgs] = await conn.execute(
        'SELECT id FROM organizations WHERE type = ? LIMIT 1',
        ['distributor']
      );
      
      if (orgs.length > 0) {
        orgId = orgs[0].id;
        console.log(`✅ Found distributor organization: ${orgId}`);
      } else {
        // Create a new distributor organization
        const [result] = await conn.execute(
          'INSERT INTO organizations (name, type, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          ['Test Distributor', 'distributor']
        );
        orgId = result.insertId;
        console.log(`✅ Created new distributor organization: ${orgId}`);
      }
    }

    // Check if user is already linked
    const [existing] = await conn.execute(
      'SELECT id FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [userId, orgId]
    );

    if (existing.length > 0) {
      console.log(`✅ User ${userId} is already linked to organization ${orgId}`);
    } else {
      // Link user to organization
      await conn.execute(
        'INSERT INTO organization_users (user_id, organization_id) VALUES (?, ?)',
        [userId, orgId]
      );
      console.log(`✅ Linked user ${userId} to distributor organization ${orgId}`);
    }

    // Verify the link
    const [verify] = await conn.execute(
      `SELECT ou.*, o.name, o.type 
       FROM organization_users ou 
       JOIN organizations o ON ou.organization_id = o.id 
       WHERE ou.user_id = ? AND o.type = 'distributor'`,
      [userId]
    );

    if (verify.length > 0) {
      console.log(`\n✅ Verification successful:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Organization: ${verify[0].name} (ID: ${verify[0].organization_id})`);
      console.log(`   Role: ${verify[0].role}`);
      console.log(`\n✅ User can now access the distributor purchase page.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
