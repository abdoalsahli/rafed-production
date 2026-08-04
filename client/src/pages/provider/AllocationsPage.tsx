import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, FileDown, CheckCircle2, Truck, XCircle,
  Loader2, ChevronRight, AlertCircle, ClipboardList,
  User, Phone, StickyNote, Package, Trash2, AlertTriangle,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type OrderStatus = 'draft' | 'confirmed' | 'delivered' | 'cancelled';
type ConfirmAction = 'confirm' | 'cancel' | 'delete' | 'deliver';

const STATUS_CONFIG: Record<OrderStatus, { label: string; pill: string }> = {
  draft:     { label: 'مسودة',       pill: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'مؤكد',        pill: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'تم التسليم',  pill: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغى',        pill: 'bg-red-100 text-red-600' },
};

const CONFIRM_DIALOG: Record<ConfirmAction, { title: string; description: string; actionLabel: string; destructive: boolean }> = {
  confirm:  { title: 'تأكيد الطلب',   description: 'سيتم حجز الكروت من المخزون فوراً. لا يمكن التراجع عن هذا الإجراء.',    actionLabel: 'تأكيد',       destructive: false },
  deliver:  { title: 'تسليم الطلب',   description: 'هل تم تسليم الكروت للعميل؟ سيتغير حالة الطلب إلى "تم التسليم".',      actionLabel: 'تسليم',       destructive: false },
  cancel:   { title: 'إلغاء الطلب',   description: 'سيتم إلغاء الطلب وإعادة الكروت المحجوزة إلى المخزون.',                actionLabel: 'إلغاء الطلب', destructive: true  },
  delete:   { title: 'حذف الطلب',     description: 'سيتم حذف هذا المسودة نهائياً. لا يمكن التراجع عن هذا الإجراء.',       actionLabel: 'حذف',         destructive: true  },
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */
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
function fmtCurrency(val: number, currency = 'LYD') {
  return `${val.toLocaleString('ar-LY')} ${currency}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   AllocationsPage
   ══════════════════════════════════════════════════════════════════════════════ */
export const AllocationsPage: React.FC = () => {
  const [view, setView]                     = useState<'list' | 'create' | 'detail'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  /* Create form */
  const [newClient, setNewClient] = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newNotes, setNewNotes]   = useState('');

  /* Quantity map */
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  /* Confirmation dialog */
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

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
  const deleteOrder   = trpc.providerAllocations.deleteOrder.useMutation();
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

  /* ── Handlers ── */
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
        if (!allProducts.find((p: any) => p.id === pid)) continue;
        await upsertItem.mutateAsync({ orderId: selectedOrderId, productId: pid, quantity: qty });
      }
      refetchAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const executeConfirmedAction = async (action: ConfirmAction) => {
    if (!selectedOrderId) return;
    setError(null);
    try {
      if (action === 'confirm')  { await confirmOrder.mutateAsync({ orderId: selectedOrderId }); refetchAll(); }
      if (action === 'deliver')  { await markDelivered.mutateAsync({ orderId: selectedOrderId }); refetchAll(); }
      if (action === 'cancel')   { await cancelOrder.mutateAsync({ orderId: selectedOrderId }); refetchAll(); }
      if (action === 'delete')   {
        await deleteOrder.mutateAsync({ orderId: selectedOrderId });
        setView('list');
        setSelectedOrderId(null);
        refetchAll();
      }
    } catch (e: any) { setError(e.message); }
  };

  const handleExport = async () => {
    if (!selectedOrderId) return;
    setError(null);
    try {
      const { base64, filename } = await exportExcel.mutateAsync({ orderId: selectedOrderId });
      triggerDownload(b64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), filename);
    } catch (e: any) { setError(e.message); }
  };

  /* ══ LIST VIEW ══════════════════════════════════════════════════════════════ */
  if (view === 'list') return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
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
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>{cfg.label}</span>
                  <p className="font-bold text-base leading-snug group-hover:text-primary transition-colors">{o.clientName}</p>
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
          <label className="text-sm font-medium flex items-center gap-1.5">
            <User size={13} className="text-muted-foreground" /> اسم العميل <span className="text-red-500">*</span>
          </label>
          <Input value={newClient} onChange={(e) => setNewClient(e.target.value)}
            placeholder="اسم الشركة أو الشخص" onKeyDown={(e) => e.key === 'Enter' && handleCreateOrder()} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Phone size={13} className="text-muted-foreground" /> رقم الهاتف
          </label>
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+218…" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5">
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

  const cfg         = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.draft;
  const isDraft     = order.status === 'draft';
  const isConfirmed = order.status === 'confirmed';
  const isDelivered = order.status === 'delivered';
  const isBusy      = confirmOrder.isPending || markDelivered.isPending || cancelOrder.isPending ||
                      deleteOrder.isPending || exportExcel.isPending || saving;

  const activeProducts: any[] = (order as any).allProducts ?? [];
  const orderItems: any[]     = (order.items as any[]) ?? [];

  const savedQty: Record<number, number> = {};
  for (const item of orderItems) savedQty[item.productId] = item.quantityRequested;

  const hasUnsaved = isDraft && activeProducts.some((p: any) => {
    const current = parseInt(qtyMap[p.id] ?? '0', 10) || 0;
    return current !== (savedQty[p.id] ?? 0);
  });

  /* Over-quantity warnings: productId → true if qty > available stock */
  const overStock: Record<number, boolean> = {};
  for (const p of activeProducts) {
    const qty = parseInt(qtyMap[p.id] ?? '0', 10) || 0;
    if (qty > 0 && qty > Number(p.availableStock ?? 0)) overStock[p.id] = true;
  }
  const hasOverStock = Object.values(overStock).some(Boolean);

  /* Totals */
  const draftTotal = activeProducts.reduce((sum, p) => {
    const qty = parseInt(qtyMap[p.id] ?? '0', 10) || 0;
    return sum + qty * (Number(p.faceValue) || 0);
  }, 0);
  const savedTotal = orderItems.reduce((sum, item) => {
    const product = activeProducts.find((p: any) => p.id === item.productId);
    return sum + item.quantityRequested * (Number(product?.faceValue) || 0);
  }, 0);
  const totalCards = Object.values(qtyMap).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);

  /* For non-draft: only show rows that have ordered quantities */
  const displayProducts = isDraft
    ? activeProducts
    : activeProducts.filter((p: any) => (savedQty[p.id] ?? 0) > 0);

  /* Detect a single currency for display (use first product's currency or LYD) */
  const currency = activeProducts[0]?.currency || 'LYD';

  /* ── Confirmation dialog ── */
  const dialogCfg = confirmAction ? CONFIRM_DIALOG[confirmAction] : null;

  return (
    <>
      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={dialogCfg?.destructive ? 'text-red-600' : ''}>
              {dialogCfg?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{dialogCfg?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBusy}
              className={dialogCfg?.destructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
              onClick={async () => {
                const action = confirmAction!;
                setConfirmAction(null);
                await executeConfirmedAction(action);
              }}
            >
              {isBusy ? <Loader2 size={14} className="animate-spin ml-1.5" /> : null}
              {dialogCfg?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => { setView('list'); setSelectedOrderId(null); }}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100 mt-0.5 shrink-0 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold truncate">{(order as any).clientName}</h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.pill}`}>{cfg.label}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 mt-1">
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

        {/* ── Over-stock global warning ── */}
        {isDraft && hasOverStock && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="shrink-0" />
            بعض الكميات المطلوبة تتجاوز المخزون المتاح. يرجى مراجعة الكميات المُحاطة بإطار أحمر.
          </div>
        )}

        {/* ── Action bar ── */}
        <div className="flex flex-wrap gap-2 items-center">
          {isDraft && hasUnsaved && (
            <Button onClick={handleSaveQuantities} disabled={isBusy || hasOverStock} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
              حفظ الكميات
            </Button>
          )}
          {isDraft && !hasUnsaved && orderItems.length > 0 && (
            <Button onClick={() => setConfirmAction('confirm')} disabled={isBusy} className="gap-1.5">
              <CheckCircle2 size={15} /> تأكيد الطلب
            </Button>
          )}
          {isConfirmed && (
            <Button onClick={() => setConfirmAction('deliver')} disabled={isBusy} className="gap-1.5">
              <Truck size={15} /> تسليم
            </Button>
          )}
          {(isConfirmed || isDelivered) && (
            <Button variant="outline" onClick={handleExport} disabled={isBusy} className="gap-1.5">
              {exportExcel.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={15} />}
              تصدير Excel
            </Button>
          )}

          {/* Destructive actions pushed to end */}
          <div className="mr-auto flex gap-2">
            {isDraft && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                onClick={() => setConfirmAction('delete')} disabled={isBusy}>
                <Trash2 size={14} /> حذف المسودة
              </Button>
            )}
            {isConfirmed && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                onClick={() => setConfirmAction('cancel')} disabled={isBusy}>
                <XCircle size={14} /> إلغاء الطلب
              </Button>
            )}
          </div>

          {order.status === 'cancelled' && (
            <Button onClick={() => setView('create')} variant="outline" className="gap-1.5">
              <Plus size={15} /> إنشاء طلب جديد
            </Button>
          )}
        </div>

        {/* ── Summary stats ── */}
        {(isDraft || isConfirmed || isDelivered) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground mb-1">إجمالي الكروت</p>
              <p className="text-xl font-bold">{isDraft ? totalCards : orderItems.reduce((s, i) => s + i.quantityRequested, 0)}</p>
            </div>
            <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground mb-1">القيمة الإجمالية</p>
              <p className="text-xl font-bold">{fmtCurrency(isDraft ? draftTotal : savedTotal, currency)}</p>
            </div>
            <div className="rounded-xl border bg-white px-4 py-3 shadow-sm sm:block hidden">
              <p className="text-xs text-muted-foreground mb-1">المنتجات</p>
              <p className="text-xl font-bold">{isDraft ? activeProducts.filter(p => (parseInt(qtyMap[p.id] ?? '0', 10) || 0) > 0).length : orderItems.length}</p>
            </div>
          </div>
        )}

        {/* ── Products table ── */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Package size={15} className="text-muted-foreground" /> المنتجات
            </div>
            {isDraft && (
              <span className="text-xs text-muted-foreground">أدخل الكمية المطلوبة لكل منتج</span>
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
                  <th className="text-center px-4 py-2.5 font-medium">المتاح</th>
                  <th className="text-center px-4 py-2.5 font-medium" style={{ width: '8rem', minWidth: '8rem', maxWidth: '8rem' }}>
                    {isDraft ? 'الكمية' : 'المطلوب'}
                  </th>
                  {(isConfirmed || isDelivered) && (
                    <th className="text-center px-4 py-2.5 font-medium">المنجز</th>
                  )}
                  <th className="text-center px-4 py-2.5 font-medium">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((product: any, idx: number) => {
                  const savedItem  = orderItems.find((i: any) => i.productId === product.id);
                  const qty        = isDraft ? (parseInt(qtyMap[product.id] ?? '0', 10) || 0) : (savedItem?.quantityRequested ?? 0);
                  const qtyStr     = qtyMap[product.id] ?? '';
                  const hasQty     = qty > 0;
                  const stock      = Number(product.availableStock ?? 0);
                  const isOver     = isDraft && hasQty && qty > stock;
                  const isLast     = idx === displayProducts.length - 1;
                  const lineTotal  = qty * (Number(product.faceValue) || 0);

                  return (
                    <tr
                      key={product.id}
                      className={[
                        !isLast ? 'border-b border-border/60' : '',
                        isDraft && hasQty && !isOver ? 'bg-primary/5' : '',
                        isDraft && isOver ? 'bg-red-50/60' : '',
                        isDraft && !hasQty ? 'opacity-55' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium leading-snug">{product.displayName || product.name}</p>
                        {product.faceValue && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtCurrency(Number(product.faceValue), product.currency || 'LYD')}
                          </p>
                        )}
                      </td>

                      {/* Available stock */}
                      <td className={`px-4 py-3.5 text-center text-xs font-semibold ${
                        isDraft && isOver ? 'text-red-600' : stock === 0 ? 'text-muted-foreground' : 'text-green-600'
                      }`}>
                        {stock}
                      </td>

                      {/* Quantity input or display */}
                      <td className="py-3 text-center" style={{ width: '8rem', minWidth: '8rem', maxWidth: '8rem' }}>
                        {isDraft ? (
                          <Input
                            type="number"
                            min={0}
                            value={qtyStr}
                            onChange={(e) => setQtyMap((prev) => ({ ...prev, [product.id]: e.target.value }))}
                            className={`mx-auto text-center h-9 text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              isOver ? 'border-red-400 focus-visible:ring-red-400 bg-red-50' : ''
                            }`}
                            style={{ width: '6rem', minWidth: '6rem', maxWidth: '6rem' }}
                            placeholder="0"
                          />
                        ) : (
                          <span className={`font-semibold ${hasQty ? '' : 'text-muted-foreground'}`}>
                            {savedItem?.quantityRequested ?? '—'}
                          </span>
                        )}
                      </td>

                      {/* Fulfilled (confirmed/delivered only) */}
                      {(isConfirmed || isDelivered) && (
                        <td className="px-4 py-3.5 text-center font-semibold">
                          {savedItem?.quantityFulfilled ?? '—'}
                        </td>
                      )}

                      {/* Line total */}
                      <td className="px-4 py-3.5 text-center text-xs text-muted-foreground">
                        {lineTotal > 0 ? fmtCurrency(lineTotal, currency) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              {(isDraft ? totalCards > 0 : orderItems.length > 0) && (
                <tfoot>
                  <tr className="border-t bg-slate-50/80 font-semibold text-sm">
                    <td className="px-5 py-3 text-right">الإجمالي</td>
                    <td />
                    <td className="px-4 py-3 text-center">
                      {isDraft ? totalCards : orderItems.reduce((s, i) => s + i.quantityRequested, 0)}
                    </td>
                    {(isConfirmed || isDelivered) && (
                      <td className="px-4 py-3 text-center">
                        {orderItems.reduce((s, i) => s + (i.quantityFulfilled ?? 0), 0)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center text-primary">
                      {fmtCurrency(isDraft ? draftTotal : savedTotal, currency)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default AllocationsPage;
