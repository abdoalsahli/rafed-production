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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { StatusPill, type StatusVariant } from '@/components/ui/StatusPill';
import {
  Plus, FileDown, CheckCircle2, Truck, XCircle,
  Loader2, ChevronRight, AlertCircle, ClipboardList,
  User, Phone, StickyNote, Package, Trash2, AlertTriangle,
  DollarSign, CreditCard, ShoppingCart,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type OrderStatus = 'draft' | 'confirmed' | 'delivered' | 'cancelled';
type ConfirmAction = 'confirm' | 'cancel' | 'delete' | 'deliver';

const STATUS_PILL: Record<OrderStatus, { variant: StatusVariant; label: string }> = {
  draft:     { variant: 'pending',  label: 'مسودة' },
  confirmed: { variant: 'active',   label: 'مؤكد' },
  delivered: { variant: 'success',  label: 'تم التسليم' },
  cancelled: { variant: 'error',    label: 'ملغى' },
};

const CONFIRM_DIALOG: Record<ConfirmAction, { title: string; description: string; actionLabel: string; destructive: boolean }> = {
  confirm:  { title: 'تأكيد الطلب',   description: 'سيتم حجز الكروت من المخزون فوراً. لا يمكن التراجع عن هذا الإجراء.',    actionLabel: 'تأكيد',       destructive: false },
  deliver:  { title: 'تسليم الطلب',   description: 'هل تم تسليم الكروت للعميل؟ سيتغير حالة الطلب إلى "تم التسليم".',      actionLabel: 'تسليم',       destructive: false },
  cancel:   { title: 'إلغاء الطلب',   description: 'سيتم إلغاء الطلب وإعادة الكروت المحجوزة إلى المخزون.',                actionLabel: 'إلغاء الطلب', destructive: true  },
  delete:   { title: 'حذف الطلب',     description: 'سيتم حذف هذه المسودة نهائياً. لا يمكن التراجع عن هذا الإجراء.',       actionLabel: 'حذف',         destructive: true  },
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
  return `${val.toLocaleString('en-US')} ${currency}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   AllocationsPage
   ══════════════════════════════════════════════════════════════════════════════ */
export const AllocationsPage: React.FC = () => {
  const [view, setView]                       = useState<'list' | 'create' | 'detail'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [error, setError]                     = useState<string | null>(null);

  /* Create form */
  const [newClient, setNewClient] = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newNotes, setNewNotes]   = useState('');

  /* Quantity map */
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  /* Confirmation dialog */
  const [pendingAction, setPendingAction] = useState<{ orderId: number; action: ConfirmAction } | null>(null);

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
        clientName:  newClient.trim(),
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

  const executeConfirmedAction = async (orderId: number, action: ConfirmAction) => {
    setError(null);
    try {
      if (action === 'confirm')  { await confirmOrder.mutateAsync({ orderId }); refetchAll(); }
      if (action === 'deliver')  { await markDelivered.mutateAsync({ orderId }); refetchAll(); }
      if (action === 'cancel')   { await cancelOrder.mutateAsync({ orderId }); refetchAll(); }
      if (action === 'delete')   {
        await deleteOrder.mutateAsync({ orderId });
        if (selectedOrderId === orderId) setSelectedOrderId(null);
        setView('list');
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

  /* ── Shared busy state & dialog ── */
  const isActionBusy = confirmOrder.isPending || markDelivered.isPending ||
                       cancelOrder.isPending   || deleteOrder.isPending;

  const sharedDialog = (
    <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={pendingAction && CONFIRM_DIALOG[pendingAction.action].destructive ? 'text-red-600' : ''}>
            {pendingAction && CONFIRM_DIALOG[pendingAction.action].title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingAction && CONFIRM_DIALOG[pendingAction.action].description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isActionBusy}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            disabled={isActionBusy}
            className={pendingAction && CONFIRM_DIALOG[pendingAction.action].destructive ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            onClick={async () => {
              if (!pendingAction) return;
              const { orderId, action } = pendingAction;
              setPendingAction(null);
              await executeConfirmedAction(orderId, action);
            }}
          >
            {isActionBusy && <Loader2 size={14} className="animate-spin ml-1.5" />}
            {pendingAction && CONFIRM_DIALOG[pendingAction.action].actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  /* ══ LIST VIEW ══════════════════════════════════════════════════════════════ */
  if (view === 'list') return (
    <>
      {sharedDialog}
      <div className="p-6 md:p-8 space-y-6">

        <PageHeader
          title="الطلبات"
          subtitle="إدارة تخصيص الكروت للعملاء"
          actions={
            <Button
              onClick={() => { setView('create'); setError(null); }}
              className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white"
            >
              <Plus size={15} /> طلب جديد
            </Button>
          }
        />

        {error && (
          <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
            <p className="text-sm font-medium text-[#b91c1c]">{error}</p>
          </div>
        )}

        {ordersLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#444651]">جاري التحميل…</p>
            </div>
          </div>
        ) : !orders?.length ? (
          <div className="bg-white border border-[#e2e8f0] rounded-lg">
            <EmptyState
              icon={<ClipboardList size={28} />}
              iconVariant="primary"
              title="لا توجد طلبات بعد"
              description="أنشئ أول طلب تخصيص لعميلك"
              action={{ label: '+ طلب جديد', onClick: () => { setView('create'); setError(null); } }}
            />
          </div>
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">

            {/* Panel header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0]">
              <h2 className="text-sm font-semibold text-[#0b1c30]">
                الطلبات
                <span className="text-[#444651] font-normal ms-2">({orders.length})</span>
              </h2>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العميل</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المنتجات</TableHead>
                  <TableHead>الكروت</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const pill = STATUS_PILL[o.status as OrderStatus] ?? STATUS_PILL.draft;
                  return (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => { setSelectedOrderId(o.id); setView('detail'); setError(null); }}
                    >
                      <TableCell className="font-medium text-[#0b1c30]">{o.clientName}</TableCell>
                      <TableCell>
                        <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                      </TableCell>
                      <TableCell className="text-[#444651]">{o.lineCount}</TableCell>
                      <TableCell className="text-[#444651]">{o.totalRequested}</TableCell>
                      <TableCell className="text-[#444651] text-sm">
                        {new Date(o.createdAt).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          {o.status === 'draft' && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-8 gap-1 text-[#b91c1c] hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                              onClick={() => setPendingAction({ orderId: o.id, action: 'delete' })}
                            >
                              <Trash2 size={13} /> حذف
                            </Button>
                          )}
                          {o.status === 'confirmed' && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-8 gap-1 text-[#b91c1c] hover:bg-[#fee2e2] hover:text-[#b91c1c]"
                              onClick={() => setPendingAction({ orderId: o.id, action: 'cancel' })}
                            >
                              <XCircle size={13} /> إلغاء
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );

  /* ══ CREATE VIEW ════════════════════════════════════════════════════════════ */
  if (view === 'create') return (
    <div className="p-6 md:p-8 space-y-6">

      <PageHeader
        title="طلب جديد"
        subtitle="أدخل بيانات العميل لإنشاء الطلب"
        actions={
          <Button variant="outline" onClick={() => { setView('list'); setError(null); }} className="gap-1.5">
            <ChevronRight size={15} /> رجوع
          </Button>
        }
      />

      {error && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">{error}</p>
        </div>
      )}

      <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 space-y-5 max-w-lg">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0b1c30] flex items-center gap-1.5">
            <User size={13} className="text-[#444651]" /> اسم العميل <span className="text-red-500">*</span>
          </label>
          <Input
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="اسم الشركة أو الشخص"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateOrder()}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0b1c30] flex items-center gap-1.5">
            <Phone size={13} className="text-[#444651]" /> رقم الهاتف
          </label>
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+218…" dir="ltr" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0b1c30] flex items-center gap-1.5">
            <StickyNote size={13} className="text-[#444651]" /> ملاحظات
          </label>
          <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="أي معلومات إضافية…" />
        </div>

        <Button
          className="w-full bg-[#00236f] hover:bg-[#1e3a8a] text-white gap-1.5"
          onClick={handleCreateOrder}
          disabled={!newClient.trim() || createOrder.isPending}
        >
          {createOrder.isPending
            ? <><Loader2 size={14} className="animate-spin" /> جاري الإنشاء…</>
            : 'التالي: تحديد الكميات ←'}
        </Button>
      </div>
    </div>
  );

  /* ══ DETAIL VIEW ════════════════════════════════════════════════════════════ */
  if (!order && orderLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#444651]">جاري التحميل…</p>
      </div>
    </div>
  );
  if (!order) return null;

  const pill        = STATUS_PILL[order.status as OrderStatus] ?? STATUS_PILL.draft;
  const isDraft     = order.status === 'draft';
  const isConfirmed = order.status === 'confirmed';
  const isDelivered = order.status === 'delivered';
  const isBusy      = isActionBusy || exportExcel.isPending || saving;

  const activeProducts: any[] = (order as any).allProducts ?? [];
  const orderItems: any[]     = (order.items as any[]) ?? [];

  const savedQty: Record<number, number> = {};
  for (const item of orderItems) savedQty[item.productId] = item.quantityRequested;

  const hasUnsaved = isDraft && activeProducts.some((p: any) => {
    const current = parseInt(qtyMap[p.id] ?? '0', 10) || 0;
    return current !== (savedQty[p.id] ?? 0);
  });

  /* Over-quantity warnings */
  const overStock: Record<number, boolean> = {};
  for (const p of activeProducts) {
    const qty = parseInt(qtyMap[p.id] ?? '0', 10) || 0;
    if (qty > 0 && qty > Number(p.availableStock ?? 0)) overStock[p.id] = true;
  }
  const hasOverStock = Object.values(overStock).some(Boolean);

  /* Totals */
  const draftTotal = activeProducts.reduce((sum, p) => {
    return sum + (parseInt(qtyMap[p.id] ?? '0', 10) || 0) * (Number(p.faceValue) || 0);
  }, 0);
  const savedTotal = orderItems.reduce((sum, item) => {
    const product = activeProducts.find((p: any) => p.id === item.productId);
    return sum + item.quantityRequested * (Number(product?.faceValue) || 0);
  }, 0);
  const totalCards = Object.values(qtyMap).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);

  const displayProducts = isDraft
    ? activeProducts
    : activeProducts.filter((p: any) => (savedQty[p.id] ?? 0) > 0);

  const currency = activeProducts[0]?.currency || 'LYD';

  return (
    <>
      {sharedDialog}
      <div className="p-6 md:p-8 space-y-6">

        {/* ── Custom header: client name + status pill + back + actions ── */}
        <div className="flex items-start justify-between gap-4 mb-6">

          {/* Left side: back icon + title + status */}
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => { setView('list'); setSelectedOrderId(null); }}
              className="mt-1 p-1.5 rounded-lg text-[#444651] hover:text-[#0b1c30] hover:bg-[#f1f5f9] transition-colors shrink-0"
            >
              <ChevronRight size={20} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight tracking-tight truncate">
                  {(order as any).clientName}
                </h1>
                <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
              </div>
              {((order as any).clientPhone || (order as any).clientNotes) && (
                <p className="mt-1.5 text-sm text-[#444651] leading-relaxed flex flex-wrap gap-x-3">
                  {(order as any).clientPhone && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} /> {(order as any).clientPhone}
                    </span>
                  )}
                  {(order as any).clientNotes && (
                    <span className="flex items-center gap-1">
                      <StickyNote size={11} /> {(order as any).clientNotes}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Right side (RTL: leftmost): action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isDraft && hasUnsaved && (
              <Button
                onClick={handleSaveQuantities}
                disabled={isBusy || hasOverStock}
                className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                حفظ الكميات
              </Button>
            )}
            {isDraft && !hasUnsaved && orderItems.length > 0 && (
              <Button
                onClick={() => setPendingAction({ orderId: selectedOrderId!, action: 'confirm' })}
                disabled={isBusy}
                className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white"
              >
                <CheckCircle2 size={15} /> تأكيد الطلب
              </Button>
            )}
            {isConfirmed && (
              <Button
                onClick={() => setPendingAction({ orderId: selectedOrderId!, action: 'deliver' })}
                disabled={isBusy}
                className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white"
              >
                <Truck size={15} /> تسليم
              </Button>
            )}
            {(isConfirmed || isDelivered) && (
              <Button variant="outline" onClick={handleExport} disabled={isBusy} className="gap-1.5">
                {exportExcel.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={15} />}
                تصدير Excel
              </Button>
            )}
            {isDraft && (
              <Button
                variant="outline"
                className="gap-1.5 text-[#b91c1c] border-[#fca5a5] hover:bg-[#fee2e2]"
                onClick={() => setPendingAction({ orderId: selectedOrderId!, action: 'delete' })}
                disabled={isBusy}
              >
                <Trash2 size={14} /> حذف المسودة
              </Button>
            )}
            {isConfirmed && (
              <Button
                variant="outline"
                className="gap-1.5 text-[#b91c1c] border-[#fca5a5] hover:bg-[#fee2e2]"
                onClick={() => setPendingAction({ orderId: selectedOrderId!, action: 'cancel' })}
                disabled={isBusy}
              >
                <XCircle size={14} /> إلغاء الطلب
              </Button>
            )}
            {order.status === 'cancelled' && (
              <Button variant="outline" onClick={() => setView('create')} className="gap-1.5">
                <Plus size={15} /> طلب جديد
              </Button>
            )}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-center gap-2">
            <AlertCircle size={15} className="text-[#b91c1c] shrink-0" />
            <p className="text-sm font-medium text-[#b91c1c] flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-[#b91c1c] hover:opacity-70 shrink-0">
              <XCircle size={14} />
            </button>
          </div>
        )}

        {/* ── Over-stock warning ── */}
        {isDraft && hasOverStock && (
          <div className="p-4 bg-[#fef3c7] border border-[#fde68a] rounded-lg flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#b45309] shrink-0" />
            <p className="text-sm font-medium text-[#b45309]">
              بعض الكميات المطلوبة تتجاوز المخزون المتاح. يرجى مراجعة الكميات المُحاطة بإطار أحمر.
            </p>
          </div>
        )}

        {/* ── Summary stat cards ── */}
        {(isDraft || isConfirmed || isDelivered) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="إجمالي الكروت"
              value={isDraft ? totalCards : orderItems.reduce((s, i) => s + i.quantityRequested, 0)}
              icon={<CreditCard size={20} />}
              iconVariant="primary"
            />
            <StatCard
              title="القيمة الإجمالية"
              value={(isDraft ? draftTotal : savedTotal).toLocaleString('en-US')}
              unit={currency}
              icon={<DollarSign size={20} />}
              iconVariant="teal"
            />
            <StatCard
              title="المنتجات"
              value={isDraft
                ? activeProducts.filter(p => (parseInt(qtyMap[p.id] ?? '0', 10) || 0) > 0).length
                : orderItems.length}
              icon={<ShoppingCart size={20} />}
              iconVariant="muted"
            />
          </div>
        )}

        {/* ── Products table ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">

          {/* Panel header */}
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0b1c30] flex items-center gap-2">
              <Package size={14} className="text-[#444651]" /> المنتجات
            </h2>
            {isDraft && (
              <span className="text-xs text-[#444651]">أدخل الكمية المطلوبة لكل منتج</span>
            )}
          </div>

          {displayProducts.length === 0 ? (
            <EmptyState
              icon={<Package size={28} />}
              iconVariant="muted"
              title={isDraft ? 'لا توجد منتجات نشطة' : 'لا توجد منتجات في هذا الطلب'}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="text-center">المتاح</TableHead>
                  <TableHead
                    className="text-center"
                    style={{ width: '8rem', minWidth: '8rem', maxWidth: '8rem' }}
                  >
                    {isDraft ? 'الكمية' : 'المطلوب'}
                  </TableHead>
                  {(isConfirmed || isDelivered) && (
                    <TableHead className="text-center">المنجز</TableHead>
                  )}
                  <TableHead className="text-center">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {displayProducts.map((product: any) => {
                  const savedItem = orderItems.find((i: any) => i.productId === product.id);
                  const qty       = isDraft ? (parseInt(qtyMap[product.id] ?? '0', 10) || 0) : (savedItem?.quantityRequested ?? 0);
                  const qtyStr    = qtyMap[product.id] ?? '';
                  const hasQty    = qty > 0;
                  const stock     = Number(product.availableStock ?? 0);
                  const isOver    = isDraft && hasQty && qty > stock;
                  const lineTotal = qty * (Number(product.faceValue) || 0);

                  return (
                    <TableRow
                      key={product.id}
                      className={[
                        isDraft && hasQty && !isOver ? 'bg-[#f0fdf4]' : '',
                        isDraft && isOver            ? 'bg-[#fef2f2]' : '',
                        isDraft && !hasQty           ? 'opacity-50'   : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <TableCell>
                        <p className="font-medium text-[#0b1c30] leading-snug">
                          {product.displayName || product.name}
                        </p>
                        {product.faceValue && (
                          <p className="text-xs text-[#444651] mt-0.5">
                            {fmtCurrency(Number(product.faceValue), product.currency || 'LYD')}
                          </p>
                        )}
                      </TableCell>

                      <TableCell className={`text-center text-xs font-semibold ${
                        isOver ? 'text-[#b91c1c]' : stock === 0 ? 'text-[#444651]' : 'text-[#0f766e]'
                      }`}>
                        {stock}
                      </TableCell>

                      <TableCell className="text-center py-3" style={{ width: '8rem', minWidth: '8rem', maxWidth: '8rem' }}>
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
                          <span className={`font-semibold ${hasQty ? 'text-[#0b1c30]' : 'text-[#444651]'}`}>
                            {savedItem?.quantityRequested ?? '—'}
                          </span>
                        )}
                      </TableCell>

                      {(isConfirmed || isDelivered) && (
                        <TableCell className="text-center font-semibold text-[#0b1c30]">
                          {savedItem?.quantityFulfilled ?? '—'}
                        </TableCell>
                      )}

                      <TableCell className="text-center text-sm text-[#444651]">
                        {lineTotal > 0 ? fmtCurrency(lineTotal, currency) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              {/* Totals footer */}
              {(isDraft ? totalCards > 0 : orderItems.length > 0) && (
                <tfoot>
                  <tr className="border-t border-[#e2e8f0] bg-[#f8fafc] font-semibold text-sm">
                    <td className="px-4 py-3 text-right text-[#0b1c30]">الإجمالي</td>
                    <td />
                    <td className="px-4 py-3 text-center text-[#0b1c30]">
                      {isDraft
                        ? totalCards
                        : orderItems.reduce((s, i) => s + i.quantityRequested, 0)}
                    </td>
                    {(isConfirmed || isDelivered) && (
                      <td className="px-4 py-3 text-center text-[#0b1c30]">
                        {orderItems.reduce((s, i) => s + (i.quantityFulfilled ?? 0), 0)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center text-[#00236f]">
                      {fmtCurrency(isDraft ? draftTotal : savedTotal, currency)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </Table>
          )}
        </div>
      </div>
    </>
  );
};

export default AllocationsPage;
