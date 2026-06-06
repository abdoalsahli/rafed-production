import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Code, Zap, BookOpen, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';

export const SandboxPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const baseUrl = window.location.origin;

  return (
    <div dir="ltr" className="p-6 md:p-8 space-y-6 text-left">
      <PageHeader
        title="الاختبار والتجربة"
        subtitle="اختبر تكاملك خطوة بخطوة قبل الإطلاق"
      />

      {/* No separate sandbox notice */}
      <Card className="border-[#bfdbfe] bg-[#eff6ff]">
        <CardContent className="py-5 flex items-start gap-3">
          <AlertCircle size={20} className="text-[#2563eb] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#1e3a8a] text-sm mb-1">One environment, real credentials</h3>
            <p className="text-sm text-[#1e40af]">
              There is no separate sandbox URL. You test against the same API using your real API credentials.
              Use unique idempotency keys during testing and limit purchases to low-value products while you validate your integration.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 1 – Get credentials */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Step 1 — Get your API credentials</h2>
          </div>
        </div>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm text-slate-600">
            Before you can call any endpoint you need an API Key ID and API Secret.
            These are generated once on the API Management page.
          </p>
          <Button variant="outline" className="gap-2" onClick={() => setLocation('/distributor/api')}>
            <Key size={16} />
            Go to API Management
          </Button>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 space-y-2">
            <p className="font-semibold">After generating your key you will see:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><span className="font-mono">Key ID</span> — public identifier, e.g. <span className="font-mono">dist_abc123…</span></li>
              <li><span className="font-mono">Secret</span> — shown <strong>once</strong> at creation. Copy it immediately.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 – Discover products */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Code size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Step 2 — Discover available products</h2>
          </div>
        </div>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm text-slate-600">
            Call <span className="font-mono">GET /api/v1/products</span> to see which products your account
            has access to. This returns real product IDs you will use in purchase requests.
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
{`curl -X GET ${baseUrl}/api/v1/products \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET"`}
          </pre>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Example response</p>
            <pre className="text-xs text-slate-600 overflow-x-auto">
{`{
  "success": true,
  "products": [
    { "id": 12, "name": "5 LYD Card", "price": "5.00", "providerId": 1 },
    { "id": 13, "name": "10 LYD Card", "price": "10.00", "providerId": 1 }
  ]
}`}
            </pre>
          </div>
          <p className="text-xs text-slate-500">
            Note the <span className="font-mono">id</span> value — you will pass it as <span className="font-mono">productId</span> in the next step.
          </p>
        </CardContent>
      </Card>

      {/* Step 3 – Make a purchase */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Step 3 — Make a test purchase</h2>
          </div>
        </div>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm text-slate-600">
            Submit a purchase with a unique <span className="font-mono">Idempotency-Key</span> header.
            Add <span className="font-mono">?wait=true</span> to receive the card PIN in the same response
            instead of polling.
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
{`curl -X POST "${baseUrl}/api/v1/purchases?wait=true" \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -H "Idempotency-Key: test-$(date +%s)" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": 12}'`}
          </pre>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Successful response (<span className="font-mono">status: SUCCEEDED</span>)</p>
            <pre className="text-xs text-slate-600 overflow-x-auto">
{`{
  "success": true,
  "requestId": 42,
  "status": "SUCCEEDED",
  "productId": 12,
  "amount": "5.00",
  "createdAt": "2025-06-01T10:00:00.000Z",
  "completedAt": "2025-06-01T10:00:00.500Z",
  "card": {
    "serialNumber": "SN-00123456",
    "pin": "1234567890"
  }
}`}
            </pre>
          </div>
          <div className="bg-[#fef3c7] border border-[#fde68a] rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>PIN is delivered once.</strong> If you call the same endpoint again the card PIN will
              not be returned a second time. Store it immediately when you receive it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test scenarios */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Common test scenarios</h2>
          </div>
        </div>
        <CardContent className="py-6 space-y-4">

          {/* Idempotency */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle size={18} className="text-[#0f766e] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Idempotency (safe retries)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send the same <span className="font-mono">Idempotency-Key</span> twice — you should get
                  the same <span className="font-mono">requestId</span> back with no second card allocated.
                </p>
              </div>
            </div>
            <pre className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
{`# First call
curl -X POST "${baseUrl}/api/v1/purchases?wait=true" \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -H "Idempotency-Key: my-fixed-key-001" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": 12}'

# Retry with the SAME key → same requestId, no duplicate charge
curl -X POST "${baseUrl}/api/v1/purchases?wait=true" \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -H "Idempotency-Key: my-fixed-key-001" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": 12}'`}
            </pre>
          </div>

          {/* Async flow */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle size={18} className="text-[#0f766e] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Async polling (without wait=true)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Omit <span className="font-mono">?wait=true</span> to get an immediate PENDING response,
                  then poll the status endpoint until the purchase completes.
                </p>
              </div>
            </div>
            <pre className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
{`# 1. Submit (returns PENDING immediately)
curl -X POST "${baseUrl}/api/v1/purchases" \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -H "Idempotency-Key: async-test-001" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": 12}'
# → { "requestId": 55, "status": "PENDING", ... }

# 2. Poll status (use the requestId from step 1)
curl "${baseUrl}/api/v1/purchases/55" \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET"
# → { "status": "SUCCEEDED", "card": { "pin": "..." } }`}
            </pre>
          </div>

          {/* Missing idempotency key */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle size={18} className="text-[#b91c1c] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Error — missing Idempotency-Key</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify your error-handling catches a 400 when the header is omitted.
                </p>
              </div>
            </div>
            <pre className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
{`# No Idempotency-Key header
curl -X POST "${baseUrl}/api/v1/purchases" \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"productId": 12}'

# Expected: 400 Bad Request
# { "success": false, "error": { "code": "MISSING_IDEMPOTENCY_KEY", ... } }`}
            </pre>
          </div>

          {/* Bad credentials */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle size={18} className="text-[#b91c1c] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Error — invalid credentials</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm your code handles authentication failures gracefully.
                </p>
              </div>
            </div>
            <pre className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-700 overflow-x-auto">
{`curl "${baseUrl}/api/v1/products" \\
  -H "X-API-Key: bad_key" \\
  -H "X-API-Secret: wrong_secret"

# Expected: 401 Unauthorized
# { "success": false, "error": { "code": "UNAUTHORIZED", ... } }`}
            </pre>
          </div>

        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Testing best practices</h2>
          </div>
        </div>
        <CardContent className="py-6">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-[#0f766e] font-bold shrink-0">1.</span>
              <span className="text-slate-600"><strong>Discover before you buy:</strong> Call <span className="font-mono">GET /api/v1/products</span> first to get real product IDs — never hardcode them.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0f766e] font-bold shrink-0">2.</span>
              <span className="text-slate-600"><strong>Always send Idempotency-Key:</strong> Generate a unique UUID per request. Reuse the same key on retries of the same logical operation.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0f766e] font-bold shrink-0">3.</span>
              <span className="text-slate-600"><strong>Store the PIN immediately:</strong> The PIN is returned only once. Persist it to your database before acknowledging the purchase.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0f766e] font-bold shrink-0">4.</span>
              <span className="text-slate-600"><strong>Test both flows:</strong> Use <span className="font-mono">?wait=true</span> for synchronous integrations and the poll flow for async ones.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0f766e] font-bold shrink-0">5.</span>
              <span className="text-slate-600"><strong>Check API logs:</strong> The API Management page shows every request with status code and response time.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#0f766e] font-bold shrink-0">6.</span>
              <span className="text-slate-600"><strong>Test error paths:</strong> Simulate missing headers, wrong credentials, and invalid product IDs to make sure your error handling is solid.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Ready for production */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-6 flex items-start gap-4">
          <CheckCircle size={20} className="text-[#0f766e] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">Ready to go live?</h3>
            <p className="text-sm text-green-800">
              Once your integration handles success, retry, and error responses correctly, you are
              already live — there is no environment switch needed. The same API key and the same
              base URL (<span className="font-mono text-green-900">{baseUrl}</span>) are used in
              production.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SandboxPage;
