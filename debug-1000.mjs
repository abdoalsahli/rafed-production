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
  const result = await client.purchases.enqueue.mutate({
    providerId: 1,
    distributorId: 1,
    productId: 1,
    idempotencyKey: `debug-${Date.now()}`,
  });

  console.log('Enqueue result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  if (error.data) {
    console.error('Error data:', error.data);
  }
}
