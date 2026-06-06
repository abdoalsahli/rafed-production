import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { ProviderDistributor } from '@/hooks/data/useProviderDistributors';
import { AlertTriangle, CheckCircle2, PlusCircle } from 'lucide-react';
import { TopUpModal } from './TopUpModal';

const PAGE_SIZE = 10;

interface ProviderDistributorsTableProps {
  distributors: ProviderDistributor[];
  isLoading: boolean;
  onSuspend: (relationshipId: number) => void;
  onReactivate: (relationshipId: number) => void;
  onTopUpSuccess?: () => void;
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

export function ProviderDistributorsTable({
  distributors,
  isLoading,
  onSuspend,
  onReactivate,
  onTopUpSuccess,
}: ProviderDistributorsTableProps) {
  const [topUpTarget, setTopUpTarget] = useState<ProviderDistributor | null>(null);
  const [page,        setPage]        = useState(1);

  const all        = distributors ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الموزع</TableHead>
              <TableHead>نسبة العمولة</TableHead>
              <TableHead>الرصيد</TableHead>
              <TableHead>حد الائتمان</TableHead>
              <TableHead>الائتمان المستخدم</TableHead>
              <TableHead>المتاح</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-[#444651]">
                  جاري التحميل…
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((dist: ProviderDistributor) => (
                <TableRow key={dist.relationshipId || dist.id}>
                  <TableCell className="font-medium text-[#0b1c30]">{dist.distributorName}</TableCell>
                  <TableCell className="num text-[#0b1c30]">{dist.commissionPercentage}%</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span className="num font-semibold text-[#00236f]">{(dist.balance || 0).toFixed(2)}</span>
                      <span className="text-xs text-[#444651]">د.ل</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span className="num">{dist.creditLine?.toFixed(2) || '0.00'}</span>
                      <span className="text-xs text-[#444651]">د.ل</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span className="num text-[#b91c1c]">{(dist.usedCredit || 0).toFixed(2)}</span>
                      <span className="text-xs text-[#444651]">د.ل</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span className="num text-[#0f766e]">{(dist.availableToSpend || 0).toFixed(2)}</span>
                      <span className="text-xs text-[#444651]">د.ل</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[dist.status] || 'bg-[#f1f5f9] text-[#64748b]'}>
                      {STATUS_LABELS[dist.status] || dist.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {dist.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTopUpTarget(dist)}
                          title="إضافة رصيد"
                          className="border-[#0f766e] text-[#0f766e] hover:bg-[#ccfbf1]"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {dist.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSuspend(dist.relationshipId || (dist.id as number))}
                          title="إيقاف"
                        >
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </Button>
                      ) : dist.status === 'suspended' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReactivate(dist.relationshipId || (dist.id as number))}
                          title="إعادة تفعيل"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-[#444651]">
                  لم يتم العثور على موزعين
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

      {topUpTarget && (
        <TopUpModal
          distributorId={topUpTarget.distributorId}
          distributorName={topUpTarget.distributorName}
          currentBalance={topUpTarget.balance || 0}
          onClose={() => setTopUpTarget(null)}
          onSuccess={() => {
            setTopUpTarget(null);
            onTopUpSuccess?.();
          }}
        />
      )}
    </>
  );
}
