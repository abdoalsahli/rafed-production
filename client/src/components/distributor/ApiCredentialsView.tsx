import React, { useState } from 'react';
import { formatDateOnly } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Eye, EyeOff, Copy, RotateCw } from 'lucide-react';

export interface ApiCredentials {
  id?: number;
  keyId?: string;
  maskedKey?: string;
  webhookUrl?: string | null | undefined;
  lastUsedAt?: any;
  createdAt?: any;
  status?: string;
  isActive?: boolean;
  apiKey?: string;
  apiSecret?: string;
  lastRotated?: any;
  [key: string]: any;
}

export interface ApiCredentialsViewProps {
  credentials: ApiCredentials | null;
  isLoading?: boolean;
  error?: string | null;
  newSecret?: string | null;
  onGenerateKey?: () => Promise<void>;
  onRotateKey?: () => Promise<void>;
  onUpdateWebhook?: (url: string) => Promise<void>;
}

export const ApiCredentialsView: React.FC<ApiCredentialsViewProps> = ({
  credentials,
  isLoading = false,
  error = null,
  newSecret = null,
  onGenerateKey,
  onRotateKey,
  onUpdateWebhook,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(credentials?.webhookUrl || '');
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleUpdateWebhook = async () => {
    setIsUpdatingWebhook(true);
    try {
      await onUpdateWebhook?.(webhookUrl);
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

  if (!credentials) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>بيانات اعتماد API</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#444651] mb-4">لم يتم إنشاء مفتاح API بعد.</p>
          <Button
            onClick={onGenerateKey}
            disabled={isLoading}
            className="bg-[#00236f] hover:bg-[#00164e]"
          >
            إنشاء مفتاح API
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error State */}
      {error && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#b91c1c]">خطأ</p>
            <p className="text-sm text-[#b91c1c]">{error}</p>
          </div>
        </div>
      )}

      {/* One-time secret reveal banner */}
      {newSecret && (
        <div className="p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-[#b45309] flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-[#b45309]">
              احفظ المفتاح السري — لن يُعرض مرة أخرى
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type={showApiSecret ? 'text' : 'password'}
              value={newSecret}
              readOnly
              className="font-mono text-xs"
              dir="ltr"
            />
            <Button size="sm" variant="outline" onClick={() => setShowApiSecret(!showApiSecret)}>
              {showApiSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleCopyToClipboard(newSecret)}>
              <Copy size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* API Key Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>مفتاح API</CardTitle>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              credentials.status === 'active'
                ? 'bg-[#ccfbf1] text-[#0f766e]'
                : 'bg-[#f1f5f9] text-[#64748b]'
            }`}>
              {credentials.status === 'active' ? 'نشط' : 'غير نشط'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key ID */}
          <div>
            <label className="text-sm font-medium text-[#0b1c30]">معرّف المفتاح</label>
            <div className="flex gap-2 mt-1">
              <Input
                type="text"
                value={credentials.keyId || ''}
                readOnly
                className="font-mono text-xs"
                dir="ltr"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyToClipboard(credentials.keyId || '')}
              >
                <Copy size={16} />
              </Button>
            </div>
          </div>

          {/* Masked key */}
          <div>
            <label className="text-sm font-medium text-[#0b1c30]">مفتاح API (مخفي)</label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={credentials.maskedKey || ''}
                  readOnly
                  className="pr-10 font-mono text-xs"
                  dir="ltr"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444651]"
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyToClipboard(credentials.maskedKey || '')}
              >
                <Copy size={16} />
              </Button>
            </div>
            <p className="text-xs text-[#444651] mt-1">يظهر المفتاح الكامل مرة واحدة فقط عند إنشائه أو تدويره.</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#e2e8f0] text-sm">
            <div>
              <p className="text-[#444651]">تاريخ الإنشاء</p>
              <p className="font-medium text-[#0b1c30]">
                {credentials.createdAt ? formatDateOnly(credentials.createdAt) : '-'}
              </p>
            </div>
            <div>
              <p className="text-[#444651]">آخر تدوير</p>
              <p className="font-medium text-[#0b1c30]">
                {credentials.lastRotated ? formatDateOnly(credentials.lastRotated) : 'لم يتم بعد'}
              </p>
            </div>
          </div>

          {/* Rotate Key Button */}
          {onRotateKey && (
            <Button
              onClick={onRotateKey}
              disabled={isLoading}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <RotateCw size={16} />
              تدوير مفتاح API
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#0b1c30]">رابط Webhook</label>
            <Input
              type="url"
              placeholder="https://your-domain.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="mt-1 num focus:border-[#00236f]"
              dir="ltr"
            />
            <p className="text-xs text-[#444651] mt-2">
              سيتم إرسال إشعارات الشراء والأحداث إلى هذا الرابط
            </p>
          </div>

          {onUpdateWebhook && (
            <Button
              onClick={handleUpdateWebhook}
              disabled={isUpdatingWebhook || !webhookUrl}
              className="w-full bg-[#00236f] hover:bg-[#00164e]"
            >
              {isUpdatingWebhook ? 'جاري الحفظ…' : 'تحديث رابط Webhook'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiCredentialsView;
