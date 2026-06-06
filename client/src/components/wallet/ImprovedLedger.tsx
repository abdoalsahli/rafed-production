import React, { useState, useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Filter, X } from 'lucide-react';
import { Calendar } from 'lucide-react';

export type TransactionType = 'topup' | 'purchase' | 'refund';

export interface LedgerEntry {
  id: string;
  date: Date;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description?: string;
}

interface ImprovedLedgerProps {
  entries: LedgerEntry[];
  isLoading?: boolean;
  error?: string;
}

const typeConfig = {
  topup: {
    label: 'شحن',
    icon: ArrowUpRight,
    color: 'text-[#0f766e]',
    bgColor: 'bg-[#ccfbf1]',
    borderColor: 'border-[#5eead4]',
    sign: '+',
  },
  purchase: {
    label: 'شراء',
    icon: ArrowDownLeft,
    color: 'text-[#b91c1c]',
    bgColor: 'bg-[#fee2e2]',
    borderColor: 'border-[#fca5a5]',
    sign: '-',
  },
  refund: {
    label: 'استرداد',
    icon: RotateCcw,
    color: 'text-[#00236f]',
    bgColor: 'bg-[#eff4ff]',
    borderColor: 'border-[#dce1ff]',
    sign: '+',
  },
};

export const ImprovedLedger: React.FC<ImprovedLedgerProps> = ({
  entries,
  isLoading = false,
  error,
}) => {
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedType !== 'all' && entry.type !== selectedType) {
        return false;
      }
      if (dateRange.start && entry.date < dateRange.start) {
        return false;
      }
      if (dateRange.end && entry.date > dateRange.end) {
        return false;
      }
      return true;
    });
  }, [entries, selectedType, dateRange]);

  // Paginate entries
  const paginatedEntries = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredEntries.slice(startIdx, startIdx + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ar-LY-u-nu-latn', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleReset = () => {
    setDateRange({});
    setSelectedType('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedType !== 'all' || dateRange.start || dateRange.end;

  if (error) {
    return (
      <div className="bg-[#fee2e2] border border-[#fca5a5] rounded-lg p-6 text-center">
        <p className="text-[#b91c1c] font-medium">خطأ في تحميل السجل</p>
        <p className="text-[#b91c1c] text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header with Filters */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0b1c30]">سجل المعاملات</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-[#444651] hover:text-[#0b1c30] transition-colors"
          >
            <Filter size={18} />
            الفلاتر
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-1 bg-[#dce1ff] text-[#00236f] rounded-full text-xs font-semibold">
                نشط
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#e2e8f0]">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-[#0b1c30] mb-2">تاريخ البدء</label>
              <div className="relative">
                <Calendar size={16} className="absolute right-3 top-3 text-[#444651]" />
                <input
                  type="date"
                  value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    setDateRange({
                      ...dateRange,
                      start: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                  className="w-full pr-10 pl-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f] num"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0b1c30] mb-2">تاريخ الانتهاء</label>
              <div className="relative">
                <Calendar size={16} className="absolute right-3 top-3 text-[#444651]" />
                <input
                  type="date"
                  value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    setDateRange({
                      ...dateRange,
                      end: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                  className="w-full pr-10 pl-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f] num"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-[#0b1c30] mb-2">النوع</label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as TransactionType | 'all');
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]"
              >
                <option value="all">جميع الأنواع</option>
                <option value="topup">شحن</option>
                <option value="purchase">شراء</option>
                <option value="refund">استرداد</option>
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#444651] hover:text-[#0b1c30] transition-colors"
                >
                  <X size={16} />
                  مسح الفلاتر
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        <div className="mt-4 text-sm text-[#444651]">
          يعرض <span className="font-semibold">{paginatedEntries.length}</span> من{' '}
          <span className="font-semibold">{filteredEntries.length}</span> معاملة
        </div>
      </div>

      {/* Ledger Entries */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#00236f]"></div>
            <p className="mt-4 text-[#444651]">جاري تحميل المعاملات…</p>
          </div>
        ) : paginatedEntries.length === 0 ? (
          <div className="text-center py-12 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
            <p className="text-[#444651] font-medium">لم يتم العثور على معاملات</p>
            <p className="text-[#444651] text-sm mt-1">جرب تعديل الفلاتر</p>
          </div>
        ) : (
          paginatedEntries.map((entry) => {
            const config = typeConfig[entry.type];
            const Icon = config.icon;

            return (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 transition-colors hover:opacity-90 ${config.borderColor} ${config.bgColor}`}
              >
                <div className="flex items-center justify-between">
                  {/* Right: Icon and Details (RTL) */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-full ${config.bgColor}`}>
                      <Icon size={20} className={config.color} />
                    </div>

                    <div className="flex-1">
                      <p className={`font-semibold ${config.color}`}>{config.label}</p>
                      <p className="text-sm text-[#444651] mt-1 num">{formatDate(entry.date)}</p>
                      {entry.description && (
                        <p className="text-sm text-[#444651] mt-1">{entry.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Left: Amount and Balance (RTL) */}
                  <div className="text-left mr-4" dir="ltr">
                    <div className={`text-2xl font-bold num mb-2 ${config.color}`}>
                      {config.sign}
                      {formatCurrency(entry.amount)}
                    </div>
                    <div className="text-sm text-[#444651] num">
                      الرصيد: <span className="font-semibold text-[#0b1c30]">{formatCurrency(entry.balanceAfter)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {paginatedEntries.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#444651]">عرض</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-[#e2e8f0] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f] num"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-[#444651]">في الصفحة</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={!hasPreviousPage}
              className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm font-medium text-[#444651] hover:bg-[#e2e8f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              السابق
            </button>

            <span className="text-sm text-[#444651] num">
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={!hasNextPage}
              className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm font-medium text-[#444651] hover:bg-[#e2e8f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
