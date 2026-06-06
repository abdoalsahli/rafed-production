import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useProducts, Product } from '@/hooks/data/useProducts';
import { ProductsTable } from '@/components/provider/ProductsTable';
import { ProductForm } from '@/components/provider/ProductForm';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package, Plus, Upload, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';

export function ProductsPage() {
  const [isCreateOpen, setIsCreateOpen]   = useState(false);
  const [isEditOpen,   setIsEditOpen]     = useState(false);
  const [isImportOpen, setIsImportOpen]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [statusFilter, setStatusFilter]   = useState<'all' | 'active' | 'inactive'>('all');

  const {
    products,
    isLoading,
    isCreating,
    isUpdating,
    searchTerm,
    setSearchTerm,
    currencyFilter,
    setCurrencyFilter,
    currencies,
    handleCreate,
    handleUpdate,
    handleStatusChange,
    handleDelete,
    handleImport,
  } = useProducts(statusFilter);

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditOpen(true);
  };

  const handleCreateSubmit = async (data: any) => {
    try {
      await handleCreate(data);
      setIsCreateOpen(false);
      toast.success('تم إنشاء المنتج بنجاح');
    } catch (error: any) {
      toast.error(error?.message || 'فشل إنشاء المنتج');
    }
  };

  const handleEditSubmit = async (data: any) => {
    try {
      await handleUpdate(data);
      setIsEditOpen(false);
      setSelectedProduct(null);
      toast.success('تم تحديث المنتج بنجاح');
    } catch (error: any) {
      toast.error(error?.message || 'فشل تحديث المنتج');
    }
  };

  const handleImportSubmit = async (file: File) => {
    await handleImport(file);
    setIsImportOpen(false);
  };

  const onStatusChange = (productId: number, status: 'active' | 'inactive') => {
    handleStatusChange(productId, status === 'active');
  };

  const onDelete = async (productId: number) => {
    try {
      await handleDelete(productId);
      toast.success('تم حذف المنتج بنجاح');
    } catch (error: any) {
      toast.error(error?.message || 'فشل حذف المنتج');
    }
  };

  /* ── derived metrics ───────────────────────────────────────────────────── */
  const totalProducts    = useMemo(() => products?.length || 0,                                    [products]);
  const activeProducts   = useMemo(() => products?.filter(p => p.status === 'active').length || 0, [products]);
  const inactiveProducts = useMemo(() => products?.filter(p => p.status === 'inactive').length || 0,[products]);

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <PageHeader
        title="إدارة المنتجات"
        subtitle="استعرض وأضف وعدّل منتجاتك الرقمية"
        actions={
          <>
            {/* Import */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <Upload size={15} /> استيراد
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>استيراد المنتجات</DialogTitle>
                  <DialogDescription>ارفع ملف CSV لاستيراد المنتجات</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <input
                    type="file"
                    accept=".csv"
                    className="w-full text-sm"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImportSubmit(e.target.files[0]);
                    }}
                  />
                  <Button className="w-full">استيراد</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Create */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a]">
                  <Plus size={15} /> إضافة منتج
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة منتج جديد</DialogTitle>
                  <DialogDescription>أضف منتجاً جديداً إلى كتالوجك</DialogDescription>
                </DialogHeader>
                <ProductForm
                  product={null}
                  isLoading={isCreating}
                  onSubmit={handleCreateSubmit}
                  onCancel={() => setIsCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="إجمالي المنتجات"
            value={totalProducts}
            icon={<Package size={20} />}
            iconVariant="primary"
          />
          <StatCard
            title="المنتجات النشطة"
            value={activeProducts}
            icon={<CheckCircle size={20} />}
            iconVariant="teal"
          />
          <StatCard
            title="المنتجات غير النشطة"
            value={inactiveProducts}
            icon={<XCircle size={20} />}
            iconVariant="muted"
          />
        </div>
      )}

      {/* ── Filters bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444651]" />
          <Input
            placeholder="بحث في المنتجات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العملات</SelectItem>
            {currencies.filter((c): c is string => c !== null).map((currency: string) => (
              <SelectItem key={currency} value={currency}>{currency}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {totalProducts === 0 && !isLoading && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg">
          <EmptyState
            icon={<Package size={28} />}
            iconVariant="primary"
            title="لا توجد منتجات بعد"
            description="أضف أول منتج أو استورد من ملف CSV"
            action={{ label: '+ إضافة منتج', onClick: () => setIsCreateOpen(true) }}
          />
        </div>
      )}

      {/* ── Products table ────────────────────────────────────────────────── */}
      {(totalProducts > 0 || isLoading) && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <ProductsTable
            products={products}
            isLoading={isLoading}
            onEdit={handleSelectProduct}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        </div>
      )}

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المنتج</DialogTitle>
            <DialogDescription>تحديث بيانات المنتج</DialogDescription>
          </DialogHeader>
          <ProductForm
            product={selectedProduct}
            isLoading={isUpdating}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setIsEditOpen(false);
              setSelectedProduct(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
