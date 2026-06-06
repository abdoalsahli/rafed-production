import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const url = new URL(dbUrl);

const connection = await mysql.createConnection({
  host: url.hostname,
  port: url.port || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

try {
  const [tables] = await connection.execute(`SHOW TABLES`);
  console.log('Available tables:');
  tables.forEach(t => {
    const tableName = Object.values(t)[0];
    console.log(`  - ${tableName}`);
  });
} finally {
  await connection.end();
}
