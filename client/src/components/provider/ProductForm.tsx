import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Product, CreateProductInput, UpdateProductInput } from '@/hooks/data/useProducts';
import { useState, useEffect } from 'react';

interface ProductFormProps {
  product?: Product | null;
  isLoading: boolean;
  onSubmit: (data: CreateProductInput | UpdateProductInput) => void;
  onCancel: () => void;
}

export function ProductForm({
  product,
  isLoading,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    displayName: string;
    faceValue: string;
    currency: string;
    description: string;
    price: string;
  }>({
    name: '',
    displayName: '',
    faceValue: '',
    currency: 'LYD',
    description: '',
    price: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        displayName: product.displayName || '',
        faceValue: product.faceValue?.toString() || '',
        currency: product.currency || 'LYD',
        description: product.description || '',
        price: product.price?.toString() || '',
      });
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (product) {
      onSubmit({
        productId: product.id,
        name: formData.name,
        displayName: formData.displayName,
        faceValue: formData.faceValue ? parseFloat(formData.faceValue) : undefined,
        currency: formData.currency,
        description: formData.description,
        price: formData.price ? parseFloat(formData.price) : undefined,
      });
    } else {
      onSubmit({
        name: formData.name,
        price: formData.price ? parseFloat(formData.price) : 0,
        displayName: formData.displayName,
        faceValue: formData.faceValue ? parseFloat(formData.faceValue) : undefined,
        currency: formData.currency,
        description: formData.description,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div>
        <label className="text-sm font-medium text-[#0b1c30]">الاسم *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="اسم المنتج"
          required
          className="mt-1 focus:border-[#00236f]"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#0b1c30]">الاسم المعروض</label>
        <Input
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          placeholder="الاسم المعروض"
          className="mt-1 focus:border-[#00236f]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#0b1c30]">القيمة الاسمية</label>
          <Input
            value={formData.faceValue}
            onChange={(e) => setFormData({ ...formData, faceValue: e.target.value })}
            placeholder="القيمة الاسمية"
            type="number"
            className="mt-1 num focus:border-[#00236f]"
            dir="ltr"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[#0b1c30]">السعر *</label>
          <Input
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="السعر"
            type="number"
            required
            className="mt-1 num focus:border-[#00236f]"
            dir="ltr"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-[#0b1c30]">العملة</label>
        <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
          <SelectTrigger className="mt-1 num">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LYD">LYD</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="GBP">GBP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-[#0b1c30]">الوصف</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="وصف المنتج"
          rows={3}
          className="mt-1 focus:border-[#00236f]"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          className="flex-1 bg-[#00236f] hover:bg-[#00164e]"
          disabled={isLoading}
        >
          {isLoading
            ? (product ? 'جاري التحديث…' : 'جاري الإنشاء…')
            : (product ? 'تحديث' : 'إنشاء')}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
