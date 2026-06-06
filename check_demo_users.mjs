import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

try {
  // Check demo users
  const [users] = await connection.execute(
    'SELECT id, email, open_id FROM users WHERE email LIKE "demo-%"'
  );
  
  console.log('Demo Users:');
  for (const user of users) {
    console.log(`  ${user.email} (ID: ${user.id}, openId: ${user.open_id})`);
    
    // Check organization links
    const [links] = await connection.execute(
      'SELECT ou.organization_id, o.name, o.type FROM organization_users ou JOIN organizations o ON ou.organization_id = o.id WHERE ou.user_id = ?',
      [user.id]
    );
    
    if (links.length > 0) {
      for (const link of links) {
        console.log(`    → Org: ${link.name} (Type: ${link.type}, ID: ${link.organization_id})`);
      }
    } else {
      console.log('    → No organization links');
    }
  }
  
  process.exit(0);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
