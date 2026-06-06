import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDateOnly } from '@/lib/dateUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { UploadHistory } from '@/hooks/data/useInventoryUpload';
import { CheckCircle2, XCircle, Clock, FileUp } from 'lucide-react';

const PAGE_SIZE = 10;

interface UploadHistoryTableProps {
  uploads: UploadHistory[];
  isLoading: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  completed:  'مكتمل',
  failed:     'فاشل',
  pending:    'معلق',
  processing: 'جاري المعالجة',
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':  return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'failed':     return <XCircle className="w-3.5 h-3.5" />;
    default:           return <Clock className="w-3.5 h-3.5" />;
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-[#ccfbf1] text-[#0f766e] border border-[#5eead4]/50';
    case 'failed':
      return 'bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5]/50';
    case 'pending':
    case 'processing':
      return 'bg-[#fef3c7] text-[#b45309] border border-[#fcd34d]/50';
    default:
      return 'bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]';
  }
};

/* ── Skeleton row shown while loading ───────────────────────────────────── */
function SkeletonRow() {
  return (
    <TableRow className="hover:bg-transparent">
      {[140, 90, 82, 64, 48, 48].map((w, i) => (
        <TableCell key={i}>
          <div
            className="h-3.5 bg-[#e9edf2] rounded-full animate-pulse"
            style={{ width: w }}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function UploadHistoryTable({ uploads, isLoading }: UploadHistoryTableProps) {
  const [page, setPage] = useState(1);
  const all        = uploads ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>اسم الملف</TableHead>
            <TableHead>تاريخ الرفع</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجمالي البطاقات</TableHead>
            <TableHead>ناجح</TableHead>
            <TableHead>فاشل</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
          ) : rows.length > 0 ? (
            rows.map((upload: UploadHistory) => (
              <TableRow key={upload.id}>
                <TableCell className="font-medium text-[#0b1c30] max-w-[200px] truncate">
                  {upload.fileName}
                </TableCell>
                <TableCell className="num text-sm text-[#444651]">
                  {formatDateOnly(upload.uploadedAt)}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClass(upload.status)}`}
                  >
                    {getStatusIcon(upload.status)}
                    {STATUS_LABELS[upload.status] || upload.status}
                  </Badge>
                </TableCell>
                <TableCell className="num text-[#0b1c30]">{upload.totalCards}</TableCell>
                <TableCell className="num font-semibold text-[#0f766e]">{upload.successRecords}</TableCell>
                <TableCell className="num font-semibold text-[#b91c1c]">{upload.failedRecords}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="py-0">
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#f1f5f9] flex items-center justify-center mb-3">
                    <FileUp size={22} className="text-[#94a3b8]" />
                  </div>
                  <p className="text-sm font-medium text-[#444651]">لا يوجد سجل رفع</p>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-snug">
                    ستظهر سجلات الرفع هنا بعد إضافة البطاقات
                  </p>
                </div>
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
    </>
  );
}
