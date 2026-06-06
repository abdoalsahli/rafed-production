import { useState } from 'react';
import { TablePaginationFooter } from '@/components/ui/TablePagination';

const PAGE_SIZE = 10;
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Product } from '@/hooks/data/useProducts';
import { Edit2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onStatusChange: (productId: number, status: 'active' | 'inactive') => void;
  onDelete: (productId: number) => void;
}

export function ProductsTable({
  products,
  isLoading,
  onEdit,
  onStatusChange,
  onDelete,
}: ProductsTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [page,          setPage]          = useState(1);

  const all        = products ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const rows       = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الاسم المعروض</TableHead>
              <TableHead>القيمة الاسمية</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>العملة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-[#444651]">
                  جاري التحميل…
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((product: Product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium text-[#0b1c30]">{product.name}</TableCell>
                  <TableCell className="text-[#444651]">{product.displayName || '-'}</TableCell>
                  <TableCell className="text-[#444651]">{product.faceValue || '-'}</TableCell>
                  <TableCell className="num text-[#0b1c30]">
                    {product.price ? Number(product.price).toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-[#444651]">{product.currency || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        product.status === 'active'
                          ? 'bg-[#ccfbf1] text-[#0f766e]'
                          : 'bg-[#f1f5f9] text-[#64748b]'
                      }
                    >
                      {product.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {product.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        title="إيقاف"
                        onClick={() => onStatusChange(product.id, 'inactive')}
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        title="تفعيل"
                        onClick={() => onStatusChange(product.id, 'active')}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      title="حذف"
                      onClick={() => setConfirmDelete(product)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-[#444651]">
                  لم يتم العثور على منتجات
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

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <strong>{confirmDelete?.name}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (confirmDelete) {
                  onDelete(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
