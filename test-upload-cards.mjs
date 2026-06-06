import fetch from 'node-fetch';
import crypto from 'crypto';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Test data: 5 sample PINs
const testPINs = [
  '1234567890123456',
  '2345678901234567',
  '3456789012345678',
  '4567890123456789',
  '5678901234567890',
];

async function testUploadCards() {
  console.log('\n=== TEST: uploadCards Endpoint ===\n');
  console.log(`API Base: ${API_BASE}`);
  
  try {
    // Prepare upload payload
    const payload = {
      batchName: `Test Batch ${Date.now()}`,
      productId: 1, // This will need to be a valid product ID
      pins: testPINs,
      metadata: {
        source: 'test-script',
        timestamp: new Date().toISOString(),
      },
    };
    
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Call the uploadCards endpoint
    const response = await fetch(`${API_BASE}/api/trpc/provider.uploadCards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: payload,
      }),
    });
    
    console.log(`\nResponse Status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✓ Upload successful');
    } else {
      console.log('\n✗ Upload failed');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUploadCards();
