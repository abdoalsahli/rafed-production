#!/usr/bin/env node

import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function applyMigration() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('[Migration] Starting provider_code migration...');
    
    // Step 1: Add provider_code column
    console.log('[Migration] Adding provider_code column...');
    try {
      await connection.execute(
        'ALTER TABLE `service_providers` ADD `provider_code` varchar(32) DEFAULT NULL'
      );
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      console.log('[Migration] provider_code column already exists');
    }
    
    // Step 2: Generate unique codes for all providers with NULL codes
    console.log('[Migration] Generating provider codes...');
    const [providers] = await connection.execute(
      'SELECT id, name FROM service_providers WHERE provider_code IS NULL OR provider_code = ""'
    );
    
    const usedCodes = new Set();
    const [existingCodes] = await connection.execute(
      'SELECT provider_code FROM service_providers WHERE provider_code IS NOT NULL AND provider_code != ""'
    );
    
    for (const row of existingCodes) {
      usedCodes.add(row.provider_code);
    }
    
    for (const provider of providers) {
      let code;
      let attempts = 0;
      do {
        code = generateProviderCode(provider.id, provider.name, attempts);
        attempts++;
      } while (usedCodes.has(code) && attempts < 100);
      
      if (attempts >= 100) {
        console.error(`Failed to generate unique code for provider ${provider.id}`);
        continue;
      }
      
      await connection.execute(
        'UPDATE service_providers SET provider_code = ? WHERE id = ?',
        [code, provider.id]
      );
      usedCodes.add(code);
      console.log(`  Generated code for provider ${provider.id}: ${code}`);
    }
    
    // Step 3: Add unique constraint
    console.log('[Migration] Adding unique constraint...');
    try {
      await connection.execute(
        'ALTER TABLE `service_providers` ADD CONSTRAINT `service_providers_provider_code_unique` UNIQUE(`provider_code`)'
      );
    } catch (e) {
      if (e.code !== 'ER_DUP_KEY_NAME') throw e;
      console.log('[Migration] Unique constraint already exists');
    }
    
    // Step 4: Make column NOT NULL
    console.log('[Migration] Making provider_code NOT NULL...');
    await connection.execute(
      'ALTER TABLE `service_providers` MODIFY `provider_code` varchar(32) NOT NULL'
    );
    
    console.log('[Migration] ✓ Provider code migration completed successfully');
    
  } catch (error) {
    console.error('[Migration] Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

function generateProviderCode(id, name, attempt = 0) {
  // Generate a deterministic but unique code based on id, name, and attempt
  // Format: XXXX-XXXX (8 alphanumeric characters)
  const hash = crypto.createHash('md5').update(`${id}-${name}-${attempt}`).digest('hex');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    const charIndex = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 36;
    code += chars[charIndex];
  }
  
  return code;
}

applyMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
