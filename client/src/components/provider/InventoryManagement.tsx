import React, { useState } from 'react';
import { AlertTriangle, Edit2, Upload, Eye } from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  price: number;
  availableCards: number;
  soldCards: number;
}

interface InventoryManagementProps {
  products: Product[];
  isLoading?: boolean;
  onLowStockWarning?: (product: Product) => void;
  onEditPrice?: (product: Product) => void;
  onUploadCards?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

const LOW_STOCK_THRESHOLD = 100;

export const InventoryManagement: React.FC<InventoryManagementProps> = ({
  products,
  isLoading = false,
  onEditPrice,
  onUploadCards,
  onViewDetails,
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'available' | 'sold'>('name');

  const lowStockProducts = products.filter((p) => p.availableCards < LOW_STOCK_THRESHOLD);

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'available':
        return b.availableCards - a.availableCards;
      case 'sold':
        return b.soldCards - a.soldCards;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Inventory Management</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Inventory Management</h3>
          <span className="text-sm text-gray-600">{products.length} products</span>
        </div>

        {/* Low Stock Warning */}
        {lowStockProducts.length > 0 && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-900">Low Stock Alert</p>
              <p className="text-sm text-yellow-800 mt-1">
                {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} have less than {LOW_STOCK_THRESHOLD} cards available
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Product Name</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700">Price</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700">
                <button
                  onClick={() => setSortBy('available')}
                  className="hover:text-gray-900 transition-colors"
                >
                  Available Cards
                </button>
              </th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700">
                <button
                  onClick={() => setSortBy('sold')}
                  className="hover:text-gray-900 transition-colors"
                >
                  Sold Cards
                </button>
              </th>
              <th className="text-center py-3 px-6 font-semibold text-gray-700">Status</th>
              <th className="text-center py-3 px-6 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product) => {
              const isLowStock = product.availableCards < LOW_STOCK_THRESHOLD;
              const totalCards = product.availableCards + product.soldCards;
              const sellThroughRate = totalCards > 0 ? (product.soldCards / totalCards) * 100 : 0;

              return (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {sellThroughRate.toFixed(1)}% sell-through rate
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <p className="num font-semibold text-gray-900">
                      {'د.ل '}{product.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                        {product.availableCards.toLocaleString()}
                      </span>
                      {isLowStock && (
                        <AlertTriangle size={16} className="text-red-600" />
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <p className="font-semibold text-green-600">
                      +{product.soldCards.toLocaleString()}
                    </p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {isLowStock ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEditPrice?.(product)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Edit price"
                      >
                        <Edit2 size={16} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => onUploadCards?.(product)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Upload more cards"
                      >
                        <Upload size={16} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => onViewDetails?.(product)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye size={16} className="text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="border-t border-gray-200 p-6 bg-gray-50">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Available</p>
            <p className="text-2xl font-bold text-gray-900">
              {products.reduce((sum, p) => sum + p.availableCards, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Sold</p>
            <p className="text-2xl font-bold text-green-600">
              +{products.reduce((sum, p) => sum + p.soldCards, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Avg Sell-Through</p>
            <p className="text-2xl font-bold text-gray-900">
              {(
                (products.reduce((sum, p) => sum + p.soldCards, 0) /
                  (products.reduce((sum, p) => sum + p.availableCards + p.soldCards, 0) || 1)) *
                100
              ).toFixed(1)}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
