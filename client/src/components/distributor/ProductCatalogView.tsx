import React, { useState } from 'react';
import { formatAmount } from '@/lib/numberUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, ShoppingCart } from 'lucide-react';

export interface CatalogProduct {
  id: number;
  name: string;
  displayName?: string;
  faceValue?: number;
  price: number;
  currency?: string;
  providerId: number;
  providerName: string;
  status: 'active' | 'inactive';
  inStock?: boolean;
}

export interface ProductCatalogViewProps {
  products: CatalogProduct[];
  isLoading?: boolean;
  error?: string | null;
  onPurchase?: (productId: number) => void;
  onFilterChange?: (filter: { searchTerm?: string; providerId?: number }) => void;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  products,
  isLoading = false,
  error = null,
  onPurchase,
  onFilterChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<number | undefined>();

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onFilterChange?.({ searchTerm: value, providerId: selectedProvider });
  };

  const handleProviderFilter = (providerId: number | undefined) => {
    setSelectedProvider(providerId);
    onFilterChange?.({ searchTerm, providerId });
  };

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
            <p className="font-medium text-[#b91c1c]">خطأ في تحميل الكتالوج</p>
            <p className="text-sm text-[#b91c1c]">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ShoppingCart className="h-12 w-12 text-[#444651] mx-auto mb-4" />
        <p className="text-[#444651] font-medium">لا توجد منتجات متاحة</p>
        <p className="text-sm text-[#444651] mt-1">تواصل مع المزودين لعرض كتالوج منتجاتهم</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="ابحث عن منتج..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 focus:border-[#00236f]"
        />
        <Button
          variant={selectedProvider ? 'default' : 'outline'}
          onClick={() => handleProviderFilter(undefined)}
          className={selectedProvider ? 'bg-[#00236f]' : ''}
        >
          جميع المزودين
        </Button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg text-[#0b1c30]">{product.displayName || product.name}</CardTitle>
              <p className="text-sm text-[#444651]">{product.providerName}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#444651]">القيمة الاسمية</p>
                  <p className="font-medium num">{'د.ل '}{formatAmount(product.faceValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#444651]">السعر</p>
                  <p className="font-medium num">{'د.ل '}{formatAmount(product.price)}</p>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  product.status === 'active'
                    ? 'bg-[#ccfbf1] text-[#0f766e]'
                    : 'bg-[#f1f5f9] text-[#64748b]'
                }`}>
                  {product.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>

              <Button
                onClick={() => onPurchase?.(product.id)}
                disabled={product.status !== 'active' || product.inStock === false}
                className="w-full mt-2 bg-[#00236f] hover:bg-[#00164e]"
              >
                شراء الآن
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProductCatalogView;
