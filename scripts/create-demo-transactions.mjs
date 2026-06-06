import mysql from 'mysql2/promise';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL not set');
}

const url = new URL(DATABASE_URL);
const pool = mysql.createPool({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {},
});

async function createDemoTransactions() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Creating realistic demo transactions...');
    
    // Get demo distributor (Anis)
    const [distributors] = await connection.execute(
      'SELECT id FROM distributors WHERE name = ?',
      ['Anis']
    );
    
    if (!distributors || distributors.length === 0) {
      throw new Error('Demo distributor (Anis) not found');
    }
    
    const distributorId = distributors[0].id;
    console.log(`Found distributor: Anis (ID: ${distributorId})`);
    
    // Get all providers
    const [providers] = await connection.execute(
      'SELECT id, name FROM service_providers LIMIT 5'
    );
    
    if (!providers || providers.length === 0) {
      throw new Error('No providers found');
    }
    
    console.log(`Found ${providers.length} providers`);
    
    // Get available cards
    const [cards] = await connection.execute(
      'SELECT id, provider_id FROM cards WHERE status = ? LIMIT 100',
      ['AVAILABLE']
    );
    
    if (!cards || cards.length === 0) {
      throw new Error('No available cards found');
    }
    
    console.log(`Found ${cards.length} available cards`);
    
    // Create 10 sample transactions
    const transactionsToCreate = [];
    let cardIndex = 0;
    
    for (let i = 0; i < 10 && cardIndex < cards.length; i++) {
      const provider = providers[i % providers.length];
      const card = cards[cardIndex];
      cardIndex++;
      
      const idempotencyKey = uuidv4();
      const amount = 50 + (i * 10); // Varying amounts: 50, 60, 70, etc.
      const commission = Math.round(amount * 0.05); // 5% commission
      
      transactionsToCreate.push({
        distributorId,
        providerId: provider.id,
        cardId: card.id,
        amount,
        commission,
        idempotencyKey,
        status: 'completed',
        createdAt: new Date(Date.now() - (10 - i) * 3600000), // Spread over 10 hours
      });
    }
    
    // Insert transactions
    for (let idx = 0; idx < transactionsToCreate.length; idx++) {
      const tx = transactionsToCreate[idx];
      const provider = providers[idx % providers.length];
      
      await connection.execute(
        `INSERT INTO transactions 
         (idempotency_key, distributor_id, provider_id, product_id, card_id, amount, commission_amount, transaction_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.idempotencyKey,
          tx.distributorId,
          tx.providerId,
          1, // product_id placeholder
          tx.cardId,
          tx.amount,
          tx.commission,
          'purchase',
          tx.status,
          tx.createdAt,
          tx.createdAt,
        ]
      );
      
      // Mark card as SOLD
      await connection.execute(
        'UPDATE cards SET status = ? WHERE id = ?',
        ['SOLD', tx.cardId]
      );
      
      console.log(`✓ Transaction ${idx + 1}/10: ${tx.amount} LYD from ${provider.name}`);
    }
    
    console.log('\n✅ Demo transactions created successfully!');
    console.log(`   - 10 transactions created`);
    console.log(`   - 10 cards marked as SOLD`);
    console.log(`   - Total value: ${transactionsToCreate.reduce((sum, tx) => sum + tx.amount, 0)} LYD`);
    console.log(`   - Total commission: ${transactionsToCreate.reduce((sum, tx) => sum + tx.commission, 0)} LYD`);
    
  } catch (error) {
    console.error('Error creating transactions:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

createDemoTransactions().catch(console.error);
