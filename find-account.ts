import { getDb } from './server/db';
import { providerDistributorAccounts } from './drizzle/schema';

async function findAccount() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const accounts = await db.select().from(providerDistributorAccounts).limit(5);
  
  console.log('First 5 accounts:');
  accounts.forEach((a: any) => {
    console.log(`ID: ${a.id}, Provider: ${a.providerId}, Distributor: ${a.distributorId}, Balance: ${a.balance}`);
  });

  process.exit(0);
}

findAccount().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
