#!/usr/bin/env node

/**
 * Debug script to investigate distributor connections and transactions
 * Usage: node scripts/debug-distributor.mjs <distributorOrgId> [userId]
 */

import mysql from 'mysql2/promise';
import { URL } from 'url';

const distributorOrgId = parseInt(process.argv[2]);
const userId = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!distributorOrgId || isNaN(distributorOrgId)) {
  console.error('Usage: node scripts/debug-distributor.mjs <distributorOrgId> [userId]');
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
  const conn = await mysql.createConnection(config);

  try {
    console.log(`\n📊 Debugging Distributor Organization ID: ${distributorOrgId}\n`);

    // 1. Get distributor organization info
    console.log('1️⃣  DISTRIBUTOR ORGANIZATION:');
    const [orgRows] = await conn.execute(
      'SELECT id, name, type FROM organizations WHERE id = ?',
      [distributorOrgId]
    );
    if (orgRows.length > 0) {
      console.log(`   ✅ Name: ${orgRows[0].name}`);
      console.log(`   ✅ Type: ${orgRows[0].type}`);
    } else {
      console.log('   ❌ Organization not found');
    }

    // 2. Get distributor record
    console.log('\n2️⃣  DISTRIBUTOR RECORD:');
    const [distRows] = await conn.execute(
      'SELECT id, organization_id FROM distributors WHERE organization_id = ?',
      [distributorOrgId]
    );
    if (distRows.length > 0) {
      console.log(`   ✅ Distributor ID: ${distRows[0].id}`);
      console.log(`   ✅ Organization ID: ${distRows[0].organization_id}`);
    } else {
      console.log('   ❌ No distributor record found for this organization');
    }

    // 3. Get users linked to this organization
    console.log('\n3️⃣  LINKED USERS:');
    const [userRows] = await conn.execute(
      `SELECT ou.user_id, u.name, u.email, ou.role 
       FROM organization_users ou 
       JOIN users u ON ou.user_id = u.id 
       WHERE ou.organization_id = ?`,
      [distributorOrgId]
    );
    if (userRows.length > 0) {
      console.log(`   ✅ Found ${userRows.length} user(s):`);
      userRows.forEach(row => {
        const marker = userId && row.user_id === userId ? '👤' : '  ';
        console.log(`   ${marker} ID: ${row.user_id}, Name: ${row.name}, Email: ${row.email}, Role: ${row.role}`);
      });
    } else {
      console.log('   ❌ No users linked to this organization');
    }

    // 4. Get connected providers
    console.log('\n4️⃣  CONNECTED PROVIDERS:');
    const [providerRows] = await conn.execute(
      `SELECT pdr.id, pdr.provider_id, sp.name, pdr.status, pdr.created_at
       FROM provider_distributor_relationships pdr
       JOIN service_providers sp ON pdr.provider_id = sp.id
       WHERE pdr.distributor_id = ?
       ORDER BY pdr.created_at DESC`,
      [distRows.length > 0 ? distRows[0].id : null]
    );
    if (providerRows.length > 0) {
      console.log(`   ✅ Found ${providerRows.length} provider connection(s):`);
      providerRows.forEach(row => {
        console.log(`      - Provider: ${row.name} (ID: ${row.provider_id}), Status: ${row.status}, Connected: ${row.created_at}`);
      });
    } else {
      console.log('   ❌ No provider connections found');
    }

    // 5. Get available products
    console.log('\n5️⃣  AVAILABLE PRODUCTS:');
    if (distRows.length > 0 && providerRows.length > 0) {
      const [productRows] = await conn.execute(
        `SELECT p.id, p.name, p.face_value, p.currency, sp.name as provider_name, COUNT(c.id) as card_count
         FROM products p
         JOIN service_providers sp ON p.provider_id = sp.id
         JOIN provider_distributor_relationships pdr ON sp.id = pdr.provider_id
         LEFT JOIN cards c ON p.id = c.product_id AND c.status = 'AVAILABLE'
         WHERE pdr.distributor_id = ? AND pdr.status = 'active' AND p.status = 'active'
         GROUP BY p.id
         LIMIT 20`,
        [distRows[0].id]
      );
      if (productRows.length > 0) {
        console.log(`   ✅ Found ${productRows.length} active product(s):`);
        productRows.forEach(row => {
          console.log(`      - ${row.name} (${row.face_value} ${row.currency}) from ${row.provider_name}, Available cards: ${row.card_count}`);
        });
      } else {
        console.log('   ❌ No active products found');
      }
    } else {
      console.log('   ⚠️  Cannot check products - no distributor or provider connections');
    }

    // 6. Get transactions
    console.log('\n6️⃣  TRANSACTIONS:');
    if (distRows.length > 0) {
      const [txRows] = await conn.execute(
        `SELECT t.id, t.type, t.status, t.amount, t.created_at, sp.name as provider_name
         FROM transactions t
         LEFT JOIN service_providers sp ON t.provider_id = sp.id
         WHERE t.distributor_id = ?
         ORDER BY t.created_at DESC
         LIMIT 10`,
        [distRows[0].id]
      );
      if (txRows.length > 0) {
        console.log(`   ✅ Found ${txRows.length} transaction(s):`);
        txRows.forEach(row => {
          console.log(`      - Type: ${row.type}, Status: ${row.status}, Amount: ${row.amount}, Provider: ${row.provider_name}, Date: ${row.created_at}`);
        });
      } else {
        console.log('   ❌ No transactions found');
      }
    }

    // 7. Get financial accounts
    console.log('\n7️⃣  FINANCIAL ACCOUNTS:');
    if (distRows.length > 0) {
      const [acctRows] = await conn.execute(
        `SELECT pda.id, pda.balance, pda.used_credit, sp.name as provider_name
         FROM provider_distributor_accounts pda
         JOIN service_providers sp ON pda.provider_id = sp.id
         WHERE pda.distributor_id = ?`,
        [distRows[0].id]
      );
      if (acctRows.length > 0) {
        console.log(`   ✅ Found ${acctRows.length} financial account(s):`);
        acctRows.forEach(row => {
          console.log(`      - Provider: ${row.provider_name}, Balance: ${row.balance}, Used Credit: ${row.used_credit}`);
        });
      } else {
        console.log('   ❌ No financial accounts found');
      }
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
