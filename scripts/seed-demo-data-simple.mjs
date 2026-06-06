import mysql from 'mysql2/promise';
import crypto from 'crypto';

/**
 * Simplified Demo Data Seeding Script
 * 
 * This script seeds realistic demo data for client demonstrations:
 * - Demo organizations (provider + distributor)
 * - Demo users linked to organizations
 * - Demo providers (Libyana, Almadar, LTT, Connect, Giga)
 * - Demo distributors
 * - Demo products (5, 10, 20, 50, 75 LYD cards)
 * - Demo inventory (cards in AVAILABLE status)
 * - Demo API credentials
 * 
 * Usage: node scripts/seed-demo-data-simple.mjs
 */

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
    console.log('🌱 Starting simplified demo data seeding...\n');

    // CLEANUP: Remove old demo users with random openIds to ensure we use the stable ones
    console.log('🧹 Cleaning up old demo users...');
    const [oldUsers] = await connection.execute(
      'SELECT id FROM users WHERE email IN (?, ?) AND login_method = ? AND open_id NOT IN (?, ?)',
      ['demo-provider@example.com', 'demo-distributor@example.com', 'demo', 'demo-provider-openid', 'demo-distributor-openid']
    );
    
    if (oldUsers.length > 0) {
      for (const user of oldUsers) {
        // Delete organization links first
        await connection.execute('DELETE FROM organization_users WHERE user_id = ?', [user.id]);
        // Delete user extended records
        await connection.execute('DELETE FROM users_extended WHERE user_id = ?', [user.id]);
        // Delete user
        await connection.execute('DELETE FROM users WHERE id = ?', [user.id]);
      }
      console.log(`  ✓ Cleaned up ${oldUsers.length} old demo user(s)`);
    } else {
      console.log('  ✓ No old demo users to clean up');
    }

    // 0. Create Demo Users with stable openId values
    console.log('\n👤 Creating/linking demo users...');
    const demoUsers = [
      { email: 'demo-provider@example.com', name: 'Demo Provider User', role: 'user', openId: 'demo-provider-openid' },
      { email: 'demo-distributor@example.com', name: 'Demo Distributor User', role: 'user', openId: 'demo-distributor-openid' },
    ];
    
    const userIds = {};
    const userOpenIds = {};
    for (const user of demoUsers) {
      // Check if user exists by openId (stable identifier)
      const [existing] = await connection.execute(
        'SELECT id, open_id FROM users WHERE open_id = ?',
        [user.openId]
      );
      
      if (existing.length > 0) {
        userIds[user.email] = existing[0].id;
        userOpenIds[user.email] = existing[0].open_id;
        console.log(`  ✓ User ${user.email} already exists (ID: ${existing[0].id}, openId: ${existing[0].open_id})`);
      } else {
        const [result] = await connection.execute(
          'INSERT INTO users (email, name, role, open_id, login_method) VALUES (?, ?, ?, ?, ?)',
          [user.email, user.name, user.role, user.openId, 'demo']
        );
        userIds[user.email] = result.insertId;
        userOpenIds[user.email] = user.openId;
        console.log(`  ✓ Created user ${user.email} (ID: ${result.insertId}, openId: ${user.openId})`);
      }
    }

    // 1. Create Provider Organizations
    console.log('\n🏢 Creating provider organizations...');
    const providerOrgs = {};
    for (const provider of DEMO_PROVIDERS) {
      const [result] = await connection.execute(
        'INSERT INTO organizations (name, type, status, email) VALUES (?, ?, ?, ?)',
        [provider.name, 'provider', 'active', `provider-${provider.code}@example.com`]
      );
      providerOrgs[provider.code] = result.insertId;
      console.log(`  ✓ ${provider.name} organization (ID: ${result.insertId})`);
    }

    // 2. Create Distributor Organizations
    console.log('\n🏢 Creating distributor organizations...');
    const distributorOrgs = {};
    for (const dist of DEMO_DISTRIBUTORS) {
      const [result] = await connection.execute(
        'INSERT INTO organizations (name, type, status, email) VALUES (?, ?, ?, ?)',
        [dist.name, 'distributor', 'active', `distributor-${DEMO_TIMESTAMP}@example.com`]
      );
      distributorOrgs[dist.name] = result.insertId;
      console.log(`  ✓ ${dist.name} organization (ID: ${result.insertId})`);
    }

    // 3. Link demo provider user to first provider organization
    console.log('\n🔗 Linking users to organizations...');
    const firstProviderOrg = Object.values(providerOrgs)[0];
    const firstDistributorOrg = Object.values(distributorOrgs)[0];
    
    // Check if link already exists before inserting
    const [existingProviderLink] = await connection.execute(
      'SELECT id FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [userIds['demo-provider@example.com'], firstProviderOrg]
    );
    
    if (existingProviderLink.length === 0) {
      await connection.execute(
        'INSERT INTO organization_users (user_id, organization_id, role) VALUES (?, ?, ?)',
        [userIds['demo-provider@example.com'], firstProviderOrg, 'admin']
      );
      console.log(`  ✓ Linked demo provider user to provider organization`);
    } else {
      console.log(`  ✓ Demo provider user already linked to provider organization`);
    }
    
    const [existingDistributorLink] = await connection.execute(
      'SELECT id FROM organization_users WHERE user_id = ? AND organization_id = ?',
      [userIds['demo-distributor@example.com'], firstDistributorOrg]
    );
    
    if (existingDistributorLink.length === 0) {
      await connection.execute(
        'INSERT INTO organization_users (user_id, organization_id, role) VALUES (?, ?, ?)',
        [userIds['demo-distributor@example.com'], firstDistributorOrg, 'admin']
      );
      console.log(`  ✓ Linked demo distributor user to distributor organization`);
    } else {
      console.log(`  ✓ Demo distributor user already linked to distributor organization`);
    }
    
    // Ensure users are active in users_extended table
    console.log('\n✅ Activating demo users...');
    for (const [email, userId] of Object.entries(userIds)) {
      const [existingStatus] = await connection.execute(
        'SELECT user_id FROM users_extended WHERE user_id = ?',
        [userId]
      );
      
      if (existingStatus.length === 0) {
        await connection.execute(
          'INSERT INTO users_extended (user_id, status, activated_at) VALUES (?, ?, NOW())',
          [userId, 'active']
        );
        console.log(`  ✓ Activated user ${email}`);
      } else {
        await connection.execute(
          'UPDATE users_extended SET status = ?, activated_at = NOW() WHERE user_id = ?',
          ['active', userId]
        );
        console.log(`  ✓ Updated status for user ${email}`);
      }
    }

    // 4. Seed Providers
    console.log('\n📦 Seeding providers...');
    const providers = {};
    for (const provider of DEMO_PROVIDERS) {
      const [result] = await connection.execute(
        'INSERT INTO service_providers (name, provider_code, status) VALUES (?, ?, ?)',
        [provider.name, provider.code, 'active']
      );
      providers[provider.code] = result.insertId;
      console.log(`  ✓ ${provider.name} (ID: ${result.insertId})`);
    }

    // 5. Seed Distributors
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

    // 6. Seed Products
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

    // 7. Seed Cards (Inventory)
    console.log('\n📚 Seeding card inventory...');
    let totalCards = 0;
    for (const [code, providerId] of Object.entries(providers)) {
      for (const denom of PRODUCT_DENOMINATIONS) {
        const cardsPerDenom = 50; // 50 cards per denomination per provider

        for (let i = 0; i < cardsPerDenom; i++) {
          // Generate fake encrypted PIN (in real scenario, this would be actual encrypted data)
          const fakePin = crypto.randomBytes(32).toString('hex');

          await connection.execute(
            'INSERT INTO cards (provider_id, pin_encrypted, status) VALUES (?, ?, ?)',
            [providerId, fakePin, 'AVAILABLE']
          );
        }

        totalCards += cardsPerDenom;
        console.log(`  ✓ ${code}: ${cardsPerDenom} × ${denom} LYD cards`);
      }
    }
    console.log(`  Total: ${totalCards} cards seeded`);

    // 8. Seed API Credentials for each distributor
    console.log('\n🔑 Seeding API credentials...');
    const apiCredentials = {};
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

      apiCredentials[distName] = { masked, secret };
      console.log(`  ✓ ${distName}: ${masked}`);
    }

    console.log('\n✅ Demo data seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`  - Providers: ${Object.keys(providers).length}`);
    console.log(`  - Distributors: ${Object.keys(distributors).length}`);
    console.log(`  - Products: ${Object.keys(products).length * PRODUCT_DENOMINATIONS.length}`);
    console.log(`  - Cards: ${totalCards}`);
    console.log(`  - API Credentials: ${Object.keys(apiCredentials).length}`);
    
    console.log('\n🔐 Demo Login Accounts:');
    console.log(`  Provider: demo-provider@example.com`);
    console.log(`  Distributor: demo-distributor@example.com`);
    
    console.log('\n📋 Demo Distributor IDs:');
    for (const [name, id] of Object.entries(distributors)) {
      console.log(`  ${name}: ${id}`);
    }
    
    console.log('\n📋 Demo Provider Codes:');
    for (const [code, id] of Object.entries(providers)) {
      console.log(`  ${code}: ${id}`);
    }

  } catch (error) {
    console.error('❌ Error seeding demo data:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedDemoData();
