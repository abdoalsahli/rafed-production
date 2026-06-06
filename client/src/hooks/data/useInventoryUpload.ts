import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export interface UploadHistory {
  id: string;
  fileName: string;
  uploadedAt: Date;
  status: 'completed' | 'failed' | 'pending' | 'processing';
  totalCards: number;
  successRecords: number;
  failedRecords: number;
  [key: string]: any;
}

/**
 * Hook to manage inventory card uploads.
 * Handles uploading cards and tracking upload history.
 */
export function useInventoryUpload() {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const uploadMutation = trpc.provider.uploadCards.useMutation({
    onSuccess: (result) => {
      setUploadResult(result);
      setUploadFile(null);
    },
  });

  const { data: uploadHistoryData, isLoading: isLoadingHistory, refetch: refetchHistory } = 
    trpc.provider.uploadHistory.useQuery({ limit: 50, offset: 0 });
  
  const { data: productsData } = trpc.provider.listProducts.useQuery({});

  const handleUpload = async (file: File, productId?: number) => {
    setUploadFile(file);
    
    // Use the first product if no productId specified
    const finalProductId = productId || (productsData?.products?.[0]?.id) || 1;
    
    // Check file type and handle accordingly
    const fileName = file.name.toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');
    
    if (!isXlsx && !isCsv) {
      throw new Error('Unsupported file format. Please upload CSV or XLSX file.');
    }
    
    if (isXlsx) {
      // For XLSX files, read as ArrayBuffer and convert to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return uploadMutation.mutateAsync({
        fileBuffer: buffer,
        fileName: file.name,
        productId: finalProductId,
      });
    } else {
      // For CSV files, read as text
      const text = await file.text();
      return uploadMutation.mutateAsync({
        csvContent: text,
        fileName: file.name,
        productId: finalProductId,
      });
    }
  };

  const clearUploadResult = () => {
    setUploadResult(null);
  };

  return {
    uploadFile,
    setUploadFile,
    uploadResult,
    clearUploadResult,
    uploadHistory: uploadHistoryData?.uploads || [],
    isUploading: uploadMutation.isPending,
    isLoadingHistory,
    uploadError: uploadMutation.error,
    uploadHistoryError: uploadHistoryData ? undefined : 'Failed to load upload history',
    handleUpload,
    refetchHistory,
    refetchUploadHistory: refetchHistory,
  };
}
