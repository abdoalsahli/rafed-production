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

console.log('Testing tRPC client...');

// Test 1: Query with no input
try {
  const health = await client.health.root.query();
  console.log('✓ health.root:', health);
} catch (error) {
  console.error('✗ health.root failed:', error.message);
}

// Test 2: Query with input
try {
  const greet = await client.testMinimal.greet.query({ name: 'World' });
  console.log('✓ testMinimal.greet:', greet);
} catch (error) {
  console.error('✗ testMinimal.greet failed:', error.message);
}

// Test 3: Mutation with input
try {
  const echo = await client.testMinimal.echo.mutate({ message: 'hello' });
  console.log('✓ testMinimal.echo:', echo);
} catch (error) {
  console.error('✗ testMinimal.echo failed:', error.message);
}
