# 1000 Concurrent Purchases Analysis & Design

## Scenario: 1000 Simultaneous Purchases on Same Account

### Current Per-Account Queue Performance

**With existing architecture (120ms per request):**
- Total processing time: 1000 × 120ms = **120 seconds (2 minutes)**
- Queue depth: 999 PENDING requests
- Oldest pending age: Up to 120 seconds
- Client experience: Immediate enqueue response, but 2-minute wait for completion

**Bottleneck Analysis:**
```
Worker processes: 1 request every 120ms
Throughput: 8.3 requests/second
For 1000 requests: 120 seconds
```

---

## Problem: Unacceptable Latency

**Issues with 120-second processing:**

1. **Client Timeout Risk**
   - HTTP request timeout: typically 30-60 seconds
   - Clients will abandon after 30s
   - Need async status polling, not blocking wait

2. **Queue Visibility**
   - Oldest pending age: 120 seconds
   - Monitoring alerts trigger
   - Appears like system is broken

3. **Resource Pressure**
   - 1000 rows in PENDING state
   - Memory pressure from queue
   - Database query overhead

4. **Recovery Complexity**
   - Stale job threshold (30s) insufficient
   - Need longer timeout for 1000-request queue

---

## Solution: Multi-Tier Architecture

### Tier 1: Immediate Acceptance (Enqueue)
```
1000 requests arrive
├─ All validated in parallel
├─ All inserted to purchase_requests (PENDING)
├─ All return requestId immediately (< 50ms)
└─ Clients never wait for processing
```

### Tier 2: Controlled Processing (Worker Pool)
Instead of 1 worker per account, use **configurable worker pool**:

```
Option A: 1 worker (current)
- Processing: 1000 × 120ms = 120 seconds
- Throughput: 8.3 req/sec
- Latency: 120 seconds

Option B: 5 workers (parallel processing)
- Processing: 1000 ÷ 5 × 120ms = 24 seconds
- Throughput: 41.7 req/sec
- Latency: 24 seconds
- Trade-off: Increased lock contention on account row

Option C: 10 workers (aggressive parallelism)
- Processing: 1000 ÷ 10 × 120ms = 12 seconds
- Throughput: 83.3 req/sec
- Latency: 12 seconds
- Trade-off: High lock contention, potential deadlocks

Option D: Batch processing (50 per batch)
- 20 batches × 120ms = 2.4 seconds
- Throughput: 416.7 req/sec
- Latency: 2.4 seconds
- Trade-off: Complex error handling (partial batch failures)

Option E: Hybrid (5 workers + batching)
- 1000 ÷ 5 = 200 per worker
- 200 ÷ 50 = 4 batches per worker
- 4 × 120ms = 480ms per worker
- Total: ~480ms
- Throughput: 2083 req/sec
- Latency: 480ms
```

---

## Recommended Design: Adaptive Worker Pool

### Architecture

```
Purchase Request Enqueue
    ↓
    ├─ Validate request
    ├─ Check idempotency
    ├─ INSERT purchase_requests (PENDING)
    └─ Return requestId immediately
    
    ↓
    
Queue Manager (per account)
    ├─ Monitor queue depth
    ├─ Adaptive worker scaling:
    │  ├─ Depth 1-50:    1 worker
    │  ├─ Depth 51-200:  3 workers
    │  ├─ Depth 201-500: 5 workers
    │  └─ Depth 501+:    10 workers
    └─ Each worker processes independently
    
    ↓
    
Worker Pool (per account)
    ├─ Worker 1: Process requests 1-100
    ├─ Worker 2: Process requests 101-200
    ├─ Worker 3: Process requests 201-300
    ├─ Worker 4: Process requests 301-400
    ├─ Worker 5: Process requests 401-500
    └─ ...
    
    ↓
    
Atomic Transaction (per request)
    ├─ Lock account row
    ├─ Lock card row
    ├─ Allocate card
    ├─ Update balance
    └─ Create ledger entries
```

### Adaptive Scaling Logic

```typescript
async function getOptimalWorkerCount(queueDepth: number): Promise<number> {
  if (queueDepth <= 50) return 1;      // Single worker sufficient
  if (queueDepth <= 200) return 3;     // Start parallelism
  if (queueDepth <= 500) return 5;     // Moderate parallelism
  return 10;                            // Maximum parallelism
}
```

### Performance Projections

| Queue Depth | Workers | Time/Request | Total Time | Throughput |
|-------------|---------|--------------|-----------|-----------|
| 100 | 1 | 120ms | 12s | 8.3/sec |
| 300 | 3 | 120ms | 12s | 25/sec |
| 500 | 5 | 120ms | 12s | 41.7/sec |
| 1000 | 10 | 120ms | 12s | 83.3/sec |

**Key Insight:** With 10 parallel workers, 1000 requests process in ~12 seconds (instead of 120 seconds).

---

## Implementation: Batch Processing

For even better performance, combine workers with batch processing:

### Batch Processing Strategy

```typescript
// Instead of processing 1 request per transaction
// Process 50 requests per transaction (if all succeed)

async function processBatch(
  providerId: number,
  distributorId: number,
  requestIds: number[]  // Array of 50 request IDs
): Promise<BatchResult> {
  
  // Single transaction for entire batch
  return db.transaction(async (tx) => {
    // Lock account once
    const account = await tx.select()
      .from(providerDistributorAccounts)
      .where(...)
      .for('update');
    
    // Process each request
    const results = [];
    for (const requestId of requestIds) {
      const result = await processRequest(requestId, account, tx);
      results.push(result);
    }
    
    // Update account balance once
    await tx.update(providerDistributorAccounts)
      .set({ usedCredit: newUsedCredit })
      .where(...);
    
    return results;
  });
}
```

**Benefits:**
- Single account lock for 50 requests (vs 50 locks)
- Reduced lock contention by 50x
- Single balance update (vs 50 updates)
- Batch ledger insert (vs 50 inserts)

**Performance Impact:**
- Per-batch overhead: 20ms (setup, commit)
- Per-request overhead: 2ms (within batch)
- 50 requests per batch: 20 + (50 × 2) = 120ms
- Throughput: 416 req/sec (vs 8.3 req/sec)

---

## Comparison: 1000 Concurrent Purchases

| Metric | 1 Worker | 5 Workers | 10 Workers | Batch (50) | Batch + 5W |
|--------|----------|-----------|-----------|-----------|-----------|
| **Total Time** | 120s | 24s | 12s | 2.4s | 480ms |
| **Throughput** | 8.3/sec | 41.7/sec | 83.3/sec | 416/sec | 2083/sec |
| **Latency** | 120s | 24s | 12s | 2.4s | 480ms |
| **Lock Contention** | Low | Medium | High | Very Low | Low |
| **Complexity** | Simple | Medium | High | High | Very High |
| **Error Handling** | Simple | Medium | Medium | Complex | Complex |
| **Production Ready** | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |

---

## Recommended Approach for 1000 Concurrent

### Phase 1: Adaptive Worker Pool (Immediate)
- Implement 1-10 worker scaling
- Monitor lock contention
- Target: 12-second processing for 1000 requests
- **Production ready**: Yes
- **Complexity**: Medium
- **Risk**: Low

### Phase 2: Batch Processing (Optimization)
- Implement 50-request batches
- Reduce lock contention by 50x
- Target: 2.4-second processing for 1000 requests
- **Production ready**: After testing
- **Complexity**: High
- **Risk**: Medium (partial batch failures)

### Phase 3: Distributed Queue (Scaling)
- Move queue to Redis
- Enable multi-server deployment
- Target: Horizontal scaling
- **Production ready**: Phase 3+
- **Complexity**: Very High
- **Risk**: High (distributed systems)

---

## Implementation Roadmap

### Week 1: Adaptive Worker Pool
```
1. Modify QueueManager to support configurable worker count
2. Add queue depth monitoring
3. Implement adaptive scaling logic
4. Test with 100, 300, 500, 1000 concurrent requests
5. Deploy to staging
```

### Week 2: Batch Processing
```
1. Implement batch transaction wrapper
2. Modify worker to process batches (50 requests)
3. Add partial failure handling
4. Test batch error scenarios
5. Performance benchmark
```

### Week 3: Monitoring & Optimization
```
1. Add detailed metrics collection
2. Set up alerts for queue depth
3. Monitor lock wait times
4. Optimize batch size (50 vs 100 vs 200)
5. Production deployment
```

---

## Database Considerations

### Current Indexes (Sufficient for 1000)
```sql
INDEX idx_purchase_requests_queue 
  ON (provider_id, distributor_id, status, createdAt)
  -- Efficient for: SELECT oldest PENDING for account
  
INDEX idx_purchase_requests_processing 
  ON (status, processing_started_at)
  -- Efficient for: Recovery of stale jobs
```

### Potential Bottlenecks
1. **Account row lock contention** (with 10 workers)
   - Solution: Batch processing reduces lock count by 50x

2. **Card table scan** (SELECT first available)
   - Solution: Pre-allocate card IDs (optional optimization)

3. **Ledger insert volume** (2000 inserts for 1000 requests)
   - Solution: Batch insert (already supported by Drizzle)

### Scaling Limits
- **1000 concurrent**: Adaptive workers (12s)
- **10,000 concurrent**: Batch processing (120s)
- **100,000 concurrent**: Distributed queue (multi-server)

---

## Monitoring for 1000 Concurrent

### Key Metrics
```
Queue Depth:        Should peak at 1000, decrease to 0 over 12s
Processing Rate:    Should be ~83 requests/second (with 10 workers)
Lock Wait Time:     Should be < 50ms per request
Failure Rate:       Should be 0% (all requests succeed)
Total Duration:     Should be ~12 seconds
```

### Alerts
```
⚠️  Queue depth > 1000 (potential bottleneck)
⚠️  Oldest pending age > 30 seconds (potential stale job)
⚠️  Lock wait time > 100ms (potential contention)
⚠️  Failure rate > 1% (potential issues)
⚠️  Processing rate < 50/sec (potential slowdown)
```

---

## Conclusion

### For 1000 Concurrent Purchases:

**Recommended:** Adaptive Worker Pool (Phase 1)
- Processing time: ~12 seconds
- Throughput: ~83 requests/second
- Complexity: Medium
- Production ready: Yes
- Risk: Low

**Next:** Batch Processing (Phase 2)
- Processing time: ~2.4 seconds
- Throughput: ~416 requests/second
- Complexity: High
- Production ready: After testing
- Risk: Medium

**Future:** Distributed Queue (Phase 3)
- Processing time: Scales linearly
- Throughput: Unlimited (horizontal scaling)
- Complexity: Very High
- Production ready: Phase 3+
- Risk: High

---

## Action Items

- [ ] Implement adaptive worker pool (1-10 workers)
- [ ] Add queue depth monitoring
- [ ] Test with 1000 concurrent requests
- [ ] Benchmark performance (target: 12 seconds)
- [ ] Implement batch processing (optional, Phase 2)
- [ ] Set up monitoring and alerting
- [ ] Deploy to production
