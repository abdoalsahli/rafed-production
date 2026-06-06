import { getRawDb } from "./server/db";

async function checkSchema() {
  const pool = await getRawDb();
  if (!pool) {
    console.error("Database not available");
    process.exit(1);
  }

  const conn = await pool.getConnection();

  try {
    const [cols] = await conn.execute(`DESCRIBE transactions`);
    console.log("Transactions table columns:");
    cols.forEach((col: any) => console.log("  -", col.Field));
  } finally {
    conn.release();
  }
}

checkSchema();
