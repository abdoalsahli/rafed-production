import { useState } from 'react';
import { formatAmount, formatCount } from '@/lib/numberUtils';
import { Badge } from '@/components/ui/badge';
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
import { InventoryItem } from '@/hooks/data/useInventory';
import { AlertTriangle } from 'lucide-react';

const PAGE_SIZE = 10;

interface InventoryTableProps {
  inventory: InventoryItem[];
  isLoading: boolean;
}

export function InventoryTable({ inventory, isLoading }: InventoryTableProps) {
  const [page, setPage] = useState(1);
  const all        = inventory ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>اسم المنتج</TableHead>
            <TableHead>السعر</TableHead>
            <TableHead>البطاقات المتاحة</TableHead>
            <TableHead>البطاقات المباعة</TableHead>
            <TableHead>إجمالي البطاقات</TableHead>
            <TableHead>الحالة</TableHead>
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
            rows.map((item: InventoryItem) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-[#0b1c30]">{item.name}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <span className="num text-[#0b1c30]">
                      {formatAmount(item.price)}
                    </span>
                    <span className="text-xs text-[#444651]">د.ل</span>
                  </span>
                </TableCell>
                <TableCell className="num text-[#0b1c30]">{formatCount(item.availableCards)}</TableCell>
                <TableCell className="num text-[#0b1c30]">{formatCount(item.soldCards)}</TableCell>
                <TableCell className="num text-[#0b1c30]">
                  {formatCount(item.totalCards || item.availableCards + item.soldCards)}
                </TableCell>
                <TableCell>
                  {item.lowStock ? (
                    <Badge className="bg-[#fee2e2] text-[#b91c1c] flex items-center gap-1 w-fit">
                      <AlertTriangle className="w-3 h-3" />
                      مخزون منخفض
                    </Badge>
                  ) : (
                    <Badge className="bg-[#ccfbf1] text-[#0f766e]">طبيعي</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-[#444651]">
                لم يتم العثور على عناصر مخزون
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
