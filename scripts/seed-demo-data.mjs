#!/usr/bin/env node

/**
 * Demo Data Seeding Script
 * 
 * This script seeds realistic demo data for client demonstrations:
 * - Demo providers (Libyana, Almadar, LTT, Connect, Giga)
 * - Demo distributors with active relationships
 * - Demo products (5, 10, 20, 50, 75 LYD cards)
 * - Demo inventory (cards in AVAILABLE status)
 * - Demo transaction history
 * - Demo API credentials
 * 
 * Usage: node scripts/seed-demo-data.mjs
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

// Parse DATABASE_URL (format: mysql://user:password@host:port/database)
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Demo data
const DEMO_TIMESTAMP = Date.now();
const DEMO_PROVIDERS = [
  { name: 'Libyana', code: `LIBYANA_${DEMO_TIMESTAMP}` },
  { name: 'Almadar', code: `ALMADAR_${DEMO_TIMESTAMP}` },
  { name: 'LTT', code: `LTT_${DEMO_TIMESTAMP}` },
  { name: 'Connect', code: `CONNECT_${DEMO_TIMESTAMP}` },
  { name: 'Giga', code: `GIGA_${DEMO_TIMESTAMP}` },
];

const DEMO_DISTRIBUTORS = [
  { name: `Demo Distributor 1 - ${DEMO_TIMESTAMP}` },
  { name: `Demo Distributor 2 - ${DEMO_TIMESTAMP}` },
  { name: `Demo Distributor 3 - ${DEMO_TIMESTAMP}` },
];

const PRODUCT_DENOMINATIONS = [5, 10, 20, 50, 75]; // LYD

async function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function generateApiKey() {
  const keyId = `sk_live_${crypto.randomBytes(16).toString('hex')}`;
  const secret = crypto.randomBytes(32).toString('hex');
  const masked = `sk_live_${secret.slice(-12)}`;
  return { keyId, secret, masked };
}

async function seedDemoData() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('🌱 Starting demo data seeding...\n');

    // 1. Seed Providers
    console.log('📦 Seeding providers...');
    const providers = {};
    for (const provider of DEMO_PROVIDERS) {
      const [result] = await connection.execute(
        'INSERT INTO service_providers (name, provider_code, status) VALUES (?, ?, ?)',
        [provider.name, provider.code, 'active']
      );
      providers[provider.code] = result.insertId;
      console.log(`  ✓ ${provider.name} (ID: ${result.insertId})`);
    }

    // 2. Seed Distributors
    console.log('\n👥 Seeding distributors...');
    const distributors = {};
    for (const dist of DEMO_DISTRIBUTORS) {
      const [result] = await connection.execute(
        'INSERT INTO distributors (name, status) VALUES (?, ?)',
        [dist.name, 'active']
      );
      distributors[dist.name] = result.insertId;
      console.log(`  ✓ ${dist.name} (ID: ${result.insertId})`);
    }

    // 3. Seed Products
    console.log('\n💳 Seeding products...');
    const products = {};
    for (const [code, providerId] of Object.entries(providers)) {
      products[code] = {};
      for (const denom of PRODUCT_DENOMINATIONS) {
        const [result] = await connection.execute(
          'INSERT INTO products (provider_id, name, display_name, face_value, currency, price, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            providerId,
            `${denom} LYD Card`,
            `${denom} LYD`,
            denom,
            'LYD',
            denom * 1.05, // 5% markup
            'active',
            1,
          ]
        );
        products[code][denom] = result.insertId;
        console.log(`  ✓ ${code}: ${denom} LYD card (ID: ${result.insertId})`);
      }
    }

    // 4. Create Provider-Distributor Relationships
    console.log('\n🔗 Creating provider-distributor relationships...');
    const relationships = {};
    for (const [code, providerId] of Object.entries(providers)) {
      for (const [distName, distributorId] of Object.entries(distributors)) {
        // Create access request
        const [accessResult] = await connection.execute(
          'INSERT INTO access_requests (provider_id, distributor_id, requested_credit_line, status) VALUES (?, ?, ?, ?)',
          [providerId, distributorId, 50000, 'approved']
        );

        // Create relationship
        const [relResult] = await connection.execute(
          'INSERT INTO provider_distributor_relationships (provider_id, distributor_id, commission_rate, credit_line, used_credit, allow_credit, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [providerId, distributorId, 15, 50000, 0, 1, 'active']
        );

        // Create account
        await connection.execute(
          'INSERT INTO provider_distributor_accounts (provider_id, distributor_id, balance, credit_line, used_credit) VALUES (?, ?, ?, ?, ?)',
          [providerId, distributorId, 100000, 50000, 0]
        );

        relationships[`${code}-${distName}`] = relResult.insertId;
        console.log(`  ✓ ${code} ↔ ${distName}`);
      }
    }

    // 5. Seed Cards (Inventory)
    console.log('\n📚 Seeding card inventory...');
    let totalCards = 0;
    for (const [code, providerId] of Object.entries(providers)) {
      for (const denom of PRODUCT_DENOMINATIONS) {
        const productId = products[code][denom];
        const cardsPerDenom = 50; // 50 cards per denomination per provider

        for (let i = 0; i < cardsPerDenom; i++) {
          // Generate fake encrypted PIN (in real scenario, this would be actual encrypted data)
          const fakePin = crypto.randomBytes(32).toString('hex');

          await connection.execute(
            'INSERT INTO cards (provider_id, product_id, pin_encrypted, status) VALUES (?, ?, ?, ?)',
            [providerId, productId, fakePin, 'AVAILABLE']
          );
        }

        totalCards += cardsPerDenom;
        console.log(`  ✓ ${code}: ${cardsPerDenom} × ${denom} LYD cards`);
      }
    }
    console.log(`  Total: ${totalCards} cards seeded`);

    // 6. Seed Transaction History
    console.log('\n📊 Seeding transaction history...');
    let transactionCount = 0;
    for (const [code, providerId] of Object.entries(providers)) {
      for (const [distName, distributorId] of Object.entries(distributors)) {
        // Create 5 sample transactions per provider-distributor pair
        for (let i = 0; i < 5; i++) {
          const denom = PRODUCT_DENOMINATIONS[Math.floor(Math.random() * PRODUCT_DENOMINATIONS.length)];
          const productId = products[code][denom];
          const amount = denom;
          const commissionAmount = (amount * 0.15).toFixed(2); // 15% commission

          // Get a random available card
          const [cards] = await connection.execute(
            'SELECT id FROM cards WHERE provider_id = ? AND product_id = ? AND status = "AVAILABLE" LIMIT 1',
            [providerId, productId]
          );

          if (cards.length > 0) {
            const cardId = cards[0].id;
            const idempotencyKey = `demo_${code}_${distName}_${i}_${Date.now()}`;

            await connection.execute(
              'INSERT INTO transactions (idempotency_key, distributor_id, provider_id, product_id, card_id, amount, commission_amount, transaction_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                idempotencyKey,
                distributorId,
                providerId,
                productId,
                cardId,
                amount,
                commissionAmount,
                'purchase',
                'completed',
                new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
              ]
            );

            // Mark card as SOLD
            await connection.execute(
              'UPDATE cards SET status = "SOLD" WHERE id = ?',
              [cardId]
            );

            transactionCount++;
          }
        }
      }
    }
    console.log(`  ✓ ${transactionCount} transactions created`);

    // 7. Seed API Credentials
    console.log('\n🔑 Seeding API credentials...');
    for (const [distName, distributorId] of Object.entries(distributors)) {
      const { keyId, secret, masked } = generateApiKey();
      const secretHash = await hashSecret(secret);

      await connection.execute(
        'INSERT INTO distributor_api_credentials (distributor_id, key_id, masked_key, secret_hash, status, webhook_url) VALUES (?, ?, ?, ?, ?, ?)',
        [
          distributorId,
          keyId,
          masked,
          secretHash,
          'active',
          `https://demo.example.com/webhooks/${distName.replace(/\s+/g, '-').toLowerCase()}`,
        ]
      );

      console.log(`  ✓ ${distName}: ${masked}`);
      console.log(`    Full secret (save securely): ${secret}`);
    }

    console.log('\n✅ Demo data seeding completed successfully!\n');
    console.log('📋 Demo Accounts Summary:');
    console.log('─'.repeat(50));
    console.log('\nProviders:');
    Object.entries(providers).forEach(([code, id]) => {
      console.log(`  • ${code} (ID: ${id})`);
    });

    console.log('\nDistributors:');
    Object.entries(distributors).forEach(([name, id]) => {
      console.log(`  • ${name} (ID: ${id})`);
    });

    console.log('\nProvider-Distributor Relationships:');
    Object.entries(relationships).forEach(([rel, id]) => {
      console.log(`  • ${rel} (ID: ${id})`);
    });

    console.log('\n💡 Next steps:');
    console.log('  1. Log in as a distributor to view the dashboard');
    console.log('  2. Navigate to Provider Accounts to see relationships');
    console.log('  3. Try making a purchase from the Products page');
    console.log('  4. Check the Transactions page for history');
    console.log('  5. View API credentials on the API page');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run the seeding
seedDemoData();
