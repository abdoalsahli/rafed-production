import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { User } from '@/hooks/data/useUsers';

const PAGE_SIZE = 10;

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  status: 'pending' | 'active' | 'suspended';
  onActivate: (userId: number) => void;
  onSuspend: (userId: number) => void;
  onAssignRole: (userId: number, organizationId: number, role: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'معلق',
  active:    'نشط',
  suspended: 'موقوف',
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-[#fef3c7] text-[#b45309]',
  active:    'bg-[#ccfbf1] text-[#0f766e]',
  suspended: 'bg-[#fee2e2] text-[#b91c1c]',
};

export function UsersTable({
  users,
  isLoading,
  status,
  onActivate,
  onSuspend,
  onAssignRole,
}: UsersTableProps) {
  const [page, setPage] = useState(1);
  // Reset to page 1 when the tab changes (different users array)
  useEffect(() => { setPage(1); }, [users]);

  const all        = users ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>البريد الإلكتروني</TableHead>
            <TableHead>الاسم</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>المؤسسة</TableHead>
            <TableHead>الدور</TableHead>
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
            rows.map((user: User) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium num text-[#0b1c30]">
                  {user.email || '-'}
                </TableCell>
                <TableCell className="text-[#0b1c30]">{user.name || '-'}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[user.status] || 'bg-[#f1f5f9] text-[#64748b]'}>
                    {STATUS_LABELS[user.status] || user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-[#444651]">
                  {user.organizations && user.organizations.length > 0
                    ? user.organizations.map((org) => org.organizationId).join(', ')
                    : '-'}
                </TableCell>
                <TableCell>
                  {user.organizations && user.organizations.length > 0 ? (
                    <Select
                      value={user.organizations[0].role}
                      onValueChange={(role) =>
                        onAssignRole(user.id, user.organizations![0].organizationId, role)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مسؤول</SelectItem>
                        <SelectItem value="operator">مشغّل</SelectItem>
                        <SelectItem value="viewer">مشاهد</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-center space-x-2">
                  {status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onActivate(user.id)}
                      className="border-[#0f766e] text-[#0f766e] hover:bg-[#ccfbf1]"
                    >
                      تفعيل
                    </Button>
                  )}
                  {status === 'active' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onSuspend(user.id)}
                    >
                      إيقاف
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-[#444651]">
                لم يتم العثور على مستخدمين
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
