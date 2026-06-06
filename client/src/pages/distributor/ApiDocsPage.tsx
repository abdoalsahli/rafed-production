import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Code, Copy, Check, Lock, Shield, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export const ApiDocsPage: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock: React.FC<{ code: string; language: string; id: string }> = ({ code, language, id }) => (
    <div className="relative">
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-xs">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-200"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check size={16} /> : <Copy size={16} />}
      </Button>
    </div>
  );

  const BASE_URL = window.location.origin;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="توثيق API"
        subtitle="الدليل الشامل للتكامل مع منصة رافد لبطاقات الدفع المسبق"
      />

      {/* Base URL */}
      <Card dir="ltr" className="border-[#bfdbfe] bg-[#eff6ff] text-left">
        <CardContent className="py-4">
          <p className="text-sm font-semibold text-[#1e3a8a] mb-1">Base URL</p>
          <code className="text-sm font-mono text-[#1e40af]">{BASE_URL}/api/v1</code>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card dir="ltr" className="text-left">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-lg font-bold text-[#0b1c30]">Quick Start</h2>
        </div>
        <CardContent className="py-6 space-y-4">
          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Zap size={20} className="text-[#2563eb] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#1e3a8a] mb-2">Get Started in 3 Steps</h3>
                <ol className="text-sm text-[#1e40af] space-y-1 list-decimal list-inside">
                  <li>Generate an API key from the API Management page — you'll get a Key ID and a Secret</li>
                  <li>Include both in the <code className="font-mono bg-[#dbeafe] px-1 rounded">X-API-Key</code> and <code className="font-mono bg-[#dbeafe] px-1 rounded">X-API-Secret</code> headers</li>
                  <li>Call <code className="font-mono bg-[#dbeafe] px-1 rounded">GET /api/v1/products</code> to see available products, then purchase</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card dir="ltr" className="text-left">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-[#444651]" />
            <h2 className="text-lg font-bold text-[#0b1c30]">Authentication</h2>
          </div>
        </div>
        <CardContent className="py-6 space-y-4">
          <div>
            <h3 className="font-semibold text-[#0b1c30] mb-2">Two-Header Authentication</h3>
            <p className="text-sm text-[#444651] mb-3">
              Every request must include both headers. You get these from the API Management page when you generate your key.
            </p>
            <CodeBlock
              code={`X-API-Key: sk_live_your_key_id_here
X-API-Secret: your_secret_here`}
              language="text"
              id="auth-header"
            />
          </div>

          <div className="border-t border-[#e2e8f0] pt-4">
            <h3 className="font-semibold text-[#0b1c30] mb-2">Required Headers (all requests)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-start py-2 border-b border-slate-100">
                <span className="font-mono text-[#444651]">X-API-Key</span>
                <span className="text-[#444651]">Your Key ID from the portal (required)</span>
              </div>
              <div className="flex justify-between items-start py-2 border-b border-slate-100">
                <span className="font-mono text-[#444651]">X-API-Secret</span>
                <span className="text-[#444651]">Your secret, shown once at generation (required)</span>
              </div>
              <div className="flex justify-between items-start py-2 border-b border-slate-100">
                <span className="font-mono text-[#444651]">Content-Type</span>
                <span className="text-[#444651]">application/json (required for POST)</span>
              </div>
              <div className="flex justify-between items-start py-2">
                <span className="font-mono text-[#444651]">Idempotency-Key</span>
                <span className="text-[#444651]">Unique string per purchase (required for purchases)</span>
              </div>
            </div>
          </div>

          <div className="bg-[#fef3c7] border border-[#fde68a] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-[#b45309] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#78350f] text-sm mb-1">Secret is shown only once</h4>
                <p className="text-sm text-[#92400e]">
                  Save your secret immediately after generating it — it cannot be retrieved again. If lost, rotate the key to get a new one.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Idempotency */}
      <Card dir="ltr" className="text-left">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-lg font-bold text-[#0b1c30]">Idempotency & Retries</h2>
        </div>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm text-[#444651]">
            Every purchase must include an <code className="font-mono bg-slate-100 px-1 rounded">Idempotency-Key</code> header with a unique value you generate.
            If the network drops and you retry the same request with the same key, you get the same result — no double charge.
          </p>

          <div>
            <h3 className="font-semibold text-[#0b1c30] mb-2">Example</h3>
            <CodeBlock
              code={`Idempotency-Key: order-2026-05-31-00042`}
              language="text"
              id="idempotency-gen"
            />
            <p className="text-xs text-slate-500 mt-2">Use any unique string — an order number, UUID, or timestamp-based ID.</p>
          </div>

          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-4">
            <h4 className="font-semibold text-[#134e4a] text-sm mb-2">Best Practice</h4>
            <p className="text-sm text-[#166534]">
              Store the idempotency key with your order. If a request times out, retry with the same key — you'll get the original result safely.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card dir="ltr" className="text-left">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Code size={20} className="text-[#444651]" />
            <h2 className="text-lg font-bold text-[#0b1c30]">API Endpoints</h2>
          </div>
        </div>
        <CardContent className="py-6">
          <Tabs defaultValue="purchase" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="purchase">Purchase</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
            </TabsList>

            {/* Purchase Endpoint */}
            <TabsContent value="purchase" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs bg-[#dbeafe] text-[#1e40af] px-2 py-1 rounded">POST</span>
                  <span className="font-mono text-sm text-[#444651]">/api/v1/purchases</span>
                  <span className="text-xs text-slate-500">Add <code>?wait=true</code> to wait for the PIN in the same response</span>
                </div>
                <p className="text-sm text-[#444651] mb-4">Buy a prepaid card. Returns a request ID immediately; the card PIN is included when the purchase completes.</p>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">Headers</h4>
                    <CodeBlock
                      code={`X-API-Key: sk_live_your_key_id
X-API-Secret: your_secret
Content-Type: application/json
Idempotency-Key: order-00042`}
                      language="text"
                      id="purchase-headers"
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">Request Body</h4>
                    <CodeBlock
                      code={`{
  "productId": 2
}`}
                      language="json"
                      id="purchase-req"
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">Response (SUCCEEDED)</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "requestId": 11,
  "status": "SUCCEEDED",
  "productId": 2,
  "amount": "10.00",
  "card": {
    "serialNumber": "SN-00123456",
    "pin": "1234567891018"
  },
  "createdAt": "2026-05-31T11:46:57.000Z",
  "completedAt": "2026-05-31T11:46:58.000Z"
}`}
                      language="json"
                      id="purchase-res"
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">cURL Example</h4>
                    <CodeBlock
                      code={`curl -X POST "${BASE_URL}/api/v1/purchases?wait=true" \\
  -H "X-API-Key: sk_live_your_key_id" \\
  -H "X-API-Secret: your_secret" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-00042" \\
  -d '{"productId": 2}'`}
                      language="bash"
                      id="purchase-curl"
                    />
                  </div>

                  <div className="bg-[#fef3c7] border border-[#fde68a] rounded-lg p-3 text-sm text-[#92400e]">
                    <strong>Important:</strong> The PIN is returned only once. If you miss it, it cannot be retrieved again — the status endpoint will show <code className="font-mono bg-[#fde68a] px-1 rounded">pin: null</code>.
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Products Endpoint */}
            <TabsContent value="products" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs bg-green-100 text-[#166534] px-2 py-1 rounded">GET</span>
                  <span className="font-mono text-sm text-[#444651]">/api/v1/products</span>
                </div>
                <p className="text-sm text-[#444651] mb-4">Returns all active products from providers you are connected to.</p>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">Response</h4>
                    <CodeBlock
                      code={`{
  "success": true,
  "products": [
    {
      "providerId": 1,
      "providerName": "Libyana",
      "providerCode": "LIBYANA",
      "productId": 1,
      "productName": "Libyana 5 LYD",
      "price": "5.00"
    },
    {
      "providerId": 1,
      "providerName": "Libyana",
      "providerCode": "LIBYANA",
      "productId": 2,
      "productName": "Libyana 10 LYD",
      "price": "10.00"
    }
  ]
}`}
                      language="json"
                      id="products-res"
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">cURL Example</h4>
                    <CodeBlock
                      code={`curl -X GET "${BASE_URL}/api/v1/products" \\
  -H "X-API-Key: sk_live_your_key_id" \\
  -H "X-API-Secret: your_secret"`}
                      language="bash"
                      id="products-curl"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Status Endpoint */}
            <TabsContent value="status" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs bg-green-100 text-[#166534] px-2 py-1 rounded">GET</span>
                  <span className="font-mono text-sm text-[#444651]">/api/v1/purchases/:requestId</span>
                </div>
                <p className="text-sm text-[#444651] mb-4">Check the status of a purchase. Use this when you did not use <code className="font-mono bg-slate-100 px-1 rounded">?wait=true</code> on the purchase call.</p>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">Possible statuses</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">PENDING</span>
                        <span className="text-[#444651]">Still in queue — check again in a moment</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-[#dbeafe] text-[#1e40af] px-2 py-0.5 rounded text-xs">PROCESSING</span>
                        <span className="text-[#444651]">Being processed — check again shortly</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-green-100 text-[#166534] px-2 py-0.5 rounded text-xs">SUCCEEDED</span>
                        <span className="text-[#444651]">Card allocated — PIN in response (one time only)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-[#fee2e2] text-[#991b1b] px-2 py-0.5 rounded text-xs">FAILED</span>
                        <span className="text-[#444651]">Purchase failed — see <code className="font-mono">failureReason</code></span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#0b1c30] text-sm mb-2">cURL Example</h4>
                    <CodeBlock
                      code={`curl -X GET "${BASE_URL}/api/v1/purchases/11" \\
  -H "X-API-Key: sk_live_your_key_id" \\
  -H "X-API-Secret: your_secret"`}
                      language="bash"
                      id="status-curl"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Error Handling */}
      <Card dir="ltr" className="text-left">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-lg font-bold text-[#0b1c30]">Error Handling</h2>
        </div>
        <CardContent className="py-6 space-y-4">
          <div className="space-y-3">
            {[
              { code: '400', title: 'Bad Request', desc: 'Missing or invalid field (e.g. missing Idempotency-Key header, invalid productId)' },
              { code: '401', title: 'Unauthorized', desc: 'Invalid or missing X-API-Key / X-API-Secret' },
              { code: '403', title: 'Forbidden', desc: 'Not connected to the provider that owns this product' },
              { code: '404', title: 'Not Found', desc: 'Product or purchase request does not exist' },
              { code: '409', title: 'Conflict', desc: 'Queue is full — retry after a short delay' },
              { code: '500', title: 'Server Error', desc: 'Unexpected error — retry with the same idempotency key' },
            ].map(({ code, title, desc }) => (
              <div key={code} className="border border-[#e2e8f0] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs bg-[#fee2e2] text-[#991b1b] px-2 py-1 rounded">{code}</span>
                  <span className="font-semibold text-[#0b1c30]">{title}</span>
                </div>
                <p className="text-sm text-[#444651]">{desc}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-semibold text-[#0b1c30] text-sm mb-2">Error Response Format</h3>
            <CodeBlock
              code={`{
  "success": false,
  "error": {
    "code": "MISSING_IDEMPOTENCY_KEY",
    "message": "Idempotency-Key header is required"
  }
}`}
              language="json"
              id="error-res"
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card dir="ltr" className="text-left">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[#444651]" />
            <h2 className="text-lg font-bold text-[#0b1c30]">Security Best Practices</h2>
          </div>
        </div>
        <CardContent className="py-6 space-y-4">
          <ul className="space-y-3 text-sm">
            {[
              ['Never expose your secret in client-side code', 'Make API calls from your backend server only'],
              ['Save your secret immediately', 'It is shown only once — if lost, rotate the key'],
              ['Use a unique Idempotency-Key per order', 'Prevents duplicate purchases on retries'],
              ['Store the requestId with each order', 'So you can check status if the response is lost'],
              ['Rotate keys periodically', 'Go to API Management → Rotate Key'],
            ].map(([strong, rest], i) => (
              <li key={i} className="flex gap-3">
                <span className="text-green-600 font-bold">✓</span>
                <span className="text-[#444651]"><strong>{strong}:</strong> {rest}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiDocsPage;
