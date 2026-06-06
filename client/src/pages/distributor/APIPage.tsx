import React from 'react';
import { useLocation } from 'wouter';
import { useApiIntegration } from '@/hooks/data/useApiIntegration';
import { ApiCredentialsView } from '@/components/distributor/ApiCredentialsView';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Code, ExternalLink, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const APIPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const {
    credentials,
    newSecret,
    successMessage,
    isLoading,
    error,
    generateApiKey,
    rotateApiKey,
    updateWebhookUrl,
  } = useApiIntegration();


  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight">واجهة API</h1>
          <p className="mt-1 text-sm text-[#444651]">إدارة مفاتيح API وإعدادات التكامل</p>
        </div>
      </div>

      {/* Documentation Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="border-[#dce1ff] bg-[#eff4ff] cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/distributor/api-docs')}
        >
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code size={20} className="text-[#00236f]" />
              <div>
                <h3 className="font-semibold text-[#00236f]">توثيق API</h3>
                <p className="text-xs text-[#444651]">المصادقة، نقاط النهاية، الأمثلة</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-[#00236f] rotate-180" />
          </CardContent>
        </Card>

        <Card
          className="border-[#5eead4] bg-[#ccfbf1] cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/distributor/sandbox')}
        >
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ExternalLink size={20} className="text-[#0f766e]" />
              <div>
                <h3 className="font-semibold text-[#0f766e]">الاختبار والتجربة</h3>
                <p className="text-xs text-[#444651]">اختبر تكاملك بأمان قبل الإطلاق</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-[#0f766e] rotate-180" />
          </CardContent>
        </Card>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-[#fca5a5] bg-[#fee2e2]">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-[#b91c1c] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#b91c1c] text-sm">خطأ في تحميل بيانات الاعتماد</h3>
              <p className="text-sm text-[#b91c1c] mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Credentials View */}
      <ApiCredentialsView
        credentials={credentials}
        isLoading={isLoading}
        error={error}
        newSecret={newSecret}
        onGenerateKey={generateApiKey}
        onRotateKey={rotateApiKey}
        onUpdateWebhook={updateWebhookUrl}
      />

      {/* API Activity Logs — coming soon */}
      <Card className="border-[#e2e8f0]">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-[#444651]" />
            <h2 className="text-lg font-bold text-[#0b1c30]">سجل نشاط API</h2>
          </div>
        </div>
        <CardContent className="py-10">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#f1f5f9] flex items-center justify-center">
              <Clock size={22} className="text-[#94a3b8]" />
            </div>
            <p className="text-sm font-semibold text-[#444651]">سجل النشاط قيد التطوير</p>
            <p className="text-xs text-[#94a3b8] max-w-xs leading-snug">
              ستظهر هنا إحصائيات الطلبات وسجل الاستدعاءات في تحديث قادم.
              يمكنك في الوقت الحالي متابعة طلباتك عبر نقطة نهاية الحالة
              <span className="num"> GET /api/v1/purchases/:id</span>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Guide */}
      <Card>
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Code size={20} className="text-[#444651]" />
            <h2 className="text-lg font-bold text-[#0b1c30]">دليل التكامل</h2>
          </div>
          <p className="text-sm text-[#444651] mt-1">كيفية دمج API في تطبيقك</p>
        </div>
        <CardContent className="py-6 space-y-4">
          <div>
            <h3 className="font-semibold text-[#0b1c30] mb-2">المصادقة</h3>
            <p className="text-sm text-[#444651] mb-3">
              كل طلب يتطلب ترويستين — معرّف المفتاح والمفتاح السري:
            </p>
            <pre className="bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4 overflow-x-auto">
              <code className="text-xs text-[#444651] num">
{`X-API-Key: YOUR_KEY_ID
X-API-Secret: YOUR_SECRET`}
              </code>
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-[#0b1c30] mb-2">مثال على طلب شراء</h3>
            <pre className="bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4 overflow-x-auto">
              <code className="text-xs text-[#444651] num">
{`curl -X POST ${window.location.origin}/api/v1/purchases?wait=true \\
  -H "X-API-Key: YOUR_KEY_ID" \\
  -H "X-API-Secret: YOUR_SECRET" \\
  -H "Idempotency-Key: unique-request-id" \\
  -H "Content-Type: application/json" \\
  -d '{
    "productId": 12
  }'`}
              </code>
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-[#0b1c30] mb-2">التوثيق الكامل</h3>
            <p className="text-sm text-[#444651] mb-3">
              مرجع كامل لنقاط النهاية مع مخططات الطلبات والاستجابات:
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setLocation('/distributor/api-docs')}
            >
              <ExternalLink size={16} />
              عرض التوثيق الكامل
            </Button>
          </div>

          <div className="bg-[#eff4ff] border border-[#dce1ff] rounded-lg p-4">
            <h3 className="font-semibold text-[#00236f] text-sm mb-2">💡 نصيحة مهمة</h3>
            <p className="text-sm text-[#00236f]">
              أرسل دائمًا ترويسة <code className="bg-[#dce1ff] px-1 rounded num">Idempotency-Key</code> فريدة مع كل عملية شراء.
              أعد استخدام نفس المفتاح عند إعادة المحاولة — ستحصل على النتيجة الأصلية دون تكرار الشراء.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card className="border-[#fcd34d] bg-[#fef3c7]">
        <CardContent className="py-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-[#b45309] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#b45309] text-sm">أفضل ممارسات الأمان</h3>
            <ul className="text-sm text-[#b45309] mt-2 space-y-1 list-disc list-inside">
              <li>لا تحفظ مفاتيح API في نظام التحكم بالإصدارات</li>
              <li>دوّر المفاتيح بانتظام لتعزيز الأمان</li>
              <li>استخدم متغيرات البيئة لتخزين بيانات الاعتماد الحساسة</li>
              <li>قيّد الوصول لمفتاح API بعنوان IP محدد عند الإمكان</li>
              <li>راقب استخدام API للكشف عن أي نشاط غير معتاد</li>
            </ul>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default APIPage;
