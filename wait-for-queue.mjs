import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

const client = createTRPCClient({
  links: [
    httpBatchLink({
      url: 'https://3000-it7b15ez9qjomfc5q6qbl-a4783f98.us1.manus.computer/api/trpc',
      transformer: superjson,
    }),
  ],
});

console.log('Waiting for queue to clear...\n');

let cleared = false;
let checkCount = 0;

while (!cleared && checkCount < 120) {
  await new Promise(resolve => setTimeout(resolve, 5000));
  checkCount++;

  try {
    const metrics = await client.purchases.metrics.query({
      providerId: 1,
      distributorId: 1,
    });

    const totalInQueue = metrics.queueDepth + (metrics.processingCount || 0);
    console.log(`[${checkCount * 5}s] Queue Depth: ${metrics.queueDepth}, Processing: ${metrics.processingCount}, Total: ${totalInQueue}`);

    if (totalInQueue === 0) {
      console.log('\n✓ Queue cleared');
      cleared = true;
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (!cleared) {
  console.log('\n✗ Queue did not clear within 10 minutes');
}
