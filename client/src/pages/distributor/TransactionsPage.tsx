import React, { useState, useMemo, useEffect } from 'react';
import { formatAmount } from '@/lib/numberUtils';
import { formatDateTimeShort } from '@/lib/dateUtils';
import { Search, TrendingUp, AlertCircle, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { TransactionFilters as TFilters } from '@/components/TransactionFilters';
import { toast } from 'sonner';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { DollarSign, Receipt } from 'lucide-react';

interface LedgerEntry {
  id: string;
  providerId: number;
  providerName: string;
  type: 'DEBIT' | 'CREDIT';
  referenceType: string;
  amount: number;
  balanceAfterTransaction: number;
  usedCreditAfterTransaction: number;
  referenceId: string;
  metadata: any;
  createdAt: string;
}

const PAGE_SIZE = 10;

export const TransactionsPage: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(0);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [filters,     setFilters]     = useState<TFilters>({ status: 'all', searchTerm: '' });

  /* ── export ─────────────────────────────────────────────────────────── */
  const exportMutation = trpc.export.ledgerHistoryCSV.useMutation();

  /* ── queries ─────────────────────────────────────────────────────────── */
  const { data: ledgerData, isLoading: isLoadingLedger, error: ledgerError } =
    trpc.financial.ledgerHistory.useQuery(
      { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE, providerId: filters.providerId },
      { enabled: isAuthenticated && !authLoading },
    );

  /* Aggregate totals across ALL pages (not just current page) */
  const { data: ledgerSummary } =
    trpc.financial.ledgerSummary.useQuery(
      { providerId: filters.providerId },
      { enabled: isAuthenticated && !authLoading },
    );

  const { data: accountBalanceData } =
    trpc.financial.accountBalance.useQuery(undefined, {
      enabled: isAuthenticated && !authLoading,
    });

  const isLoading = authLoading || isLoadingLedger;
  const error     = ledgerError?.message || null;

  const providers = useMemo(() => {
    if (!accountBalanceData?.accounts) return [];
    return accountBalanceData.accounts.map((acc: any) => ({
      id:   acc.providerId,
      name: acc.providerName,
    }));
  }, [accountBalanceData]);

  /* ── filtering ───────────────────────────────────────────────────────── */
  const filteredTransactions = useMemo(() => {
    if (!ledgerData?.entries) return [];
    return ledgerData.entries.filter((entry: LedgerEntry) => {
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        if (
          !entry.providerName.toLowerCase().includes(term) &&
          !entry.referenceId.toLowerCase().includes(term) &&
          !entry.referenceType.toLowerCase().includes(term)
        ) return false;
      }
      if (filters.providerId && entry.providerId !== filters.providerId) return false;
      if (filters.amountMin && entry.amount < filters.amountMin) return false;
      if (filters.amountMax && entry.amount > filters.amountMax) return false;
      if (filters.dateFrom) {
        if (new Date(entry.createdAt) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(entry.createdAt) > to) return false;
      }
      return true;
    });
  }, [ledgerData, filters]);

  /* ── summary stats (whole dataset, not just current page) ───────────── */
  const totalTransactions = ledgerData?.total ?? 0;
  const totalAmount       = ledgerSummary?.totalAmount     ?? 0;
  const totalCommission   = ledgerSummary?.totalCommission ?? 0;

  /* ── reset to page 0 when filters change ─────────────────────────────── */
  useEffect(() => { setCurrentPage(0); }, [filters]);

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = async () => {
    try {
      const result = await exportMutation.mutateAsync({
        providerId:  filters.providerId,
        dateFrom:    filters.dateFrom,
        dateTo:      filters.dateTo,
        amountMin:   filters.amountMin,
        amountMax:   filters.amountMax,
        searchTerm:  filters.searchTerm,
      });
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${result.recordCount} سجل`);
    } catch {
      toast.error('فشل التصدير');
    }
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="سجل العمليات"
        subtitle="استعرض وتحليل جميع عملياتك المالية"
        actions={
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={exportMutation.isPending || isLoading}
            className="gap-1.5"
          >
            <Download size={15} />
            {exportMutation.isPending ? 'جاري التصدير…' : 'تصدير CSV'}
          </Button>
        }
      />

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            خطأ في تحميل العمليات: {error}
          </p>
        </div>
      )}

      {/* ── Summary KPIs ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="إجمالي العمليات"
            value={totalTransactions}
            icon={<Receipt size={20} />}
            iconVariant="primary"
          />
          <StatCard
            title="إجمالي المبلغ"
            value={formatAmount(totalAmount)}
            unit="د.ل"
            icon={<DollarSign size={20} />}
            iconVariant="teal"
          />
          <StatCard
            title="إجمالي العمولة"
            value={formatAmount(totalCommission)}
            unit="د.ل"
            icon={<TrendingUp size={20} />}
            iconVariant="amber"
          />
        </div>
      )}

      {/* ── Filters bar ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="flex-1 relative min-w-[200px]">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444651]" />
            <input
              type="text"
              placeholder="بحث برقم المرجع، المزود، أو النوع…"
              value={filters.searchTerm || ''}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              disabled={isLoading}
              className="w-full pr-9 pl-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-sm text-[#0b1c30] focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
            />
          </div>

          {/* Provider filter */}
          {providers.length > 0 && (
            <select
              value={filters.providerId || ''}
              onChange={(e) => setFilters({
                ...filters,
                providerId: e.target.value ? parseInt(e.target.value) : undefined,
              })}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-sm text-[#0b1c30] focus:outline-none focus:border-[#00236f] transition-colors disabled:opacity-50"
            >
              <option value="">كل المزودين</option>
              {providers.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Transactions table ───────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#444651]">جاري التحميل…</p>
            </div>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9ff]">
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">النوع</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">رقم المرجع</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">المزود</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">نوع المرجع</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">المبلغ</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">الرصيد بعد</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]/60">
                  {filteredTransactions.map((entry: LedgerEntry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-[#eff4ff] transition-colors duration-100"
                    >
                      <td className="px-6 py-3">
                        <span
                          className={[
                            'inline-block px-2.5 py-1 rounded-full text-xs font-semibold',
                            entry.type === 'CREDIT'
                              ? 'bg-[#ccfbf1] text-[#0f766e]'
                              : 'bg-[#fef3c7] text-[#b45309]',
                          ].join(' ')}
                        >
                          {entry.type === 'CREDIT' ? 'دائن' : 'مدين'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-[#444651] bg-[#f8f9ff] px-2 py-1 rounded border border-[#e2e8f0]">
                            {entry.referenceId.substring(0, 12)}…
                          </code>
                          <button
                            onClick={() => handleCopyId(entry.referenceId)}
                            className="p-1 hover:bg-[#e5eeff] rounded transition-colors"
                            title="نسخ"
                          >
                            {copiedId === entry.referenceId
                              ? <Check size={13} className="text-[#0f766e]" />
                              : <Copy size={13} className="text-[#444651]" />
                            }
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-[#dce1ff] flex items-center justify-center text-[10px] font-bold text-[#00236f] shrink-0">
                            {entry.providerName.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-[#0b1c30]">{entry.providerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-[#444651]">{entry.referenceType}</td>
                      <td className="px-6 py-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <span className="num font-semibold text-[#0b1c30]">
                            {formatAmount(entry.amount)}{entry.type === 'CREDIT' ? '+' : '-'}
                          </span>
                          <span className="text-xs text-[#444651]">د.ل</span>
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <span className="num font-semibold text-[#0b1c30]">
                            {formatAmount(entry.balanceAfterTransaction)}
                          </span>
                          <span className="text-xs text-[#444651]">د.ل</span>
                        </span>
                      </td>
                      <td className="px-6 py-3 text-[#444651] text-xs">
                        {formatDateTimeShort(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <TablePaginationFooter
              page={currentPage + 1}
              totalPages={Math.max(1, Math.ceil(totalTransactions / PAGE_SIZE))}
              pageSize={PAGE_SIZE}
              totalRows={totalTransactions}
              onPrev={() => setCurrentPage((p) => Math.max(0, p - 1))}
              onNext={() => setCurrentPage((p) => p + 1)}
            />
          </>
        ) : (
          <EmptyState
            icon={<Receipt size={28} />}
            iconVariant="muted"
            title="لا توجد عمليات"
            description="لم يتم تسجيل أي عمليات تطابق الفلاتر المحددة."
          />
        )}
      </div>
    </div>
  );
};
