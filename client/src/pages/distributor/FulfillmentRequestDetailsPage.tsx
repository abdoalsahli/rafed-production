import React, { useState, useEffect } from 'react';
import { formatDateTime, formatTimeOnly } from '@/lib/dateUtils';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
  RotateCcw,
  Zap,
  Activity,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

type LifecycleStatus = 'PENDING' | 'PROCESSING' | 'DELIVERING' | 'SUCCEEDED' | 'RETRYING' | 'FAILED' | 'DEAD_LETTERED';
type WebhookDeliveryStatus = 'delivered' | 'retry_pending' | 'retrying' | 'failed' | 'dead_lettered' | 'replay_available';

interface EventTimelineEntry {
  timestamp: string;
  event: string;
  details?: string;
  severity?: 'info' | 'warning' | 'error';
}

interface FulfillmentRequestDetail {
  id: string;
  requestId: string;
  correlationId: string;
  idempotencyKey: string;
  transactionId: string;
  providerId: number;
  providerName: string;
  status: LifecycleStatus;
  amount: number;
  currency: string;
  submittedAt: string;
  completedAt?: string;
  webhookDeliveryStatus: WebhookDeliveryStatus;
  webhookEndpoint?: string;
  retryCount: number;
  lastDeliveryAttempt?: string;
  nextRetryTime?: string;
  processingDurationMs?: number;
  webhookDeliveryDurationMs?: number;
  timeline: EventTimelineEntry[];
  retryHistory: Array<{ attemptNumber: number; timestamp: string; httpStatus?: number; error?: string }>;
  replayHistory: Array<{ timestamp: string; status: 'success' | 'failed' }>;
}

export const FulfillmentRequestDetailsPage: React.FC = () => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [location, navigate] = useLocation();
  const [match, params] = useRoute('/distributor/fulfillment/:requestId');
  
  const requestId = params?.requestId as string;
  const [requestData, setRequestData] = useState<FulfillmentRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    timeline: true,
    retryHistory: false,
    replayHistory: false,
  });

  useEffect(() => {
    if (!requestId) {
      setError('Request ID not found');
      setIsLoading(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setRequestData({
        id: '1',
        requestId,
        correlationId: 'corr-' + Math.random().toString(36).substr(2, 9),
        idempotencyKey: 'idem-' + Math.random().toString(36).substr(2, 9),
        transactionId: 'txn-' + Math.random().toString(36).substr(2, 9),
        providerId: 123,
        providerName: 'Provider Name',
        status: 'SUCCEEDED' as LifecycleStatus,
        amount: 100.00,
        currency: 'LYD',
        submittedAt: new Date(Date.now() - 300000).toISOString(),
        completedAt: new Date().toISOString(),
        webhookDeliveryStatus: 'delivered',
        webhookEndpoint: 'https://provider.example.com/webhook',
        retryCount: 0,
        lastDeliveryAttempt: new Date().toISOString(),
        processingDurationMs: 2500,
        webhookDeliveryDurationMs: 1200,
        timeline: [
          { timestamp: new Date(Date.now() - 300000).toISOString(), event: 'تم إرسال الطلب', severity: 'info' },
          { timestamp: new Date(Date.now() - 295000).toISOString(), event: 'بدأت المعالجة', severity: 'info' },
          { timestamp: new Date(Date.now() - 292500).toISOString(), event: 'تم تخصيص البطاقة', severity: 'info' },
          { timestamp: new Date(Date.now() - 1200).toISOString(), event: 'تم التسليم عبر Webhook', severity: 'info' },
          { timestamp: new Date().toISOString(), event: 'مكتمل', severity: 'info' },
        ],
        retryHistory: [],
        replayHistory: [],
      });
      setIsLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [requestId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('تم النسخ إلى الحافظة');
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleReplayWebhook = async () => {
    if (user?.role !== 'admin') {
      toast.error('Permission denied');
      return;
    }
    toast.success('بدأت إعادة تشغيل Webhook');
  };

  const handleExport = async () => {
    if (user?.role !== 'admin') {
      toast.error('Permission denied');
      return;
    }
    toast.success('جاري تصدير تفاصيل الطلب...');
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00236f] mx-auto mb-4"></div>
          <p className="text-[#444651]">جاري تحميل تفاصيل الطلب…</p>
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/distributor/fulfillment')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة إلى تتبع الطلبات
        </Button>
        <Alert className="border-[#fecaca] bg-[#fff5f5]">
          <AlertCircle className="h-4 w-4 text-[#b91c1c]" />
          <AlertDescription className="text-[#991b1b]">
            {error || 'الطلب غير موجود'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/distributor/fulfillment')}
          className="mb-4 gap-2 text-[#444651]"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة
        </Button>
        <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight">طلب {requestData.requestId}</h1>
        <p className="text-[#444651] mt-1 text-sm">رؤية تشغيلية لطلب التنفيذ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {requestData.status === 'SUCCEEDED' && <CheckCircle2 className="w-5 h-5 text-[#0f766e]" />}
            {requestData.status === 'PROCESSING' && <Activity className="w-5 h-5 animate-pulse text-[#2563eb]" />}
            {requestData.status === 'FAILED' && <AlertCircle className="w-5 h-5 text-[#b91c1c]" />}
            الحالة: {requestData.status}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-[#444651]">المزود</div>
              <div className="font-medium text-[#0b1c30]">{requestData.providerName}</div>
            </div>
            <div>
              <div className="text-xs text-[#444651]">المبلغ</div>
              <div className="font-medium text-[#0b1c30] num">{requestData.amount} {requestData.currency}</div>
            </div>
            <div>
              <div className="text-xs text-[#444651]">تاريخ الإرسال</div>
              <div className="font-medium text-[#0b1c30] text-sm">
                {formatDateTime(requestData.submittedAt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#444651]">Webhook</div>
              <div className="font-medium text-[#0b1c30] text-sm">{requestData.webhookDeliveryStatus}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">المعرفات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'معرف الطلب', value: requestData.requestId },
            { label: 'معرف الارتباط', value: requestData.correlationId },
            { label: 'مفتاح الاتساق', value: requestData.idempotencyKey },
            { label: 'معرف المعاملة', value: requestData.transactionId },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between bg-[#f8f9ff] p-3 rounded-lg">
              <div>
                <div className="text-xs text-[#444651]">{item.label}</div>
                <div className="font-mono text-xs text-[#0b1c30]">{item.value}</div>
              </div>
              <button
                onClick={() => copyToClipboard(item.value, item.label)}
                className="ml-2 p-1 hover:bg-slate-200 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copiedId === item.label ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مقاييس المعالجة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#eff6ff] p-3 rounded-lg border border-[#bfdbfe]">
              <div className="text-xs text-[#1e40af] font-medium">انتظار القائمة</div>
              <div className="text-lg font-bold text-[#1e3a8a] num">
                {requestData.processingDurationMs ? Math.round(requestData.processingDurationMs / 1000) : 0}s
              </div>
            </div>
            <div className="bg-[#f3e8ff] p-3 rounded-lg border border-[#d8b4fe]">
              <div className="text-xs text-[#6b21a8] font-medium">المعالجة</div>
              <div className="text-lg font-bold text-[#581c87] num">2.5s</div>
            </div>
            <div className="bg-[#f0fdf4] p-3 rounded-lg border border-[#bbf7d0]">
              <div className="text-xs text-[#0f766e] font-medium">التسليم</div>
              <div className="text-lg font-bold text-[#134e4a] num">
                {requestData.webhookDeliveryDurationMs ? Math.round(requestData.webhookDeliveryDurationMs) : 0}ms
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            onClick={() => toggleSection('timeline')}
            className="w-full text-left"
          >
            <CardTitle className="text-base flex items-center justify-between">
              الجدول الزمني للأحداث
              <span className="text-xs text-[#444651]">{expandedSections.timeline ? 'v' : '>'}</span>
            </CardTitle>
          </button>
        </CardHeader>
        {expandedSections.timeline && (
          <CardContent>
            <div className="space-y-3">
              {requestData.timeline.map((event, idx) => (
                <div key={idx} className="flex gap-3 pb-3 border-b border-slate-200 last:border-b-0">
                  <div className="flex-shrink-0 pt-1">
                    {event.severity === 'error' && <AlertCircle className="w-4 h-4 text-[#b91c1c]" />}
                    {event.severity === 'warning' && <AlertCircle className="w-4 h-4 text-[#b45309]" />}
                    {event.severity === 'info' && <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#444651]">
                      {formatTimeOnly(event.timestamp)}
                    </div>
                    <div className="font-medium text-[#0b1c30]">{event.event}</div>
                    {event.details && (
                      <div className="text-xs text-[#444651] mt-1">{event.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تسليم Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requestData.webhookEndpoint && (
            <div>
              <div className="text-xs text-[#444651] mb-1">نقطة النهاية</div>
              <div className="font-mono text-xs text-[#0b1c30] bg-slate-50 p-2 rounded break-all">
                {requestData.webhookEndpoint}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[#444651]">الحالة</div>
              <div className="font-medium text-[#0b1c30]">{requestData.webhookDeliveryStatus}</div>
            </div>
            <div>
              <div className="text-xs text-[#444651]">عدد إعادة المحاولات</div>
              <div className="font-medium text-[#0b1c30]">{requestData.retryCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {['failed', 'dead_lettered', 'replay_available'].includes(requestData.webhookDeliveryStatus) && (
          <Button
            variant="outline"
            onClick={handleReplayWebhook}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة تشغيل Webhook
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleExport}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>
    </div>
  );
};
