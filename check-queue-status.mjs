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

try {
  const metrics = await client.purchases.metrics.query({
    providerId: 1,
    distributorId: 1,
  });

  console.log('Queue Status:');
  console.log(`  Queue Depth: ${metrics.queueDepth}`);
  console.log(`  Processing: ${metrics.processingCount}`);
  console.log(`  Success: ${metrics.successCount}`);
  console.log(`  Failed: ${metrics.failedCount}`);
  console.log(`  Total in system: ${metrics.queueDepth + (metrics.processingCount || 0)}`);
  console.log(`  Max queue depth: 10000`);
} catch (error) {
  console.error('Error:', error.message);
}
