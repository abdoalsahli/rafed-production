import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, FileDown, CheckCircle2, Truck, XCircle,
  Loader2, ChevronRight, AlertCircle, ClipboardList,
  User, Phone, StickyNote, Package,
} from 'lucide-react';

/* ── Status config ─────────────────────────────────────────────────────────── */
type OrderStatus = 'draft' | 'confirmed' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<OrderStatus, { label: string; pill: string }> = {
  draft:     { label: 'مسودة',       pill: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'مؤكد',        pill: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'تم التسليم',  pill: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغى',        pill: 'bg-red-100 text-red-600' },
};

function b64ToBlob(b64: string, mime: string) {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════════════ */
export const AllocationsPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newClient, setNewClient] = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newNotes, setNewNotes]   = useState('');

  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const utils = trpc.useUtils();

  const { data: orders, isLoading: ordersLoading } = trpc.providerAllocations.listOrders.useQuery(
    undefined, { enabled: view === 'list' }
  );
  const { data: order, isLoading: orderLoading } = trpc.providerAllocations.getOrder.useQuery(
    { orderId: selectedOrderId! },
    { enabled: view === 'detail' && !!selectedOrderId }
  );

  const createOrder   = trpc.providerAllocations.createOrder.useMutation();
  const upsertItem    = trpc.providerAllocations.upsertItem.useMutation();
  const removeItem    = trpc.providerAllocations.removeItem.useMutation();
  const confirmOrder  = trpc.providerAllocations.confirmOrder.useMutation();
  const markDelivered = trpc.providerAllocations.markDelivered.useMutation();
  const cancelOrder   = trpc.providerAllocations.cancelOrder.useMutation();
  const exportExcel   = trpc.providerAllocations.exportExcel.useMutation();

  const refetchAll = () => {
    utils.providerAllocations.listOrders.invalidate();
    if (selectedOrderId) utils.providerAllocations.getOrder.invalidate({ orderId: selectedOrderId });
  };

  useEffect(() => {
    if (!order?.items) return;
    const initial: Record<number, string> = {};
    for (const item of order.items as any[]) {
      initial[item.productId] = String(item.quantityRequested);
    }
    setQtyMap(initial);
  }, [order]);

  const handleCreateOrder = async () => {
    if (!newClient.trim()) return;
    setError(null);
    try {
      const { orderId } = await createOrder.mutateAsync({
        clientName: newClient.trim(),
        clientPhone: newPhone.trim() || undefined,
        clientNotes: newNotes.trim() || undefined,
      });
      setSelectedOrderId(orderId);
      setView('detail');
      setNewClient(''); setNewPhone(''); setNewNotes('');
    } catch (e: any) { setError(e.message); }
  };

  const handleSaveQuantities = async () => {
    if (!selectedOrderId || !order) return;
    setError(null);
    setSaving(true);
    try {
      const allProducts: any[] = (order as any).allProducts ?? [];
      for (const item of order.items as any[]) {
        const q = parseInt(qtyMap[item.productId] ?? '0', 10);
        if (!q || q <= 0) await removeItem.mutateAsync({ itemId: item.id });
      }
      for (const [pidStr, qtyStr] of Object.entries(qtyMap)) {
        const pid = Number(pidStr);
        const qty = parseInt(qtyStr, 10);
        if (!qty || qty <= 0) continue;
        const product = allProducts.find((p: any) => p.id === pid);
        if (!product) continue;
        await upsertItem.mutateAsync({ orderId: selectedOrderId, productId: pid, quantity: qty });
      }
      refetchAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm  = async () => { if (!selectedOrderId) return; setError(null); try { await confirmOrder.mutateAsync({ orderId: selectedOrderId }); refetchAll(); } catch (e: any) { setError(e.message); } };
  const handleDeliver  = async () => { if (!selectedOrderId) return; setError(null); try { await markDelivered.mutateAsync({ orderId: selectedOrderId }); refetchAll(); } catch (e: any) { setError(e.message); } };
  const handleCancel   = async () => { if (!selectedOrderId) return; setError(null); try { await cancelOrder.mutateAsync({ orderId: selectedOrderId }); refetchAll(); } catch (e: any) { setError(e.message); } };
  const handleExport   = async () => {
    if (!selectedOrderId) return; setError(null);
    try {
      const { base64, filename } = await exportExcel.mutateAsync({ orderId: selectedOrderId });
      triggerDownload(b64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), filename);
    } catch (e: any) { setError(e.message); }
  };

  /* ══ LIST VIEW ══════════════════════════════════════════════════════════════ */
  if (view === 'list') return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة تخصيص الكروت للعملاء</p>
        </div>
        <Button onClick={() => { setView('create'); setError(null); }}>
          <Plus size={15} className="ml-1.5" /> طلب جديد
        </Button>
      </div>

      {ordersLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-20 justify-center">
          <Loader2 size={18} className="animate-spin" /> جاري التحميل…
        </div>
      ) : !orders?.length ? (
        <div className="text-center text-muted-foreground py-24 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <ClipboardList size={24} className="opacity-40" />
          </div>
          <p className="font-medium">لا توجد طلبات بعد</p>
          <p className="text-xs">أنشئ أول طلب تخصيص لعميلك</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const cfg = STATUS_CONFIG[o.status as OrderStatus] ?? STATUS_CONFIG.draft;
            return (
              <button
                key={o.id}
                onClick={() => { setSelectedOrderId(o.id); setView('detail'); setError(null); }}
                className="rounded-2xl border bg-white p-5 text-right shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-4 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>
                    {cfg.label}
                  </span>
                  <p className="font-bold text-base leading-snug group-hover:text-primary transition-colors">
                    {o.clientName}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-right">
                    <p className="text-[11px] text-muted-foreground mb-0.5">المنتجات</p>
                    <p className="font-bold text-lg leading-none">{o.lineCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-right">
                    <p className="text-[11px] text-muted-foreground mb-0.5">إجمالي الكروت</p>
                    <p className="font-bold text-lg leading-none">{o.totalRequested}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ══ CREATE VIEW ════════════════════════════════════════════════════════════ */
  if (view === 'create') return (
    <div className="p-6 md:p-8 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-slate-100">
          <ChevronRight size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">طلب جديد</h1>
          <p className="text-sm text-muted-foreground">أدخل بيانات العميل</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />{error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 space-y-4 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-foreground">
            <User size={13} className="text-muted-foreground" /> اسم العميل <span className="text-red-500">*</span>
          </label>
          <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="اسم الشركة أو الشخص"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateOrder()} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-foreground">
            <Phone size={13} className="text-muted-foreground" /> رقم الهاتف
          </label>
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+218…" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-foreground">
            <StickyNote size={13} className="text-muted-foreground" /> ملاحظات
          </label>
          <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="أي معلومات إضافية…" />
        </div>
        <Button className="w-full mt-2" onClick={handleCreateOrder} disabled={!newClient.trim() || createOrder.isPending}>
          {createOrder.isPending ? <><Loader2 size={14} className="animate-spin ml-1.5" />جاري الإنشاء…</> : 'التالي: تحديد الكميات ←'}
        </Button>
      </div>
    </div>
  );

  /* ══ DETAIL VIEW ════════════════════════════════════════════════════════════ */
  if (!order && orderLoading) return (
    <div className="flex items-center gap-2 text-muted-foreground py-32 justify-center">
      <Loader2 size={18} className="animate-spin" /> جاري التحميل…
    </div>
  );
  if (!order) return null;

  const cfg = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.draft;
  const isDraft     = order.status === 'draft';
  const isConfirmed = order.status === 'confirmed';
  const isDelivered = order.status === 'delivered';
  const isBusy = confirmOrder.isPending || markDelivered.isPending || cancelOrder.isPending ||
                 exportExcel.isPending || saving;

  const activeProducts: any[] = (order as any).allProducts ?? [];
  const orderItems: any[]     = (order.items as any[]) ?? [];

  const savedQty: Record<number, number> = {};
  for (const item of orderItems) savedQty[item.productId] = item.quantityRequested;

  const hasUnsaved = isDraft && activeProducts.some((p: any) => {
    const current = parseInt(qtyMap[p.id] ?? '0', 10) || 0;
    return current !== (savedQty[p.id] ?? 0);
  });

  const totalCards = Object.values(qtyMap).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);

  /* For non-draft: only show products that have items */
  const displayProducts = isDraft
    ? activeProducts
    : activeProducts.filter((p: any) => savedQty[p.id] > 0);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => { setView('list'); setSelectedOrderId(null); }}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-slate-100 mt-0.5 shrink-0"
        >
          <ChevronRight size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold truncate">{order.clientName}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.pill}`}>{cfg.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            {(order as any).clientPhone && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone size={11} />{(order as any).clientPhone}
              </span>
            )}
            {(order as any).clientNotes && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <StickyNote size={11} />{(order as any).clientNotes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><XCircle size={14} /></button>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {isDraft && hasUnsaved && (
          <Button onClick={handleSaveQuantities} disabled={isBusy} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
            حفظ الكميات
          </Button>
        )}
        {isDraft && !hasUnsaved && orderItems.length > 0 && (
          <Button onClick={handleConfirm} disabled={isBusy} className="gap-1.5">
            {confirmOrder.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
            تأكيد الطلب
          </Button>
        )}
        {isConfirmed && (
          <Button onClick={handleDeliver} disabled={isBusy} className="gap-1.5">
            {markDelivered.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={15} />}
            تسليم
          </Button>
        )}
        {(isConfirmed || isDelivered) && (
          <Button variant="outline" onClick={handleExport} disabled={isBusy} className="gap-1.5">
            {exportExcel.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={15} />}
            تصدير Excel
          </Button>
        )}
        {(isDraft || isConfirmed) && (
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 mr-auto" onClick={handleCancel} disabled={isBusy}>
            إلغاء الطلب
          </Button>
        )}
        {order.status === 'cancelled' && (
          <Button onClick={() => setView('create')} variant="outline" className="gap-1.5">
            <Plus size={15} /> إنشاء طلب جديد
          </Button>
        )}
        {isDraft && totalCards > 0 && !hasUnsaved && (
          <span className="text-sm text-muted-foreground mr-auto">
            إجمالي: <strong className="text-foreground">{totalCards}</strong> كرت
          </span>
        )}
        {isDraft && hasUnsaved && totalCards > 0 && (
          <span className="text-sm text-amber-600 mr-auto font-medium">
            ● {totalCards} كرت — غير محفوظ
          </span>
        )}
      </div>

      {/* ── Products card ── */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Package size={15} className="text-muted-foreground" />
            المنتجات
          </div>
          {isDraft && (
            <span className="text-xs text-muted-foreground">
              أدخل الكمية المطلوبة لكل منتج
            </span>
          )}
        </div>

        {displayProducts.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Package size={28} className="opacity-20" />
            <p className="text-sm">{isDraft ? 'لا توجد منتجات نشطة' : 'لا توجد منتجات في هذا الطلب'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-right px-5 py-2.5 font-medium">المنتج</th>
                {(isConfirmed || isDelivered) && (
                  <th className="text-center px-4 py-2.5 font-medium">المتاح</th>
                )}
                <th className="text-center px-4 py-2.5 font-medium w-36">
                  {isDraft ? 'الكمية' : 'المطلوب'}
                </th>
                {(isConfirmed || isDelivered) && (
                  <th className="text-center px-4 py-2.5 font-medium">المنجز</th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayProducts.map((product: any, idx: number) => {
                const savedItem = orderItems.find((i: any) => i.productId === product.id);
                const qty = qtyMap[product.id] ?? '';
                const hasQty = parseInt(qty, 10) > 0;
                const isLast = idx === displayProducts.length - 1;

                return (
                  <tr
                    key={product.id}
                    className={[
                      !isLast ? 'border-b border-border/60' : '',
                      isDraft && hasQty ? 'bg-primary/5' : '',
                      isDraft && !hasQty ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium leading-snug">{product.displayName || product.name}</p>
                      {product.faceValue && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.faceValue} {product.currency || 'LYD'}
                        </p>
                      )}
                    </td>

                    {(isConfirmed || isDelivered) && (
                      <td className={`px-4 py-3.5 text-center text-xs font-semibold ${
                        savedItem && savedItem.availableStock < savedItem.quantityRequested
                          ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {savedItem?.availableStock ?? '—'}
                      </td>
                    )}

                    <td className="px-4 py-3 text-center">
                      {isDraft ? (
                        <Input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) => setQtyMap((prev) => ({ ...prev, [product.id]: e.target.value }))}
                          className="w-24 mx-auto text-center h-9 text-sm font-medium"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`font-semibold ${savedItem ? '' : 'text-muted-foreground'}`}>
                          {savedItem?.quantityRequested ?? '—'}
                        </span>
                      )}
                    </td>

                    {(isConfirmed || isDelivered) && (
                      <td className="px-4 py-3.5 text-center font-semibold">
                        {savedItem?.quantityFulfilled ?? '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AllocationsPage;
