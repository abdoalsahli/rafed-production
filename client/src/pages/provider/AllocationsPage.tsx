import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Package, Plus, FileDown, CheckCircle2, Truck, XCircle,
  Loader2, ChevronLeft, Trash2, AlertCircle, ClipboardList,
} from 'lucide-react';

/* ── Status config ─────────────────────────────────────────────────────────── */
type OrderStatus = 'draft' | 'confirmed' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<OrderStatus, { label: string; pill: string }> = {
  draft:     { label: 'مسودة',    pill: 'bg-slate-100 text-slate-600 border-slate-200' },
  confirmed: { label: 'مؤكد',     pill: 'bg-blue-100 text-blue-700 border-blue-200' },
  delivered: { label: 'تم التسليم', pill: 'bg-green-100 text-green-700 border-green-200' },
  cancelled: { label: 'ملغى',     pill: 'bg-red-100 text-red-600 border-red-200' },
};

/* ── helpers ───────────────────────────────────────────────────────────────── */
function b64ToBlob(b64: string, mime: string) {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════════════════════
   AllocationsPage
   ══════════════════════════════════════════════════════════════════════════════ */
export const AllocationsPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── New order form ── */
  const [newClient, setNewClient]     = useState('');
  const [newPhone, setNewPhone]       = useState('');
  const [newNotes, setNewNotes]       = useState('');

  /* ── Add item form ── */
  const [addProductId, setAddProductId] = useState<number | ''>('');
  const [addQty, setAddQty]             = useState(1);

  const utils = trpc.useUtils();

  const { data: orders, isLoading: ordersLoading } = trpc.providerAllocations.listOrders.useQuery(undefined, { enabled: view === 'list' });
  const { data: order, isLoading: orderLoading }   = trpc.providerAllocations.getOrder.useQuery(
    { orderId: selectedOrderId! },
    { enabled: view === 'detail' && !!selectedOrderId }
  );
  const { data: allProducts } = trpc.provider.listProducts.useQuery(undefined, { staleTime: 60_000 });

  const createOrder  = trpc.providerAllocations.createOrder.useMutation();
  const upsertItem   = trpc.providerAllocations.upsertItem.useMutation();
  const removeItem   = trpc.providerAllocations.removeItem.useMutation();
  const confirmOrder = trpc.providerAllocations.confirmOrder.useMutation();
  const markDelivered = trpc.providerAllocations.markDelivered.useMutation();
  const cancelOrder  = trpc.providerAllocations.cancelOrder.useMutation();
  const exportExcel  = trpc.providerAllocations.exportExcel.useMutation();

  const refetchAll = () => {
    utils.providerAllocations.listOrders.invalidate();
    if (selectedOrderId) utils.providerAllocations.getOrder.invalidate({ orderId: selectedOrderId });
  };

  const handleCreateOrder = async () => {
    if (!newClient.trim()) return;
    setError(null);
    try {
      const { orderId } = await createOrder.mutateAsync({ clientName: newClient.trim(), clientPhone: newPhone.trim() || undefined, clientNotes: newNotes.trim() || undefined });
      setSelectedOrderId(orderId);
      setView('detail');
      setNewClient(''); setNewPhone(''); setNewNotes('');
      refetchAll();
    } catch (e: any) { setError(e.message); }
  };

  const handleAddItem = async () => {
    if (!addProductId || !selectedOrderId) return;
    setError(null);
    try {
      await upsertItem.mutateAsync({ orderId: selectedOrderId, productId: Number(addProductId), quantity: addQty });
      setAddProductId(''); setAddQty(1);
      refetchAll();
    } catch (e: any) { setError(e.message); }
  };

  const handleConfirm = async () => {
    if (!selectedOrderId) return;
    setError(null);
    try {
      await confirmOrder.mutateAsync({ orderId: selectedOrderId });
      refetchAll();
    } catch (e: any) { setError(e.message); }
  };

  const handleDeliver = async () => {
    if (!selectedOrderId) return;
    setError(null);
    try {
      await markDelivered.mutateAsync({ orderId: selectedOrderId });
      refetchAll();
    } catch (e: any) { setError(e.message); }
  };

  const handleCancel = async () => {
    if (!selectedOrderId) return;
    setError(null);
    try {
      await cancelOrder.mutateAsync({ orderId: selectedOrderId });
      refetchAll();
    } catch (e: any) { setError(e.message); }
  };

  const handleExport = async () => {
    if (!selectedOrderId) return;
    setError(null);
    try {
      const { base64, filename } = await exportExcel.mutateAsync({ orderId: selectedOrderId });
      const blob = b64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      triggerDownload(blob, filename);
    } catch (e: any) { setError(e.message); }
  };

  /* ── LIST VIEW ────────────────────────────────────────────────────────────── */
  if (view === 'list') return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="الطلبات والتخصيصات" subtitle="أنشئ طلب تخصيص كروت وسلّمه لعميلك مع ملف Excel" />

      <div className="flex justify-end">
        <Button onClick={() => { setView('create'); setError(null); }}>
          <Plus size={15} className="ml-1.5" /> طلب جديد
        </Button>
      </div>

      {ordersLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-20 justify-center">
          <Loader2 size={18} className="animate-spin" /> جاري التحميل…
        </div>
      ) : !orders?.length ? (
        <div className="text-center text-muted-foreground py-20">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد طلبات بعد.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const cfg = STATUS_CONFIG[o.status as OrderStatus] ?? STATUS_CONFIG.draft;
            return (
              <button
                key={o.id}
                onClick={() => { setSelectedOrderId(o.id); setView('detail'); setError(null); }}
                className="rounded-2xl border bg-white p-5 text-right shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.pill}`}>
                    {cfg.label}
                  </div>
                  <p className="font-bold text-sm leading-snug">{o.clientName}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-lg bg-slate-50 border px-3 py-2">
                    <p>المنتجات</p><p className="font-bold text-foreground text-sm">{o.lineCount}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border px-3 py-2">
                    <p>إجمالي الكروت</p><p className="font-bold text-foreground text-sm">{o.totalRequested}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('ar-LY')}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ── CREATE VIEW ──────────────────────────────────────────────────────────── */
  if (view === 'create') return (
    <div className="p-6 md:p-8 space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={20} />
        </button>
        <PageHeader title="طلب جديد" subtitle="أدخل بيانات العميل ثم أضف المنتجات" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />{error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 space-y-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-semibold">اسم العميل *</label>
          <Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="اسم الشركة أو الشخص" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold">رقم الهاتف</label>
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+218…" dir="ltr" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold">ملاحظات</label>
          <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="أي معلومات إضافية…" />
        </div>
        <Button className="w-full" onClick={handleCreateOrder} disabled={!newClient.trim() || createOrder.isPending}>
          {createOrder.isPending ? <><Loader2 size={14} className="animate-spin ml-1.5" />جاري الإنشاء…</> : 'إنشاء الطلب'}
        </Button>
      </div>
    </div>
  );

  /* ── DETAIL VIEW ──────────────────────────────────────────────────────────── */
  if (!order && orderLoading) return (
    <div className="flex items-center gap-2 text-muted-foreground py-32 justify-center">
      <Loader2 size={18} className="animate-spin" /> جاري التحميل…
    </div>
  );
  if (!order) return null;

  const cfg = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.draft;
  const isDraft = order.status === 'draft';
  const isConfirmed = order.status === 'confirmed';
  const isBusy = confirmOrder.isPending || markDelivered.isPending || cancelOrder.isPending || exportExcel.isPending || upsertItem.isPending || removeItem.isPending;

  // Products not yet in the order
  const usedProductIds = new Set((order.items ?? []).map((i: any) => i.productId));
  const availableProducts = (allProducts ?? []).filter((p: any) => !usedProductIds.has(p.id) && p.status === 'active');

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => { setView('list'); setSelectedOrderId(null); }} className="text-muted-foreground hover:text-foreground transition-colors mt-1">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{order.clientName}</h1>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.pill}`}>{cfg.label}</span>
          </div>
          {order.clientPhone && <p className="text-sm text-muted-foreground mt-0.5">{order.clientPhone}</p>}
          {order.clientNotes && <p className="text-sm text-muted-foreground">{order.clientNotes}</p>}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />{error}
          <button className="mr-auto" onClick={() => setError(null)}><XCircle size={14} /></button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <Button onClick={handleConfirm} disabled={!order.items?.length || isBusy}>
            {confirmOrder.isPending ? <Loader2 size={14} className="animate-spin ml-1.5" /> : <CheckCircle2 size={15} className="ml-1.5" />}
            تأكيد الطلب
          </Button>
        )}
        {isConfirmed && (
          <>
            <Button onClick={handleDeliver} disabled={isBusy}>
              {markDelivered.isPending ? <Loader2 size={14} className="animate-spin ml-1.5" /> : <Truck size={15} className="ml-1.5" />}
              تسليم
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isBusy}>
              {exportExcel.isPending ? <Loader2 size={14} className="animate-spin ml-1.5" /> : <FileDown size={15} className="ml-1.5" />}
              تصدير Excel
            </Button>
          </>
        )}
        {order.status === 'delivered' && (
          <Button variant="outline" onClick={handleExport} disabled={isBusy}>
            {exportExcel.isPending ? <Loader2 size={14} className="animate-spin ml-1.5" /> : <FileDown size={15} className="ml-1.5" />}
            تصدير Excel
          </Button>
        )}
        {(isDraft || isConfirmed) && (
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleCancel} disabled={isBusy}>
            إلغاء الطلب
          </Button>
        )}
        {order.status === 'cancelled' && (
          <Button onClick={() => setView('create')} variant="outline">
            <Plus size={15} className="ml-1.5" /> إنشاء طلب جديد
          </Button>
        )}
      </div>

      {/* Items table */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b font-semibold text-sm">المنتجات</div>

        {!order.items?.length ? (
          <p className="text-center text-muted-foreground py-10 text-sm">لم يُضف أي منتج بعد.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-muted-foreground text-xs">
              <tr>
                <th className="text-right px-5 py-2.5 font-medium">المنتج</th>
                <th className="text-center px-4 py-2.5 font-medium">المطلوب</th>
                <th className="text-center px-4 py-2.5 font-medium">المتاح</th>
                <th className="text-center px-4 py-2.5 font-medium">المنجز</th>
                {isDraft && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-medium">{item.productDisplayName || item.productName}</td>
                  <td className="px-4 py-3 text-center">{item.quantityRequested}</td>
                  <td className={`px-4 py-3 text-center font-semibold ${item.availableStock < item.quantityRequested ? 'text-red-600' : 'text-green-600'}`}>
                    {item.availableStock}
                  </td>
                  <td className="px-4 py-3 text-center">{item.quantityFulfilled}</td>
                  {isDraft && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={async () => { setError(null); try { await removeItem.mutateAsync({ itemId: item.id }); refetchAll(); } catch (e: any) { setError(e.message); } }}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
                        disabled={isBusy}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add item — only in draft */}
      {isDraft && availableProducts.length > 0 && (
        <div className="rounded-2xl border bg-white shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold">إضافة منتج</p>
          <div className="flex gap-3 flex-wrap">
            <select
              value={addProductId}
              onChange={(e) => setAddProductId(Number(e.target.value) || '')}
              className="flex-1 min-w-[180px] h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— اختر منتجاً —</option>
              {availableProducts.map((p: any) => (
                <option key={p.id} value={p.id}>{p.displayName || p.name}</option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              value={addQty}
              onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
              className="w-24"
              placeholder="الكمية"
            />
            <Button onClick={handleAddItem} disabled={!addProductId || isBusy}>
              {upsertItem.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
            </Button>
          </div>
        </div>
      )}

      {isDraft && availableProducts.length === 0 && order.items?.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">تم إضافة جميع المنتجات المتاحة.</p>
      )}
    </div>
  );
};

export default AllocationsPage;
