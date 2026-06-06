import { useState } from 'react';
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
import { Organization } from '@/hooks/data/useOrganizations';

const PAGE_SIZE = 10;

interface OrganizationsTableProps {
  organizations: Organization[];
  isLoading: boolean;
  onEdit: (org: Organization) => void;
}

const TYPE_LABELS: Record<string, string> = {
  provider:    'مزود',
  distributor: 'موزع',
  internal:    'داخلي',
};

const TYPE_COLORS: Record<string, string> = {
  provider:    'bg-[#dce1ff] text-[#00236f]',
  distributor: 'bg-[#ccfbf1] text-[#0f766e]',
  internal:    'bg-[#f3e8ff] text-[#7c3aed]',
};

const STATUS_LABELS: Record<string, string> = {
  active:    'نشطة',
  suspended: 'موقوفة',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-[#ccfbf1] text-[#0f766e]',
  suspended: 'bg-[#fee2e2] text-[#b91c1c]',
};

export function OrganizationsTable({
  organizations,
  isLoading,
  onEdit,
}: OrganizationsTableProps) {
  const [page, setPage] = useState(1);
  const all        = organizations ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            <TableHead>النوع</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>جهة الاتصال</TableHead>
            <TableHead>البريد الإلكتروني</TableHead>
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
            rows.map((org: Organization) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium text-[#0b1c30]">{org.name}</TableCell>
                <TableCell>
                  <Badge className={TYPE_COLORS[org.type] || 'bg-[#f1f5f9] text-[#64748b]'}>
                    {TYPE_LABELS[org.type] || org.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[org.status] || 'bg-[#f1f5f9] text-[#64748b]'}>
                    {STATUS_LABELS[org.status] || org.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-[#444651]">{org.contactPerson || '-'}</TableCell>
                <TableCell className="num text-[#444651]">
                  {org.email || '-'}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(org)}
                    className="border-[#e2e8f0] text-[#0b1c30] hover:bg-[#f8f9ff]"
                  >
                    تعديل
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-[#444651]">
                لم يتم العثور على مؤسسات
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
