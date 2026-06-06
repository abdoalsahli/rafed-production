import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDateOnly } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { ProviderRequest } from '@/hooks/data/useProviderRequests';
import { CheckCircle2, XCircle } from 'lucide-react';

const PAGE_SIZE = 10;

interface ProviderRequestsTableProps {
  requests: ProviderRequest[];
  isLoading: boolean;
  onApprove: (requestId: number) => void;
  onReject: (requestId: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending:  'معلق',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-[#fef3c7] text-[#b45309]',
  approved: 'bg-[#ccfbf1] text-[#0f766e]',
  rejected: 'bg-[#fee2e2] text-[#b91c1c]',
};

export function ProviderRequestsTable({
  requests,
  isLoading,
  onApprove,
  onReject,
}: ProviderRequestsTableProps) {
  const [page, setPage] = useState(1);
  const all        = requests ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الموزع</TableHead>
            <TableHead>نوع الطلب</TableHead>
            <TableHead>التفاصيل</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>تاريخ الإنشاء</TableHead>
            <TableHead className="text-center">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6 text-[#444651]">
                جاري التحميل…
              </TableCell>
            </TableRow>
          ) : rows.length > 0 ? (
            rows.map((request: ProviderRequest) => (
              <TableRow key={request.requestId || request.id}>
                <TableCell className="font-medium text-[#0b1c30]">{request.distributorName}</TableCell>
                <TableCell className="text-[#444651]">{request.requestType || 'طلب ربط'}</TableCell>
                <TableCell className="text-sm text-[#444651]">
                  {request.requestedCommission && `عمولة: ${request.requestedCommission}%`}
                  {request.requestedCreditLine && ` | ائتمان: $${request.requestedCreditLine}`}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[request.status] || 'bg-[#f1f5f9] text-[#64748b]'}>
                    {STATUS_LABELS[request.status] || request.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-[#444651]">
                  {request.createdAt ? formatDateOnly(request.createdAt) : '-'}
                </TableCell>
                <TableCell className="text-center space-x-2">
                  {request.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        title="قبول"
                        onClick={() => onApprove((request.requestId || request.id) as number)}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="رفض"
                        onClick={() => onReject((request.requestId || request.id) as number)}
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-[#444651]">
                لم يتم العثور على طلبات
              </TableCell>
            </TableRow>
          )}
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
    </Card>
  );
}
