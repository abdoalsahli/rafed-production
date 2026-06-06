import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

export interface Transaction {
  id: string;
  date: string | Date;
  provider: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  type: 'debit' | 'credit';
  description?: string;
}

export interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  error?: string | null;
  totalCount?: number;
  onLoadMore?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  credit: 'إيداع',
  debit:  'خصم',
};

const TYPE_COLORS: Record<string, string> = {
  credit: 'bg-[#ccfbf1] text-[#0f766e]',
  debit:  'bg-[#fee2e2] text-[#b91c1c]',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'مكتمل',
  pending:   'معلق',
  failed:    'فاشل',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[#ccfbf1] text-[#0f766e]',
  pending:   'bg-[#fef3c7] text-[#b45309]',
  failed:    'bg-[#fee2e2] text-[#b91c1c]',
};

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  isLoading = false,
  error = null,
  totalCount = 0,
  onLoadMore,
}) => {
  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00236f]" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-[#fee2e2] border-[#fca5a5]">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#b91c1c]">خطأ في تحميل المعاملات</p>
            <p className="text-sm text-[#b91c1c]">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-[#444651] font-medium">لا توجد معاملات بعد</p>
        <p className="text-sm text-[#444651] mt-1">سيظهر سجل معاملاتك هنا</p>
      </Card>
    );
  }

  return (
    <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f8f9ff]">
            <TableHead>رقم المعاملة</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>المزود</TableHead>
            <TableHead>النوع</TableHead>
            <TableHead>المبلغ</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>الوصف</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-mono text-sm num">{tx.id}</TableCell>
              <TableCell className="text-sm text-[#444651]">
                {typeof tx.date === 'string' ? tx.date : new Date(tx.date).toLocaleString('en-US')}
              </TableCell>
              <TableCell className="text-[#0b1c30]">{tx.provider}</TableCell>
              <TableCell>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  TYPE_COLORS[tx.type] || 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {TYPE_LABELS[tx.type] || tx.type}
                </span>
              </TableCell>
              <TableCell
                className={`num font-medium ${
                  tx.type === 'credit' ? 'text-[#0f766e]' : 'text-[#0b1c30]'
                }`}
              >
                {'د.ل '}{tx.type === 'credit' ? '+' : '-'}{tx.amount.toFixed(2)}
              </TableCell>
              <TableCell>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  STATUS_COLORS[tx.status] || 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {STATUS_LABELS[tx.status] || tx.status}
                </span>
              </TableCell>
              <TableCell className="text-sm text-[#444651]">{tx.description || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {onLoadMore && transactions.length < totalCount && (
        <div className="p-4 text-center border-t border-[#e2e8f0]">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="text-[#00236f] hover:text-[#00164e] font-medium text-sm disabled:opacity-50"
          >
            {isLoading ? 'جاري التحميل…' : 'تحميل المزيد'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionsTable;
