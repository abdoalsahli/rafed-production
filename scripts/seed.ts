/**
 * Seed script — creates demo orgs, users, and relationships for local dev.
 *
 * Usage:  node node_modules/tsx/dist/cli.mjs scripts/seed.ts
 *
 * Password is read from SEED_PASSWORD env var, falls back to a dev-only default.
 * NEVER run against a production DATABASE_URL — the script will refuse if
 * NODE_ENV=production.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

// ── Safety guard ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.error(
    "ERROR: Refusing to seed a production database (NODE_ENV=production).\n" +
    "If you really intend this, unset NODE_ENV and re-run.",
  );
  process.exit(1);
}

const SALT_ROUNDS = 10;
// Password is configurable via env so it is never hardcoded in source control
// for shared/staging environments.
const PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

function requireRow<T>(row: T | undefined, label: string): T {
  if (!row) throw new Error(`Seed failed: could not find "${label}" after insert. Check for name collisions.`);
  return row;
}

async function seed() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Wrap everything in a transaction so any failure rolls back completely.
  await conn.beginTransaction();

  try {
    console.log("Seeding database…");

    // ── 1. Organizations ────────────────────────────────────────────────────
    await conn.execute(
      `INSERT INTO organizations (name, type, status, contact_person, email)
       VALUES
         ('Rafed Platform', 'internal',    'active', 'Platform Admin',  'admin@rafed.ly'),
         ('Libyana',        'provider',    'active', 'Libyana Admin',   'admin@libyana.ly'),
         ('Anis',           'distributor', 'active', 'Anis Admin',      'admin@anis.ly')
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    );
    console.log("  ✓ organizations");

    const [orgs]: any = await conn.execute(
      `SELECT id, name, type FROM organizations WHERE name IN ('Rafed Platform', 'Libyana', 'Anis')`,
    );
    const rafedOrg   = requireRow(orgs.find((o: any) => o.name === "Rafed Platform"), "Rafed Platform org");
    const libyanaOrg = requireRow(orgs.find((o: any) => o.name === "Libyana"),        "Libyana org");
    const anisOrg    = requireRow(orgs.find((o: any) => o.name === "Anis"),           "Anis org");

    // ── 2. Service provider ─────────────────────────────────────────────────
    await conn.execute(
      `INSERT INTO service_providers (name, provider_code, status, organization_id)
       VALUES ('Libyana', 'LIBYANA', 'active', ?)
       ON DUPLICATE KEY UPDATE organization_id = VALUES(organization_id)`,
      [libyanaOrg.id],
    );
    const [[libyana]]: any = await conn.execute(
      `SELECT id FROM service_providers WHERE provider_code = 'LIBYANA'`,
    );
    console.log("  ✓ service_providers");

    // ── 3. Distributor ──────────────────────────────────────────────────────
    await conn.execute(
      `INSERT INTO distributors (name, status, organization_id)
       VALUES ('Anis', 'active', ?)
       ON DUPLICATE KEY UPDATE organization_id = VALUES(organization_id)`,
      [anisOrg.id],
    );
    const [[anis]]: any = await conn.execute(
      `SELECT id FROM distributors WHERE name = 'Anis'`,
    );
    console.log("  ✓ distributors");

    // ── 4. Users ────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    const usersToInsert = [
      { openId: "email_seed_admin",   email: "admin@rafed.ly",   name: "Platform Admin", role: "admin" },
      { openId: "email_seed_libyana", email: "admin@libyana.ly", name: "Libyana Admin",  role: "user"  },
      { openId: "email_seed_anis",    email: "admin@anis.ly",    name: "Anis Admin",     role: "user"  },
    ];

    for (const u of usersToInsert) {
      await conn.execute(
        `INSERT INTO users (open_id, email, password_hash, login_method, name, status, role,
                            created_at, updated_at, last_signed_in)
         VALUES (?, ?, ?, 'email', ?, 'active', ?, NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           status        = 'active',
           role          = VALUES(role)`,
        [u.openId, u.email, hash, u.name, u.role],
      );
    }
    console.log("  ✓ users");

    // ── 5. Fetch user IDs ───────────────────────────────────────────────────
    const [userRows]: any = await conn.execute(
      `SELECT id, email FROM users WHERE email IN (?, ?, ?)`,
      ["admin@rafed.ly", "admin@libyana.ly", "admin@anis.ly"],
    );
    const adminUser   = requireRow(userRows.find((u: any) => u.email === "admin@rafed.ly"),   "admin user");
    const libyanaUser = requireRow(userRows.find((u: any) => u.email === "admin@libyana.ly"), "libyana user");
    const anisUser    = requireRow(userRows.find((u: any) => u.email === "admin@anis.ly"),    "anis user");

    // ── 6. Organization users ───────────────────────────────────────────────
    const orgUserLinks = [
      [adminUser.id,   rafedOrg.id,   "admin"],
      [libyanaUser.id, libyanaOrg.id, "admin"],
      [anisUser.id,    anisOrg.id,    "admin"],
    ];
    for (const [uid, oid, role] of orgUserLinks) {
      await conn.execute(
        `INSERT INTO organization_users (user_id, organization_id, role, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE role = VALUES(role), updated_at = NOW()`,
        [uid, oid, role],
      );
    }
    console.log("  ✓ organization_users");

    // ── 7. Products ─────────────────────────────────────────────────────────
    const productsToInsert = [
      { name: "Libyana 5 LYD",  displayName: "بطاقة ليبيانا 5 دينار",  faceValue: "5.00",  price: "4.75",  code: "LYD5"  },
      { name: "Libyana 10 LYD", displayName: "بطاقة ليبيانا 10 دينار", faceValue: "10.00", price: "9.50",  code: "LYD10" },
      { name: "Libyana 20 LYD", displayName: "بطاقة ليبيانا 20 دينار", faceValue: "20.00", price: "19.00", code: "LYD20" },
    ];
    for (const p of productsToInsert) {
      await conn.execute(
        `INSERT INTO products (provider_id, name, display_name, face_value, currency, price,
                               product_code, status, is_active)
         VALUES (?, ?, ?, ?, 'LYD', ?, ?, 'active', 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [libyana.id, p.name, p.displayName, p.faceValue, p.price, p.code],
      );
    }
    console.log("  ✓ products");

    // ── 8. Provider-distributor relationship ────────────────────────────────
    await conn.execute(
      `INSERT INTO provider_distributor_relationships
         (provider_id, distributor_id, commission_percentage, commission_type, credit_line, status)
       VALUES (?, ?, '5.00', 'percentage', '10000.00', 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [libyana.id, anis.id],
    );
    console.log("  ✓ provider_distributor_relationships");

    // ── 9. Provider-distributor account (balance) ────────────────────────────
    // The live purchase flow: purchase.router → PurchaseIntegratedService
    //   → financial.service → provider_distributor_accounts.
    await conn.execute(
      `INSERT INTO provider_distributor_accounts
         (provider_id, distributor_id, balance, credit_line, used_credit, version)
       VALUES (?, ?, '1000.00', '10000.00', '0.00', 1)
       ON DUPLICATE KEY UPDATE balance = balance`,
      [libyana.id, anis.id],
    );
    console.log("  ✓ provider_distributor_accounts");

    await conn.commit();

    console.log("\nDone! Login credentials:");
    console.log("  admin@rafed.ly     — internal admin  (role: admin)");
    console.log("  admin@libyana.ly   — provider admin");
    console.log("  admin@anis.ly      — distributor admin");
    console.log(`  Password for all:  ${PASSWORD}`);
    console.log("  (Override with SEED_PASSWORD env var)");
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
