import { getDb } from './db';

async function testAuthFlow() {
  const db = await getDb();
  if (!db) return { status: 'FAILED', message: 'Database not available' };
  
  try {
    const result = await db.execute(`SELECT id, openId, email, role FROM users WHERE role = 'admin' LIMIT 1`);
    const users = Array.isArray(result) ? result[0] : result;
    if (Array.isArray(users) && users.length === 0) {
      return { status: 'FAILED', message: 'No admin user found' };
    }
    return { status: 'PASSED', message: `Admin user found` };
  } catch (err) {
    return { status: 'FAILED', message: String(err) };
  }
}

async function testProviderFlow() {
  const db = await getDb();
  if (!db) return { status: 'FAILED', message: 'Database not available' };
  
  try {
    const providers = await db.select().from(require('../drizzle/schema').serviceProviders).limit(1);
    if (providers.length === 0) {
      return { status: 'FAILED', message: 'No providers found' };
    }
    return { status: 'PASSED', message: `Provider found: ${providers[0].name}` };
  } catch (err) {
    return { status: 'FAILED', message: String(err) };
  }
}

async function runTests() {
  console.log('=== APPLICATION VALIDATION TESTS ===\n');
  
  const tests = [
    { name: 'Authentication Flow', fn: testAuthFlow },
    { name: 'Provider Flow', fn: testProviderFlow }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      console.log(`${result.status === 'PASSED' ? '✓' : '✗'} ${test.name}: ${result.message}`);
      if (result.status === 'PASSED') passed++;
      else failed++;
    } catch (err) {
      console.log(`✗ ${test.name}: ${err}`);
      failed++;
    }
  }
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Passed: ${passed}/${tests.length}`);
  console.log(`Failed: ${failed}/${tests.length}`);
}

runTests().catch(console.error);
