import { getRawDb } from '../server/db.ts';

async function linkUserToConnect() {
  try {
    const pool = await getRawDb();
    if (!pool) throw new Error('Database connection not available');
    
    const conn = await pool.getConnection();
    
    try {
      // 1. Find the user
      const [users] = await conn.execute(
        'SELECT id FROM users WHERE email = ?',
        ['abdogiydan2000@gmail.com']
      );
      
      if (!users.length) {
        console.log('❌ User not found');
        return;
      }
      
      const userId = users[0].id;
      console.log('✅ Found user:', userId);
      
      // 2. Find Connect provider organization
      const [orgs] = await conn.execute(
        'SELECT id FROM organizations WHERE name LIKE ? AND type = ?',
        ['%Connect%', 'provider']
      );
      
      if (!orgs.length) {
        console.log('❌ Connect provider organization not found');
        console.log('Available provider organizations:');
        const [allOrgs] = await conn.execute(
          'SELECT id, name FROM organizations WHERE type = ?',
          ['provider']
        );
        console.log(allOrgs);
        return;
      }
      
      const orgId = orgs[0].id;
      console.log('✅ Found Connect organization:', orgId);
      
      // 3. Check if user is already linked
      const [existing] = await conn.execute(
        'SELECT id FROM organization_users WHERE user_id = ? AND organization_id = ?',
        [userId, orgId]
      );
      
      if (existing.length) {
        console.log('✅ User already linked to Connect organization');
      } else {
        await conn.execute(
          'INSERT INTO organization_users (user_id, organization_id, role, updated_at) VALUES (?, ?, ?, NOW())',
          [userId, orgId, 'admin']
        );
        console.log('✅ Linked user to Connect organization');
      }
      
      // 4. Get the service provider ID
      const [providers] = await conn.execute(
        'SELECT id FROM service_providers WHERE organization_id = ? LIMIT 1',
        [orgId]
      );
      
      if (providers.length) {
        console.log('✅ Service Provider ID:', providers[0].id);
      }
      
      console.log('\n✅ Setup complete!');
      console.log('User ID:', userId);
      console.log('Organization ID:', orgId);
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

linkUserToConnect().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
