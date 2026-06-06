import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Search, CheckCircle } from 'lucide-react';

export interface Provider {
  id: number;
  name: string;
  providerCode: string;
  status: string;
}

export interface ConnectProviderFormProps {
  onSearch: (providerCode: string) => Promise<Provider | null | undefined>;
  onConnect: (providerCode: string, commission: number, creditLine: number) => Promise<void>;
  isSearching?: boolean;
  isConnecting?: boolean;
  error?: string | null;
}

export const ConnectProviderForm: React.FC<ConnectProviderFormProps> = ({
  onSearch,
  onConnect,
  isSearching = false,
  isConnecting = false,
  error = null,
}) => {
  const [providerCode, setProviderCode] = useState('');
  const [foundProvider, setFoundProvider] = useState<Provider | null>(null);
  const [requestedCommission, setRequestedCommission] = useState(5);
  const [requestedCreditLine, setRequestedCreditLine] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    setSearchError(null);
    try {
      const provider = await onSearch(providerCode.toUpperCase());
      if (provider) {
        setFoundProvider(provider);
      }
    } catch (err: any) {
      setSearchError(err.message || 'المزود غير موجود');
    }
  };

  const handleConnect = async () => {
    if (!foundProvider) return;
    try {
      await onConnect(foundProvider.providerCode, requestedCommission, requestedCreditLine);
      setProviderCode('');
      setFoundProvider(null);
      setRequestedCommission(5);
      setRequestedCreditLine(0);
    } catch (err: any) {
      setSearchError(err.message || 'فشل الاتصال بالمزود');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>البحث عن مزود</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-[#444651] mb-2">أمثلة على رموز المزودين:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['LIBYANA_1777407398700', 'ALMADAR_1777407398700', 'LTT_1777407398700', 'CONNECT_1777407398700'].map(code => (
                <button
                  key={code}
                  onClick={() => setProviderCode(code)}
                  className="text-left text-xs px-3 py-2 bg-[#f8f9ff] hover:bg-[#eff4ff] rounded border border-[#e2e8f0] text-[#444651] transition-colors num"
                  dir="ltr"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="أدخل رمز المزود (مثال: LIBYANA_1777407398700)"
              value={providerCode}
              onChange={(e) => setProviderCode(e.target.value.toUpperCase())}
              disabled={isSearching}
              dir="ltr"
              className="num focus:border-[#00236f]"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !providerCode}
              variant="outline"
              className="flex items-center gap-2 shrink-0"
            >
              <Search size={18} />
              بحث
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
              <p className="text-[#b91c1c] text-sm">{error}</p>
            </div>
          )}

          {searchError && (
            <div className="p-3 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#b91c1c] text-sm font-medium">{searchError}</p>
                <p className="text-[#b91c1c] text-xs mt-1">جرّب أحد الرموز أعلاه أو تواصل مع المزود للحصول على رمزه.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Details */}
      {foundProvider && (
        <Card className="border-[#5eead4] bg-[#ccfbf1]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#0f766e]" />
              <CardTitle className="text-[#0f766e]">تم العثور على المزود</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#444651]">اسم المزود</p>
                <p className="font-medium text-[#0b1c30]">{foundProvider.name}</p>
              </div>
              <div>
                <p className="text-sm text-[#444651]">رمز المزود</p>
                <p className="font-medium num text-[#0b1c30]" dir="ltr">{foundProvider.providerCode}</p>
              </div>
            </div>

            {/* Connection Terms */}
            <div className="space-y-4 pt-4 border-t border-[#5eead4]">
              <div>
                <label className="text-sm font-medium text-[#0b1c30]">نسبة العمولة المطلوبة (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={requestedCommission}
                  onChange={(e) => setRequestedCommission(parseFloat(e.target.value))}
                  className="mt-1 num focus:border-[#00236f]"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#0b1c30]">حد الائتمان المطلوب ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={requestedCreditLine}
                  onChange={(e) => setRequestedCreditLine(parseFloat(e.target.value))}
                  className="mt-1 num focus:border-[#00236f]"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-[#5eead4]">
              <Button
                onClick={() => {
                  setFoundProvider(null);
                  setProviderCode('');
                }}
                variant="outline"
                disabled={isConnecting}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-[#00236f] hover:bg-[#00164e] text-white"
              >
                {isConnecting ? 'جاري الإرسال…' : 'إرسال طلب الربط'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConnectProviderForm;
