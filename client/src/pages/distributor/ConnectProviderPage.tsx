import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useConnectionFlow } from '@/hooks/data/useConnectionFlow';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2, Search, Loader2, CheckCircle2, AlertCircle,
  Clock, Ban, Wifi, WifiOff, X,
} from 'lucide-react';

/* ── Status config ─────────────────────────────────────────────────────── */
type ConnectionStatus = 'active' | 'suspended' | 'pending' | 'rejected' | 'not_connected';

const STATUS_CONFIG: Record<ConnectionStatus, {
  label: string;
  icon: React.ReactNode;
  pill: string;       // tailwind classes for the pill
  canConnect: boolean;
}> = {
  active: {
    label: 'متصل',
    icon: <Wifi size={13} />,
    pill: 'bg-green-100 text-green-700 border-green-200',
    canConnect: false,
  },
  pending: {
    label: 'طلب قيد الانتظار',
    icon: <Clock size={13} />,
    pill: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    canConnect: false,
  },
  suspended: {
    label: 'موقوف',
    icon: <Ban size={13} />,
    pill: 'bg-orange-100 text-orange-700 border-orange-200',
    canConnect: false,
  },
  rejected: {
    label: 'مرفوض',
    icon: <WifiOff size={13} />,
    pill: 'bg-red-100 text-red-700 border-red-200',
    canConnect: true,
  },
  not_connected: {
    label: 'غير متصل',
    icon: <WifiOff size={13} />,
    pill: 'bg-slate-100 text-slate-500 border-slate-200',
    canConnect: true,
  },
};

/* ── Component ─────────────────────────────────────────────────────────── */
export const ConnectProviderPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [modalProvider, setModalProvider] = useState<{
    id: number; name: string; providerCode: string;
  } | null>(null);
  const [commission, setCommission] = useState(5);
  const [creditLine, setCreditLine] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: providers, isLoading, refetch } = trpc.distributor.listAllProviders.useQuery();

  const { connectionError, isRequesting, handleRequestConnection, clearError } = useConnectionFlow();

  const filtered = (providers ?? []).filter((p) =>
    !search.trim() ||
    p.name.includes(search) ||
    p.providerCode.includes(search.toUpperCase())
  );

  const openModal = (p: typeof filtered[0]) => {
    setModalProvider({ id: p.id, name: p.name, providerCode: p.providerCode });
    setCommission(5);
    setCreditLine(0);
    clearError();
    setSuccessMsg(null);
  };

  const closeModal = () => {
    setModalProvider(null);
    clearError();
  };

  const handleConnect = async () => {
    if (!modalProvider) return;
    clearError();
    setSuccessMsg(null);
    try {
      await handleRequestConnection({
        providerCode: modalProvider.providerCode,
        requestedCommission: commission,
        requestedCreditLine: creditLine,
      });
      setSuccessMsg(`تم إرسال طلب الربط إلى ${modalProvider.name} بنجاح.`);
      setModalProvider(null);
      refetch();
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

      {/* Global success banner */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="shrink-0" />
          {successMsg}
          <button className="mr-auto" onClick={() => setSuccessMsg(null)}><X size={14} /></button>
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
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
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
          {filtered.map((provider) => {
            const status = (provider.connectionStatus ?? 'not_connected') as ConnectionStatus;
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_connected;
            return (
              <div
                key={provider.id}
                className="rounded-2xl border bg-white p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-snug">{provider.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{provider.providerCode}</p>
                  </div>
                </div>

                {/* Status pill */}
                <div className={`self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.pill}`}>
                  {cfg.icon}
                  {cfg.label}
                </div>

                {/* Active: show commission & credit */}
                {status === 'active' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 border border-border px-3 py-2">
                      <p className="text-muted-foreground mb-0.5">العمولة</p>
                      <p className="font-bold text-sm">{provider.commissionRate ?? '—'}%</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-border px-3 py-2">
                      <p className="text-muted-foreground mb-0.5">حد الائتمان</p>
                      <p className="font-bold text-sm">{provider.creditLimit != null ? provider.creditLimit.toLocaleString() : '—'}</p>
                    </div>
                  </div>
                )}

                {/* Action button */}
                {cfg.canConnect && (
                  <Button size="sm" className="w-full mt-auto" onClick={() => openModal(provider)}>
                    إرسال طلب ربط
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Connection modal ──────────────────────────────────────────────── */}
      {modalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 size={17} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">{modalProvider.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{modalProvider.providerCode}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                حدّد العمولة المطلوبة وحد الائتمان — سيراجع المزود طلبك ويوافق عليه أو يرفضه.
              </p>

              {connectionError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  {connectionError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-semibold">نسبة العمولة المطلوبة (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={commission}
                  onChange={(e) => setCommission(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold">حد الائتمان المطلوب</label>
                <Input
                  type="number"
                  min={0}
                  value={creditLine}
                  onChange={(e) => setCreditLine(Number(e.target.value))}
                  placeholder="0 = بدون ائتمان"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-border bg-slate-50">
              <Button className="flex-1" onClick={handleConnect} disabled={isRequesting}>
                {isRequesting
                  ? <><Loader2 size={14} className="animate-spin ml-1.5" />جاري الإرسال…</>
                  : 'إرسال طلب الربط'}
              </Button>
              <Button variant="outline" onClick={closeModal} disabled={isRequesting}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectProviderPage;
