import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useConnectionFlow } from '@/hooks/data/useConnectionFlow';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export const ConnectProviderPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: number; name: string; providerCode: string } | null>(null);
  const [commission, setCommission] = useState(5);
  const [creditLine, setCreditLine] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: providers, isLoading } = trpc.distributor.listAllProviders.useQuery();

  const {
    connectionError,
    isRequesting,
    handleRequestConnection,
    clearError,
  } = useConnectionFlow();

  const filtered = (providers ?? []).filter((p) =>
    !search.trim() || p.name.includes(search) || p.providerCode.includes(search.toUpperCase())
  );

  const handleConnect = async () => {
    if (!selected) return;
    clearError();
    setSuccessMsg(null);
    try {
      await handleRequestConnection({
        providerCode: selected.providerCode,
        requestedCommission: commission,
        requestedCreditLine: creditLine,
      });
      setSuccessMsg(`تم إرسال طلب الربط إلى ${selected.name} بنجاح.`);
      setSelected(null);
    } catch {
      // error shown via connectionError
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="ربط مزود جديد"
        subtitle="تصفّح المزودين المتاحين وأرسل طلب الربط مباشرةً"
      />

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle size={16} className="shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Error banner */}
      {connectionError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {connectionError}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="ابحث باسم المزود أو رمزه…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Provider grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 size={18} className="animate-spin" />
          <span>جاري تحميل المزودين…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا يوجد مزودون مطابقون.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((provider) => (
            <div
              key={provider.id}
              className={`rounded-xl border bg-white p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                selected?.id === provider.id ? 'border-primary ring-1 ring-primary' : 'border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{provider.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{provider.providerCode}</p>
                </div>
              </div>

              <Button
                size="sm"
                variant={selected?.id === provider.id ? 'default' : 'outline'}
                className="w-full"
                onClick={() => {
                  setSelected(selected?.id === provider.id ? null : provider);
                  setSuccessMsg(null);
                  clearError();
                }}
              >
                {selected?.id === provider.id ? 'تم الاختيار ✓' : 'اختيار'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Connection form — shown when a provider is selected */}
      {selected && (
        <div className="max-w-md rounded-2xl border border-border bg-white p-6 space-y-4 shadow-sm">
          <h2 className="font-bold text-base">إعدادات الربط مع {selected.name}</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium">نسبة العمولة المطلوبة (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">حد الائتمان المطلوب (اختياري)</label>
            <Input
              type="number"
              min={0}
              value={creditLine}
              onChange={(e) => setCreditLine(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              className="flex-1"
              onClick={handleConnect}
              disabled={isRequesting}
            >
              {isRequesting ? (
                <><Loader2 size={15} className="animate-spin ml-2" />جاري الإرسال…</>
              ) : (
                'إرسال طلب الربط'
              )}
            </Button>
            <Button variant="outline" onClick={() => { setSelected(null); clearError(); }}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectProviderPage;
