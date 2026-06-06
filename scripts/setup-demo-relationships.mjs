#!/usr/bin/env node

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function setupDemoRelationships() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('Setting up demo relationships and accounts...\n');
    
    // Get demo providers and distributors
    const [providers] = await conn.execute(
      'SELECT id FROM service_providers WHERE provider_code LIKE ?',
      ['%1777407398700%']
    );
    
    const [distributors] = await conn.execute(
      'SELECT id FROM distributors WHERE name LIKE ?',
      ['%1777407398700%']
    );
    
    console.log(`Found ${providers.length} providers and ${distributors.length} distributors\n`);
    
    // Create relationships
    console.log('Creating provider-distributor relationships...');
    let relCount = 0;
    for (const provider of providers) {
      for (const distributor of distributors) {
        await conn.execute(
          'INSERT INTO provider_distributor_relationships (provider_id, distributor_id, commission_percentage, commission_type, credit_line, status) VALUES (?, ?, ?, ?, ?, ?)',
          [provider.id, distributor.id, 15, 'percentage', 50000, 'active']
        );
        relCount++;
      }
    }
    console.log(`✓ Created ${relCount} relationships\n`);
    
    // Create accounts
    console.log('Creating provider-distributor accounts...');
    let accCount = 0;
    for (const provider of providers) {
      for (const distributor of distributors) {
        try {
          await conn.execute(
            'INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit, version) VALUES (?, ?, ?, ?, ?, ?)',
            [provider.id, distributor.id, 100000, 50000, 0, 1]
          );
          accCount++;
        } catch (e) {
          if (!e.message.includes('Duplicate')) {
            throw e;
          }
        }
      }
    }
    console.log(`✓ Created ${accCount} accounts\n`);
    
    console.log('✅ Demo relationships and accounts setup complete');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

setupDemoRelationships();
