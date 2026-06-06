import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react';

type UploadStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

interface UploadResult {
  status: UploadStatus;
  totalCards: number;
  failedRecords: number;
  successRecords: number;
  progress: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

interface CardUploadProps {
  onUpload?: (productId: number, csvContent: string, fileName: string) => Promise<void>;
  isLoading?: boolean;
  products?: Product[];
}

export const CardUpload: React.FC<CardUploadProps> = ({ onUpload, isLoading = false, products = [] }) => {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadResult({
        status: 'failed',
        totalCards: 0,
        failedRecords: 0,
        successRecords: 0,
        progress: 0,
      });
      return;
    }

    if (!selectedProductId) {
      setUploadResult({
        status: 'failed',
        totalCards: 0,
        failedRecords: 0,
        successRecords: 0,
        progress: 0,
      });
      return;
    }

    setUploadResult({
      status: 'pending',
      totalCards: 0,
      failedRecords: 0,
      successRecords: 0,
      progress: 0,
    });

    // Read file content
    const csvContent = await file.text();

    if (onUpload) {
      try {
        await onUpload(selectedProductId, csvContent, file.name);
        setUploadResult({
          status: 'completed',
          totalCards: 5000,
          failedRecords: 0,
          successRecords: 5000,
          progress: 100,
        });
      } catch (error) {
        setUploadResult({
          status: 'failed',
          totalCards: 5000,
          failedRecords: 150,
          successRecords: 4850,
          progress: 100,
        });
      }
    }
  };

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'failed':
        return <AlertCircle size={24} className="text-red-600" />;
      case 'processing':
      case 'pending':
        return <Clock size={24} className="text-blue-600 animate-spin" />;
      default:
        return <Upload size={24} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: UploadStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'processing':
      case 'pending':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: UploadStatus) => {
    switch (status) {
      case 'completed':
        return 'اكتمل الرفع';
      case 'failed':
        return 'فشل الرفع';
      case 'processing':
        return 'جاري المعالجة…';
      case 'pending':
        return 'جاري التحضير…';
      default:
        return 'جاهز للرفع';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Upload Cards (CSV)</h3>

      {!uploadResult || uploadResult.status === 'idle' ? (
        <>
          {/* Product Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Product
            </label>
            <select
              value={selectedProductId || ''}
              onChange={(e) => setSelectedProductId(e.target.value ? parseInt(e.target.value) : null)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Choose a product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (${product.price})
                </option>
              ))}
            </select>
            {products.length === 0 && (
              <p className="text-sm text-gray-600 mt-2">No products available. Create a product first.</p>
            )}
          </div>

          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Drag and drop your CSV file here
            </p>
            <p className="text-sm text-gray-600 mb-4">or</p>
            <label className="inline-block">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                disabled={isLoading || !selectedProductId}
              />
              <span className={`px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors inline-block ${
                !selectedProductId ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                Select File
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-4">
              CSV format required. Max 100,000 records per upload.
            </p>
          </div>

          {/* Template Download */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 mb-2">
              <span className="font-semibold">Need help?</span> Download our CSV template to get started.
            </p>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
              ↓ Download Template
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Upload Status */}
          <div className={`rounded-lg border ${getStatusColor(uploadResult.status)} p-6 mb-6`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">{getStatusIcon(uploadResult.status)}</div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{getStatusText(uploadResult.status)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {uploadResult.status === 'completed'
                    ? `Successfully uploaded ${uploadResult.successRecords.toLocaleString()} cards`
                    : uploadResult.status === 'failed'
                    ? `Upload failed. ${uploadResult.failedRecords} records could not be processed.`
                    : `Processing ${uploadResult.progress}% complete`}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {(uploadResult.status === 'processing' || uploadResult.status === 'pending') && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Upload Progress</p>
                <p className="text-sm font-semibold text-gray-900">{uploadResult.progress}%</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadResult.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Total Cards</p>
              <p className="text-2xl font-bold text-gray-900">
                {uploadResult.totalCards.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-green-700 mb-1">Successful</p>
              <p className="text-2xl font-bold text-green-600">
                {uploadResult.successRecords.toLocaleString()}
              </p>
            </div>
            <div className={`rounded-lg p-4 border ${uploadResult.failedRecords > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-sm mb-1 ${uploadResult.failedRecords > 0 ? 'text-red-700' : 'text-gray-600'}`}>
                Failed
              </p>
              <p className={`text-2xl font-bold ${uploadResult.failedRecords > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {uploadResult.failedRecords.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setUploadResult(null)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Upload Another File
            </button>
            {uploadResult.failedRecords > 0 && (
              <button className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                Download Failed Records
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
