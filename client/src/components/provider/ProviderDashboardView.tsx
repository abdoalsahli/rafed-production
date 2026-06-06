import * as React from 'react';
import { useState } from 'react';
import { formatAmount, formatCount } from '@/lib/numberUtils';
import { useLocation } from 'wouter';
import {
  TrendingUp,
  CreditCard,
  Users,
  AlertTriangle,
  ChevronLeft,
  Plus,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { cn } from '@/lib/utils';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(date: Date | string): string {
  const d   = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60)  return 'الآن';
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    return `منذ ${m} ${m === 1 ? 'دقيقة' : m <= 10 ? 'دقائق' : 'دقيقة'}`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return `منذ ${h} ${h === 1 ? 'ساعة' : h <= 10 ? 'ساعات' : 'ساعة'}`;
  }
  return d.toLocaleDateString('ar-LY-u-nu-latn', { day: 'numeric', month: 'short' });
}

function getInitial(name: string): string {
  return (name?.trim() || '؟').charAt(0).toUpperCase();
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'ناجحة',
  failed:    'فشلت',
  pending:   'قيد المعالجة',
  refunded:  'مُستردة',
};
const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[#ccfbf1] text-[#0f766e]',
  failed:    'bg-[#fee2e2] text-[#b91c1c]',
  pending:   'bg-[#fef3c7] text-[#b45309]',
  refunded:  'bg-[#dbeafe] text-[#1d4ed8]',
};
const AVATAR_COLORS = [
  'bg-[#dce1ff] text-[#00236f]',
  'bg-[#ccfbf1] text-[#0f766e]',
  'bg-[#fef3c7] text-[#b45309]',
  'bg-[#ffe4e6] text-[#be123c]',
  'bg-[#f3e8ff] text-[#7c3aed]',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── interfaces ─────────────────────────────────────────────────────────── */
interface DashboardMetrics  { totalRevenue?: number; todayRevenue?: number; commissionPaid?: number; activeDistributors?: number; pendingRequests?: number; todayCardsSold?: number; [k: string]: any; }
interface InventoryAlert    { productId: number; productName: string; currentStock?: number; availableCards?: number; threshold?: number; [k: string]: any; }
interface PendingRequest    { id?: number; requestId?: number; distributorId: number; distributorName: string; requestType?: string; status: string; createdAt: Date; [k: string]: any; }

export interface ProviderDashboardViewProps {
  metrics:         DashboardMetrics;
  inventoryAlerts: InventoryAlert[];
  pendingRequests: PendingRequest[];
  providerCode:    string;
  isLoading:       boolean;
}

const PAGE_SIZE = 6;

/* ════════════════════════════════════════════════════════════════════════════
   ProviderDashboardView
   ════════════════════════════════════════════════════════════════════════════ */
export function ProviderDashboardView({
  metrics,
  inventoryAlerts,
  pendingRequests,
  isLoading,
}: ProviderDashboardViewProps) {
  const [, navigate]   = useLocation();
  const [txPage, setTxPage] = useState(1);

  /* ── Recent transactions ─────────────────────────────────────────────── */
  const { data: txData, isLoading: isLoadingTx } = trpc.providerTransactions.list.useQuery({
    page: txPage, limit: PAGE_SIZE,
  });
  const transactions  = txData?.data       || [];
  const txPagination  = txData?.pagination;

  /* ── Loading skeleton ───────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-52 bg-[#e5eeff] animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight">نظرة عامة على الأداء</h1>
          <p className="text-sm text-[#444651] mt-1">
            متابعة فورية للمبيعات والمخزون ونشاط الموزعين خلال آخر 24 ساعة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[#444651] border-[#e2e8f0]"
          >
            اليوم
            <ChevronLeft size={14} />
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-[#00236f] hover:bg-[#00164e] text-white"
            onClick={() => navigate('/provider/products')}
          >
            <Plus size={15} />
            إضافة منتج جديد
          </Button>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الإيرادات"
          value={formatAmount(metrics.totalRevenue ?? 0)}
          unit="د.ل"
          icon={<CreditCard size={20} />}
          iconVariant="teal"
        />
        <StatCard
          title="البطاقات المباعة (اليوم)"
          value={formatCount(metrics.todayCardsSold ?? 0)}
          unit="بطاقة"
          icon={<TrendingUp size={20} />}
          iconVariant="primary"
        />
        <StatCard
          title="الموزعون النشطون"
          value={metrics.activeDistributors ?? 0}
          unit="منشأة"
          icon={<Users size={20} />}
          iconVariant="primary"
        />
        <StatCard
          title="منتجات بمخزون منخفض"
          value={inventoryAlerts?.length ?? 0}
          unit="منتج"
          icon={<AlertTriangle size={20} />}
          iconVariant="amber"
        />
      </div>

      {/* ── Two-column body ───────────────────────────────────────────── */}
      {/*
        RTL flex: first DOM → rightmost = transactions table (primary).
                  second DOM → leftmost = sidebar (supplementary).
      */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── RIGHT (DOM first): recent transactions ─────────────────── */}
        <div className="flex-1 bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden min-w-0">

          {/* Table header */}
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0b1c30]">آخر العمليات</h2>
              {txPagination && (
                <p className="text-xs text-[#444651] mt-0.5">
                  تحديث مباشر · آخر{' '}
                  <span className="num font-semibold">{transactions.length}</span>{' '}
                  عمليات
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/provider/transactions')}
              className="flex items-center gap-1 text-xs font-semibold text-[#00236f] hover:text-[#00164e] transition-colors"
            >
              عرض الكل
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* Table */}
          {isLoadingTx ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[#444651]">لا توجد عمليات بعد</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] bg-[#f8f9ff]">
                      <th className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">المعرّف</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">الموزع</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">المنتج</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">المبلغ</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">الحالة</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {transactions.map((txn: any) => (
                      <tr key={txn.id} className="hover:bg-[#fafbff] transition-colors">
                        <td className="px-5 py-3">
                          <span className="num text-xs font-semibold text-[#00236f]">
                            RF-#{String(txn.id).padStart(4, '0')}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm font-semibold text-[#0b1c30]">
                            {txn.distributorName || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-[#444651] whitespace-nowrap">
                          {txn.productName || '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1">
                            <span className="num font-semibold text-[#0b1c30]">
                              {formatAmount(txn.amount)}
                            </span>
                            <span className="text-xs text-[#444651]">د.ل</span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                            STATUS_COLORS[txn.status] || 'bg-[#f1f5f9] text-[#64748b]',
                          )}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                            {STATUS_LABELS[txn.status] || txn.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#64748b] whitespace-nowrap">
                          {timeAgo(txn.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {txPagination && (
                <TablePaginationFooter
                  page={txPage}
                  totalPages={txPagination.totalPages}
                  pageSize={PAGE_SIZE}
                  totalRows={txPagination.total}
                  onPrev={() => setTxPage((p) => Math.max(1, p - 1))}
                  onNext={() => setTxPage((p) => Math.min(txPagination.totalPages, p + 1))}
                />
              )}
            </>
          )}
        </div>

        {/* ── LEFT (DOM second): sidebar cards ───────────────────────── */}
        <div className="w-full lg:w-[300px] shrink-0 space-y-4">

          {/* ── Pending requests ─────────────────────────────────────── */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0b1c30] flex-1">طلبات ربط جديدة</h3>
              {pendingRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#b91c1c] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={24} className="text-[#0f766e] mx-auto mb-2" />
                <p className="text-xs text-[#444651]">لا توجد طلبات معلقة</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-[#f8f9ff]">
                  {pendingRequests.slice(0, 4).map((req, i) => (
                    <li
                      key={`req-${req.id ?? req.requestId ?? i}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-[#fafbff] transition-colors"
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        avatarColor(req.distributorName),
                      )}>
                        {getInitial(req.distributorName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0b1c30] truncate leading-tight">
                          {req.distributorName}
                        </p>
                        <p className="text-xs text-[#64748b] leading-snug mt-0.5">
                          {timeAgo(req.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/provider/requests')}
                        className="w-6 h-6 rounded-full border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:bg-[#eff4ff] hover:text-[#00236f] hover:border-[#00236f]/30 transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-5 py-3 border-t border-[#f8f9ff]">
                  <button
                    onClick={() => navigate('/provider/requests')}
                    className="text-xs font-semibold text-[#00236f] hover:text-[#00164e] transition-colors"
                  >
                    إدارة جميع الطلبات
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Low inventory ────────────────────────────────────────── */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0b1c30] flex-1">تنبيهات المخزون</h3>
              {inventoryAlerts.length > 0 && (
                <span className="text-xs font-semibold bg-[#fef3c7] text-[#b45309] rounded-full px-2 py-0.5">
                  {inventoryAlerts.length} منتج
                </span>
              )}
            </div>

            {inventoryAlerts.length === 0 ? (
              /* All-clear */
              <div className="py-8 text-center">
                <CheckCircle2 size={24} className="text-[#0f766e] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#0f766e]">المخزون في مستوى جيد</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">لا توجد منتجات بمخزون منخفض</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-[#f8f9ff]">
                  {inventoryAlerts.slice(0, 4).map((alert, i) => {
                    const remaining = alert.availableCards ?? alert.currentStock ?? 0;
                    return (
                      <li key={`alert-${alert.productId}-${i}`}
                          className="px-5 py-3 flex items-center gap-3 hover:bg-[#fafbff] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center shrink-0">
                          <Package size={13} className="text-[#b45309]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#0b1c30] truncate leading-tight">
                            {alert.productName}
                          </p>
                          <p className="text-xs text-[#b45309] mt-0.5">
                            تبقى <span className="num font-bold">{remaining}</span> بطاقة
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-5 py-3 border-t border-[#f8f9ff]">
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-[#b45309] hover:bg-[#92400e] text-white text-xs"
                    onClick={() => navigate('/provider/upload')}
                  >
                    <Plus size={13} />
                    إضافة مخزون
                  </Button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
