import { db } from './server/db';

async function main() {
  try {
    const counts = {
      users: await db.query.users.findMany().then(r => r.length),
      serviceProviders: await db.query.serviceProviders.findMany().then(r => r.length),
      distributors: await db.query.distributors.findMany().then(r => r.length),
      products: await db.query.products.findMany().then(r => r.length),
      cards: await db.query.cards.findMany().then(r => r.length),
      transactions: await db.query.transactions.findMany().then(r => r.length),
    };
    console.log(JSON.stringify(counts, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
