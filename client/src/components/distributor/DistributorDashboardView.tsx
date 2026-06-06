import * as React from 'react';
import { useState } from 'react';
import { formatAmount, formatCount } from '@/lib/numberUtils';
import { useLocation } from 'wouter';
import {
  TrendingUp,
  BadgePercent,
  Store,
  ChevronLeft,
  Plus,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { cn } from '@/lib/utils';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(date: Date | string): string {
  const d   = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60)   return 'الآن';
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    return `منذ ${m} ${m <= 10 ? 'دقائق' : 'دقيقة'}`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return `منذ ${h} ${h <= 10 ? 'ساعات' : 'ساعة'}`;
  }
  return d.toLocaleDateString('ar-LY-u-nu-latn', { day: 'numeric', month: 'short' });
}

const AVATAR_COLORS = [
  'bg-[#dce1ff] text-[#00236f]',
  'bg-[#ccfbf1] text-[#0f766e]',
  'bg-[#fef3c7] text-[#b45309]',
  'bg-[#ffe4e6] text-[#be123c]',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── props ───────────────────────────────────────────────────────────────── */
export interface DashboardViewProps {
  activeProviders?:   number;
  pendingRequests?:   number;
  isLoading?:         boolean;
  /* legacy — kept for compat but not used in new layout */
  recentTransactions?: any[];
  onConnectProvider?:  () => void;
}

const PAGE_SIZE = 6;

/* ════════════════════════════════════════════════════════════════════════════
   DistributorDashboardView
   ════════════════════════════════════════════════════════════════════════════ */
export const DistributorDashboardView: React.FC<DashboardViewProps> = ({
  activeProviders = 0,
  isLoading = false,
}) => {
  const [, navigate] = useLocation();
  const [txPage, setTxPage] = useState(1);

  /* ── Data queries ────────────────────────────────────────────────────── */
  const { data: accountsData, isLoading: accountsLoading } =
    trpc.financial.accountBalance.useQuery(undefined, { staleTime: 30_000 });

  const { data: summaryData } =
    trpc.financial.ledgerSummary.useQuery({});

  const { data: ledgerData, isLoading: ledgerLoading } =
    trpc.financial.ledgerHistory.useQuery(
      { limit: PAGE_SIZE, offset: (txPage - 1) * PAGE_SIZE },
    );

  const accounts   = accountsData?.accounts || [];
  const entries    = ledgerData?.entries    || [];
  const total      = ledgerData?.total      || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ── Skeleton ────────────────────────────────────────────────────────── */
  if (isLoading || accountsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight">نظرة عامة على أدائك</h1>
          <p className="text-sm text-[#444651] mt-1">
            متابعة فورية لرصيدك وعملياتك ونشاط مزوديك خلال آخر 24 ساعة.
          </p>
        </div>
        <Button navigate={navigate} />
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الإيرادات"
          value={formatAmount(summaryData?.totalAmount ?? 0)}
          unit="د.ل"
          icon={<TrendingUp size={20} />}
          iconVariant="teal"
        />
        <StatCard
          title="إجمالي العمولات"
          value={formatAmount(summaryData?.totalCommission ?? 0)}
          unit="د.ل"
          icon={<BadgePercent size={20} />}
          iconVariant="amber"
        />
        <StatCard
          title="المزودون النشطون"
          value={activeProviders}
          unit="مزود"
          icon={<Store size={20} />}
          iconVariant="primary"
        />
        <StatCard
          title="إجمالي العمليات"
          value={formatCount(total)}
          unit="عملية"
          icon={<Receipt size={20} />}
          iconVariant="primary"
        />
      </div>

      {/* ── Two-column body ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── RIGHT (DOM first): ledger transactions ─────────────────── */}
        <div className="flex-1 bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden min-w-0">

          {/* Header */}
          <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0b1c30]">آخر العمليات</h2>
              {total > 0 && (
                <p className="text-xs text-[#444651] mt-0.5">
                  إجمالي{' '}
                  <span className="num font-semibold">{formatCount(total)}</span>{' '}
                  عملية
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/distributor/transactions')}
              className="flex items-center gap-1 text-xs font-semibold text-[#00236f] hover:text-[#00164e] transition-colors"
            >
              عرض الكل
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* Table */}
          {ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart size={28} className="text-[#cbd5e1] mx-auto mb-2" />
              <p className="text-sm text-[#444651]">لا توجد عمليات بعد</p>
              <p className="text-xs text-[#94a3b8] mt-1">
                ابدأ بشراء البطاقات من مزوديك
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] bg-[#f8f9ff]">
                      {['المعرّف', 'المزود', 'نوع المرجع', 'المبلغ', 'النوع', 'الوقت'].map((h) => (
                        <th key={h} className="text-right px-5 py-3 text-xs font-semibold text-[#444651] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-[#fafbff] transition-colors">
                        <td className="px-5 py-3">
                          <span className="num text-xs font-semibold text-[#00236f]">
                            #{String(entry.id).substring(0, 8)}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-[#0b1c30] whitespace-nowrap">
                          {entry.providerName || '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#444651] whitespace-nowrap">
                          {entry.referenceType || '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1">
                            <span className={cn(
                              'num font-semibold',
                              entry.type === 'CREDIT' ? 'text-[#0f766e]' : 'text-[#0b1c30]',
                            )}>
                              {formatAmount(entry.amount)}
                            </span>
                            <span className="text-xs text-[#444651]">د.ل</span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                            entry.type === 'CREDIT'
                              ? 'bg-[#ccfbf1] text-[#0f766e]'
                              : 'bg-[#fef3c7] text-[#b45309]',
                          )}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                            {entry.type === 'CREDIT' ? 'دائن' : 'مدين'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#64748b] whitespace-nowrap">
                          {timeAgo(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePaginationFooter
                page={txPage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalRows={total}
                onPrev={() => setTxPage((p) => Math.max(1, p - 1))}
                onNext={() => setTxPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          )}
        </div>

        {/* ── LEFT sidebar ─────────────────────────────────────────────── */}
        <div className="w-full lg:w-[300px] shrink-0 space-y-4">

          {/* ── Provider accounts ──────────────────────────────────────── */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0b1c30]">حسابات المزودين</h3>
              <button
                onClick={() => navigate('/distributor/provider-accounts')}
                className="text-xs font-semibold text-[#00236f] hover:text-[#00164e] transition-colors"
              >
                عرض الكل
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="py-8 text-center">
                <Store size={24} className="text-[#cbd5e1] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#444651]">لا توجد حسابات</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">ارتبط بمزود للبدء</p>
                <button
                  onClick={() => navigate('/distributor/connect-provider')}
                  className="mt-3 text-xs font-semibold text-[#00236f] hover:underline"
                >
                  + ربط مزود
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-[#f8f9ff]">
                {accounts.slice(0, 5).map((acc) => (
                  <li key={acc.providerId}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-[#fafbff] transition-colors">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      avatarColor(acc.providerName),
                    )}>
                      {acc.providerName.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0b1c30] truncate leading-tight">
                        {acc.providerName}
                      </p>
                      <span className="inline-flex items-center gap-0.5 mt-0.5">
                        <span className={cn(
                          'num text-xs font-bold',
                          acc.availableToSpend < 1000 ? 'text-[#b91c1c]' : 'text-[#0f766e]',
                        )}>
                          {formatAmount(acc.availableToSpend)}
                        </span>
                        <span className="text-[10px] text-[#94a3b8]">د.ل متاح</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Quick purchase ──────────────────────────────────────────── */}
          <div className="bg-[#eff4ff] border border-[#dce1ff] rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#dce1ff] flex items-center justify-center shrink-0">
                <ShoppingCart size={14} className="text-[#00236f]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#00236f]">شراء بطاقات</p>
                <p className="text-xs text-[#444651] mt-0.5 leading-relaxed">
                  تصفح الكتالوج واشترِ البطاقات من مزوديك مباشرةً.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/distributor/purchase')}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-[#00236f] hover:bg-[#00164e] text-white text-xs font-semibold transition-colors"
            >
              <Plus size={13} />
              شراء الآن
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

/* small inline button component to avoid hook-in-condition issues */
function Button({ navigate }: { navigate: (p: string) => void }) {
  return (
    <button
      onClick={() => navigate('/distributor/purchase')}
      className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#00236f] hover:bg-[#00164e] text-white text-sm font-semibold transition-colors shrink-0"
    >
      <Plus size={15} />
      شراء بطاقات
    </button>
  );
}

export default DistributorDashboardView;
