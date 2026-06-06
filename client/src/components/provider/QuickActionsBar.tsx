import React from 'react';
import { Upload, Plus, Clock } from 'lucide-react';

interface QuickActionsBarProps {
  onUploadCards?: () => void;
  onAddProduct?: () => void;
  onViewRequests?: () => void;
  pendingRequestsCount?: number;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  onUploadCards,
  onAddProduct,
  onViewRequests,
  pendingRequestsCount = 0,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          <p className="text-sm text-gray-600 mt-1">Common tasks to manage your provider account</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button
            onClick={onUploadCards}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
          >
            <Upload size={18} />
            Upload Cards
          </button>

          <button
            onClick={onAddProduct}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
          >
            <Plus size={18} />
            Add Product
          </button>

          <button
            onClick={onViewRequests}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm whitespace-nowrap relative"
          >
            <Clock size={18} />
            View Requests
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
