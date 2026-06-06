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
  const [rows] = await connection.execute(
    `SELECT status, failure_reason, COUNT(*) as count 
     FROM purchase_requests 
     WHERE provider_id = 1 AND distributor_id = 1 
     GROUP BY status, failure_reason`
  );

  console.log('Purchase Request Status Summary:');
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await connection.end();
}
