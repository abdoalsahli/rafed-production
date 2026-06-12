import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { formatDateTime, formatDateTimeForExport } from '@/lib/dateUtils';
import { DollarSign, TrendingUp, CheckCircle, AlertCircle, Download, RotateCcw } from 'lucide-react';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProviderTransactionsPage() {
  const { user }         = useAuth();
  const [, setLocation]  = useLocation();

  const [page,                setPage]                = useState(1);
  const [limit]                                       = useState(10);
  const [startDate,           setStartDate]           = useState<Date | undefined>();
  const [endDate,             setEndDate]             = useState<Date | undefined>();
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all');
  const [selectedProduct,     setSelectedProduct]     = useState<string>('all');
  const [selectedStatus,      setSelectedStatus]      = useState<string>('all');
  const [searchQuery,         setSearchQuery]         = useState('');
  const [minAmount,           setMinAmount]           = useState<number | undefined>();
  const [maxAmount,           setMaxAmount]           = useState<number | undefined>();

  /* ── tRPC queries ─────────────────────────────────────────────────────── */
  const { data: transactionsData, isLoading } = trpc.providerTransactions.list.useQuery({
    page,
    limit,
    startDate,
    endDate,
    distributorId: selectedDistributor !== 'all' ? parseInt(selectedDistributor) : undefined,
    productId:     selectedProduct     !== 'all' ? parseInt(selectedProduct)     : undefined,
    status:        selectedStatus      !== 'all' ? (selectedStatus as any)       : undefined,
    minAmount,
    maxAmount,
    searchQuery:   searchQuery || undefined,
  });

  const { data: summaryData } = trpc.providerTransactions.summary.useQuery({
    startDate,
    endDate,
    distributorId: selectedDistributor !== 'all' ? parseInt(selectedDistributor) : undefined,
    productId:     selectedProduct     !== 'all' ? parseInt(selectedProduct)     : undefined,
    status:        selectedStatus      !== 'all' ? (selectedStatus as any)       : undefined,
    minAmount,
    maxAmount,
    searchQuery:   searchQuery || undefined,
  });

  const { data: distributors } = trpc.providerTransactions.getDistributors.useQuery();
  const { data: products }     = trpc.providerTransactions.getProducts.useQuery();

  const transactions = transactionsData?.data       || [];
  const pagination   = transactionsData?.pagination;

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const formatCurrency = (value: any) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const handleExportCSV = () => {
    if (!transactions.length) return;
    const headers = ['Date', 'Transaction ID', 'Distributor', 'Product', 'Amount', 'Commission', 'Status'];
    const rows    = transactions.map((txn: any) => [
      formatDateTimeForExport(txn.createdAt),
      txn.idempotencyKey,
      txn.distributorName || '-',
      txn.productName     || '-',
      txn.amount,
      txn.commissionAmount,
      txn.status,
    ]);
    const csv  = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setPage(1);
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedDistributor('all');
    setSelectedProduct('all');
    setSelectedStatus('all');
    setSearchQuery('');
    setMinAmount(undefined);
    setMaxAmount(undefined);
  };

  /* ── auth guard ───────────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-[#444651]">يرجى تسجيل الدخول لعرض العمليات</p>
          <Button
            onClick={() => setLocation('/login')}
            className="bg-[#00236f] hover:bg-[#1e3a8a]"
          >
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="العمليات"
        subtitle="متابعة جميع عمليات البيع والعمولات"
        actions={
          <Button
            onClick={handleExportCSV}
            disabled={!transactions.length}
            variant="outline"
            className="gap-1.5"
          >
            <Download size={15} />
            تصدير CSV
          </Button>
        }
      />

      {/* ── Summary KPIs ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي المبيعات"
            value={formatCurrency(summaryData?.totalSales || 0)}
            unit="د.ل"
            icon={<DollarSign size={20} />}
            iconVariant="primary"
          />
          <StatCard
            title="إجمالي العمولة"
            value={formatCurrency(summaryData?.totalCommission || 0)}
            unit="د.ل"
            icon={<TrendingUp size={20} />}
            iconVariant="teal"
          />
          <StatCard
            title="العمليات الناجحة"
            value={summaryData?.successfulTransactions || 0}
            icon={<CheckCircle size={20} />}
            iconVariant="teal"
          />
          <StatCard
            title="العمليات الفاشلة"
            value={summaryData?.failedTransactions || 0}
            icon={<AlertCircle size={20} />}
            iconVariant="red"
          />
        </div>
      )}

      {/* ── Filters panel ───────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0b1c30]">تصفية النتائج</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">
              بحث برقم العملية
            </label>
            <Input
              placeholder="أدخل رقم العملية…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            />
          </div>
          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">
              تاريخ البداية
            </label>
            <Input
              type="date"
              value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => { setStartDate(e.target.value ? new Date(e.target.value) : undefined); setPage(1); }}
            />
          </div>
          {/* End date */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">
              تاريخ النهاية
            </label>
            <Input
              type="date"
              value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => { setEndDate(e.target.value ? new Date(e.target.value) : undefined); setPage(1); }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Distributor */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">الموزع</label>
            <Select value={selectedDistributor} onValueChange={(v) => { setSelectedDistributor(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="كل الموزعين" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموزعين</SelectItem>
                {distributors?.map((d: any) => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Product */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">المنتج</label>
            <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="كل المنتجات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنتجات</SelectItem>
                {products?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">الحالة</label>
            <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="كل الحالات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
                <SelectItem value="failed">فشلت</SelectItem>
                <SelectItem value="refunded">مُستردة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Amount range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#444651] mb-1.5">أدنى مبلغ</label>
              <Input
                type="number"
                placeholder="0"
                value={minAmount ?? ''}
                onChange={(e) => { setMinAmount(e.target.value ? parseFloat(e.target.value) : undefined); setPage(1); }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#444651] mb-1.5">أعلى مبلغ</label>
              <Input
                type="number"
                placeholder="∞"
                value={maxAmount ?? ''}
                onChange={(e) => { setMaxAmount(e.target.value ? parseFloat(e.target.value) : undefined); setPage(1); }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleResetFilters} className="gap-1.5">
            <RotateCcw size={14} /> إعادة تعيين
          </Button>
        </div>
      </div>

      {/* ── Transactions table ───────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        {/* table header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <h2 className="text-sm font-semibold text-[#0b1c30]">
            العمليات
            {pagination && (
              <span className="text-[#444651] font-normal ms-2">
                ({pagination.total.toLocaleString('en-US')} إجمالي)
              </span>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#444651]">جاري التحميل…</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={28} />}
            iconVariant="muted"
            title="لا توجد عمليات"
            description="لم يتم تسجيل أي عمليات مطابقة للفلاتر المحددة."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>رقم العملية</TableHead>
                  <TableHead>الموزع</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>العمولة</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn: any) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-[#444651]">
                      {formatDateTime(txn.createdAt)}
                    </TableCell>
                    <TableCell className="num text-xs text-[#444651]">
                      {txn.idempotencyKey.substring(0, 12)}…
                    </TableCell>
                    <TableCell>{txn.distributorName || '—'}</TableCell>
                    <TableCell>{txn.productName     || '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span className="num font-semibold text-[#0b1c30]">{formatCurrency(txn.amount)}</span>
                        <span className="text-xs text-[#444651]">د.ل</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span className="num font-semibold text-[#0f766e]">{formatCurrency(txn.commissionAmount)}</span>
                        <span className="text-xs text-[#444651]">د.ل</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={txn.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && (
              <TablePaginationFooter
                page={pagination.page}
                totalPages={pagination.totalPages}
                pageSize={limit}
                totalRows={pagination.total}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
