import React, { useState } from 'react';
import { formatDateOnly } from '@/lib/dateUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { TablePaginationFooter } from '@/components/ui/TablePagination';

const PAGE_SIZE = 10;

export interface ConnectedProvider {
  id: number;
  name: string;
  status: 'active' | 'suspended' | 'pending';
  commissionPercentage?: number | string;
  commissionType?: string;
  creditLine?: number | string;
  availableCredit?: number | string;
  usedCredit?: number | string;
  connectedAt?: Date | string;
  code?: string;
  relationshipId?: number;
}

export interface ConnectedProvidersTableProps {
  providers: ConnectedProvider[];
  isLoading?: boolean;
  error?: string | null;
  onDisconnect?: (providerId: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  active:    'نشط',
  suspended: 'موقوف',
  pending:   'معلق',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-[#ccfbf1] text-[#0f766e]',
  suspended: 'bg-[#fee2e2] text-[#b91c1c]',
  pending:   'bg-[#fef3c7] text-[#b45309]',
};

export const ConnectedProvidersTable: React.FC<ConnectedProvidersTableProps> = ({
  providers,
  isLoading = false,
  error = null,
  onDisconnect,
}) => {
  const [page, setPage] = useState(1);
  const all        = providers ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
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
            <p className="font-medium text-[#b91c1c]">خطأ في تحميل المزودين</p>
            <p className="text-sm text-[#b91c1c]">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (providers.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-[#444651] font-medium">لا يوجد مزودون مرتبطون حتى الآن</p>
        <p className="text-sm text-[#444651] mt-1">أرسل طلب ربط لأحد المزودين للبدء</p>
      </Card>
    );
  }

  return (
    <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f8f9ff]">
            <TableHead>اسم المزود</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>نسبة العمولة</TableHead>
            <TableHead>حد الائتمان</TableHead>
            <TableHead>الائتمان المتاح</TableHead>
            <TableHead>تاريخ الربط</TableHead>
            <TableHead className="text-center">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((provider) => (
            <TableRow key={provider.id}>
              <TableCell className="font-medium text-[#0b1c30]">{provider.name}</TableCell>
              <TableCell>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  STATUS_COLORS[provider.status] || 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {STATUS_LABELS[provider.status] || provider.status}
                </span>
              </TableCell>
              <TableCell className="num">
                {Number(provider.commissionPercentage || 0).toFixed(2)}%
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <span className="num">{Number(provider.creditLine || 0).toFixed(2)}</span>
                  <span className="text-xs text-[#444651]">د.ل</span>
                </span>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <span className="num text-[#0f766e]">{Number(provider.availableCredit || 0).toFixed(2)}</span>
                  <span className="text-xs text-[#444651]">د.ل</span>
                </span>
              </TableCell>
              <TableCell className="text-sm text-[#444651]">
                {provider.connectedAt ? formatDateOnly(provider.connectedAt) : '-'}
              </TableCell>
              <TableCell className="text-center">
                {onDisconnect && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#b91c1c] text-[#b91c1c] hover:bg-[#fee2e2]"
                    onClick={() => onDisconnect(provider.id)}
                  >
                    قطع الاتصال
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePaginationFooter
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        totalRows={all.length}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
};

export default ConnectedProvidersTable;
