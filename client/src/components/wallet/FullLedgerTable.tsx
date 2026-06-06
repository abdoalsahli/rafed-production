import React from 'react';
import { formatAmount } from '@/lib/numberUtils';
import { ArrowUpRight, ArrowDownLeft, Gift, RefreshCw } from 'lucide-react';

export type TransactionType = 'credit' | 'debit' | 'commission' | 'refund';

interface LedgerEntry {
  id: string;
  date: Date;
  type: TransactionType;
  description: string;
  amount: number;
  balanceAfter: number;
  referenceId: string;
}

interface FullLedgerTableProps {
  entries?: LedgerEntry[];
  isLoading?: boolean;
  onLoadMore?: () => void;
}

export function FullLedgerTable({ entries, isLoading = false, onLoadMore }: FullLedgerTableProps) {
  // Mock data if none provided
  const defaultEntries: LedgerEntry[] = [
    {
      id: '1',
      date: new Date('2026-04-13T10:30:00'),
      type: 'credit',
      description: 'شحن المحفظة',
      amount: 5000,
      balanceAfter: 5000,
      referenceId: 'TOP-UP-001',
    },
    {
      id: '2',
      date: new Date('2026-04-13T09:15:00'),
      type: 'debit',
      description: 'شراء - شركة اتصالات أ',
      amount: -1500,
      balanceAfter: 3500,
      referenceId: 'TXN-001',
    },
    {
      id: '3',
      date: new Date('2026-04-12T16:45:00'),
      type: 'commission',
      description: 'عمولة محققة',
      amount: 250,
      balanceAfter: 5000,
      referenceId: 'COM-001',
    },
    {
      id: '4',
      date: new Date('2026-04-12T14:20:00'),
      type: 'refund',
      description: 'استرداد - معاملة ملغاة',
      amount: 500,
      balanceAfter: 4750,
      referenceId: 'REF-001',
    },
    {
      id: '5',
      date: new Date('2026-04-11T11:00:00'),
      type: 'debit',
      description: 'شراء - شركة كهرباء',
      amount: -2000,
      balanceAfter: 4250,
      referenceId: 'TXN-002',
    },
  ];

  const displayEntries = entries || defaultEntries;

  if (displayEntries.length === 0) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-12 text-center shadow-sm">
        <p className="text-[#444651] text-sm font-medium">لم يتم العثور على معاملات</p>
        <p className="text-[#444651] text-xs mt-2">سيظهر سجل معاملاتك هنا</p>
      </div>
    );
  }

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'credit':
        return <ArrowDownLeft className="w-5 h-5 text-[#0f766e]" />;
      case 'debit':
        return <ArrowUpRight className="w-5 h-5 text-[#b91c1c]" />;
      case 'commission':
        return <Gift className="w-5 h-5 text-[#00236f]" />;
      case 'refund':
        return <RefreshCw className="w-5 h-5 text-[#b45309]" />;
    }
  };

  const getTypeLabel = (type: TransactionType) => {
    switch (type) {
      case 'credit':    return 'إيداع';
      case 'debit':     return 'خصم';
      case 'commission': return 'عمولة';
      case 'refund':    return 'استرداد';
    }
  };

  const getAmountColor = (type: TransactionType) => {
    switch (type) {
      case 'credit':
      case 'commission':
      case 'refund':
        return 'text-[#0f766e]';
      case 'debit':
        return 'text-[#b91c1c]';
    }
  };

  const getRowBackground = (type: TransactionType) => {
    switch (type) {
      case 'credit':     return 'bg-[#ccfbf1] hover:bg-[#a7f3d0]';
      case 'debit':      return 'bg-[#fee2e2] hover:bg-[#fecaca]';
      case 'commission': return 'bg-[#eff4ff] hover:bg-[#dce1ff]';
      case 'refund':     return 'bg-[#fef3c7] hover:bg-[#fde68a]';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#f8f9ff] rounded-lg h-12 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden shadow-sm" dir="rtl">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#f8f9ff] border-b border-[#e2e8f0]">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-semibold text-[#444651] uppercase tracking-wider">
                التاريخ
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-[#444651] uppercase tracking-wider">
                النوع
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-[#444651] uppercase tracking-wider">
                الوصف
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-[#444651] uppercase tracking-wider">
                المبلغ
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-[#444651] uppercase tracking-wider">
                الرصيد بعد
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-[#444651] uppercase tracking-wider">
                رقم المرجع
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {displayEntries.map((entry) => (
              <tr key={entry.id} className={`transition-colors ${getRowBackground(entry.type)}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm font-medium text-[#0b1c30] num">
                    {entry.date.toLocaleDateString('ar-SA', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-[#444651] num">
                    {entry.date.toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(entry.type)}
                    <span className="text-sm font-medium text-[#0b1c30]">
                      {getTypeLabel(entry.type)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-[#0b1c30] font-medium">{entry.description}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className={`num text-sm font-bold ${getAmountColor(entry.type)}`}>
                      {formatAmount(Math.abs(entry.amount))}{entry.amount > 0 ? '+' : '-'}
                    </span>
                    <span className="text-xs text-[#444651]">د.ل</span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="num text-sm font-semibold text-[#0b1c30]">
                      {formatAmount(entry.balanceAfter)}
                    </span>
                    <span className="text-xs text-[#444651]">د.ل</span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="num text-xs text-[#444651]">{entry.referenceId}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 p-4">
        {displayEntries.map((entry) => (
          <div
            key={entry.id}
            className={`p-4 rounded-lg border border-[#e2e8f0] ${getRowBackground(entry.type)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getTypeIcon(entry.type)}
                <div>
                  <p className="font-semibold text-[#0b1c30]">{entry.description}</p>
                  <p className="text-xs text-[#444651] num">
                    {entry.date.toLocaleDateString('ar-SA', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <p className={`num text-sm font-bold ${getAmountColor(entry.type)}`}>
                د.ل {entry.amount > 0 ? '+' : ''}{formatAmount(Math.abs(entry.amount))}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-[#444651]">
              <span>{getTypeLabel(entry.type)}</span>
              <span className="font-mono num">{entry.referenceId}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#e2e8f0]">
              <p className="text-xs text-[#444651]">
                الرصيد: <span className="num font-semibold text-[#0b1c30]">د.ل {formatAmount(entry.balanceAfter)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {onLoadMore && (
        <div className="border-t border-[#e2e8f0] p-4 text-center">
          <button
            onClick={onLoadMore}
            className="text-[#00236f] hover:text-[#00164e] font-medium text-sm"
          >
            تحميل المزيد من المعاملات
          </button>
        </div>
      )}
    </div>
  );
}
