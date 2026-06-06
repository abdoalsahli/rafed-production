import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Download,
  Loader2,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { CardUploadPreviewModal } from './CardUploadPreviewModal';
import { cn } from '@/lib/utils';

interface UploadCardsFormProps {
  productId: number;
  productName: string;
  onUploadSuccess?: () => void;
  onFileChange?: (hasFile: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadCardsForm({ productId, productName, onUploadSuccess, onFileChange }: UploadCardsFormProps) {
  const [dragActive,    setDragActive]    = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [previewData,   setPreviewData]   = useState<any>(null);
  const [uploadResult,  setUploadResult]  = useState<any>(null);
  const [uploadError,   setUploadError]   = useState<any>(null);
  const [isValidating,  setIsValidating]  = useState(false);

  /* ── Drag handlers ──────────────────────────────────────────────────────── */
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); setUploadError(null); setUploadResult(null); onFileChange?.(true); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setUploadError(null); setUploadResult(null); onFileChange?.(true); }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadResult(null);
    onFileChange?.(false);
  };

  /* ── Download template ──────────────────────────────────────────────────── */
  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      const response = await fetch('/api/trpc/provider.downloadExcelTemplate', { credentials: 'include' });
      const data = await response.json();
      let templateData;
      if (Array.isArray(data)) {
        if (data[0]?.result?.data?.json) templateData = data[0].result.data.json;
        else if (data[0]?.error) throw new Error(data[0].error.json?.message || 'فشل تنزيل القالب');
      } else {
        if (data.result?.data?.json) templateData = data.result.data.json;
        else if (data.result?.data) templateData = data.result.data;
        else if (data.error) throw new Error(data.error.json?.message || 'فشل تنزيل القالب');
      }
      if (!templateData?.buffer) throw new Error('تنسيق استجابة غير صالح');
      const bytes = new Uint8Array(atob(templateData.buffer).split('').map((c) => c.charCodeAt(0)));
      const blob  = new Blob([bytes], { type: templateData.mimeType });
      const url   = window.URL.createObjectURL(blob);
      const link  = document.createElement('a');
      link.href = url; link.download = templateData.fileName;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('فشل تنزيل القالب: ' + ((error as any)?.message || 'خطأ غير معروف'));
    } finally {
      setIsDownloading(false);
    }
  };

  /* ── Validate file ──────────────────────────────────────────────────────── */
  const handleValidateFile = async () => {
    if (!selectedFile) { setUploadError({ message: 'يرجى اختيار ملف أولاً' }); return; }
    try {
      setIsValidating(true);
      setUploadError(null);
      const uint8Array = new Uint8Array(await selectedFile.arrayBuffer());
      const base64     = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
      const response   = await fetch('/api/trpc/provider.previewCardUpload', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { productId, fileName: selectedFile.name, fileBuffer: base64 } }),
      });
      const data = await response.json();
      let preview;
      if (Array.isArray(data)) {
        if (data[0]?.result?.data?.json) preview = data[0].result.data.json;
        else if (data[0]?.error) throw new Error(data[0].error.json?.message || 'فشل التحقق');
      } else {
        if (data.result?.data?.json) preview = data.result.data.json;
        else if (data.result?.data) preview = data.result.data;
        else if (data.error) throw new Error(data.error.json?.message || 'فشل التحقق');
      }
      setPreviewData(preview);
    } catch (error) {
      setUploadError({ message: (error as any)?.message || 'فشل التحقق من الملف' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleUploadSuccess = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setUploadResult({
      successRecords: previewData?.validRows   || 0,
      failedRecords:  previewData?.invalidRows || 0,
    });
    onUploadSuccess?.();
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 h-full flex flex-col">

      {/* ── Drop zone ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-1 border-2 border-dashed rounded-xl transition-all duration-200 overflow-hidden',
          dragActive
            ? 'border-[#00236f] bg-[#eff4ff] scale-[1.005]'
            : selectedFile
            ? 'border-[#00236f]/40 bg-[#f8f9ff]'
            : 'border-[#d1d9e0] bg-white hover:border-[#00236f]/40 hover:bg-[#fafbff]',
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center py-7 px-6 text-center gap-2.5">

          {/* Cloud upload icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200',
              dragActive
                ? 'bg-[#00236f] text-white shadow-lg shadow-[#00236f]/20'
                : 'bg-[#eff4ff] text-[#00236f]',
            )}
          >
            <CloudUpload size={22} />
          </div>

          {/* Text OR file chip — mutually exclusive, same vertical slot */}
          {selectedFile ? (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-[#00236f]/20 rounded-xl shadow-sm max-w-xs w-full">
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center shrink-0">
                <FileSpreadsheet size={14} className="text-[#00236f]" />
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-semibold text-[#0b1c30] truncate leading-tight">
                  {selectedFile.name}
                </p>
                <p className="num text-xs text-[#64748b] leading-snug">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                disabled={isValidating}
                className="text-[#94a3b8] hover:text-[#ef4444] transition-colors shrink-0 disabled:opacity-40"
                aria-label="إزالة الملف"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="space-y-1 text-center">
              <p className="text-sm font-bold text-[#0b1c30]">
                {dragActive ? 'أفلت الملف هنا' : 'اسحب وأفلت الملف هنا'}
              </p>
              <p className="text-xs text-[#64748b] leading-relaxed max-w-xs">
                أو اضغط لتصفح الملفات، يدعم صيغ{' '}
                <span className="num font-semibold text-[#444651]">Excel (.xlsx)</span>
                {' '}و{' '}
                <span className="num font-semibold text-[#444651]">CSV</span>
                {' '}فقط.
              </p>
            </div>
          )}

          {/* Hidden file input */}
          <input
            type="file"
            id="file-input"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isValidating}
            className="hidden"
          />
        </div>

        {/* ── Action bar inside the drop zone ─────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#f1f5f9] bg-[#f8f9ff] gap-3">

          {/* Download template */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDownloading}
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 text-xs border-[#e2e8f0] text-[#444651] hover:border-[#00236f]/40 hover:text-[#00236f] hover:bg-[#eff4ff]"
          >
            {isDownloading
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />}
            {isDownloading ? 'جاري التنزيل…' : 'تحميل النموذج'}
          </Button>

          {/* Choose file / validate */}
          {selectedFile ? (
            <Button
              type="button"
              size="sm"
              disabled={isValidating}
              onClick={handleValidateFile}
              className="flex items-center gap-1.5 text-xs bg-[#00236f] hover:bg-[#00164e] text-white disabled:opacity-50"
            >
              {isValidating && <Loader2 size={13} className="animate-spin" />}
              {isValidating ? 'جاري التحقق…' : 'التحقق من الملف'}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => document.getElementById('file-input')?.click()}
              className="flex items-center gap-1.5 text-xs bg-[#00236f] hover:bg-[#00164e] text-white"
            >
              اختيار الملف
            </Button>
          )}
        </div>
      </div>

      {/* ── Upload success banner ─────────────────────────────────────────── */}
      {uploadResult && (
        <div className="flex items-start gap-3.5 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-[#dcfce7] flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 size={16} className="text-[#16a34a]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#15803d]">تم الرفع بنجاح</p>
            <p className="text-xs text-[#16a34a] mt-0.5">
              تمت إضافة <span className="num font-bold">{uploadResult.successRecords || 0}</span> بطاقة بنجاح
            </p>
            {uploadResult.failedRecords > 0 && (
              <p className="text-xs text-[#b45309] mt-0.5">
                فشل <span className="num font-bold">{uploadResult.failedRecords}</span> سجل
              </p>
            )}
          </div>
          <button type="button" onClick={() => setUploadResult(null)}
            className="text-[#94a3b8] hover:text-[#64748b] transition-colors shrink-0 mt-0.5">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {uploadError && (
        <div className="flex items-start gap-3.5 p-4 bg-[#fff1f2] border border-[#fecdd3] rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-[#ffe4e6] flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle size={16} className="text-[#e11d48]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#be123c]">فشل الرفع</p>
            <p className="text-xs text-[#be123c] mt-0.5">
              {uploadError?.message || 'حدث خطأ أثناء الرفع'}
            </p>
          </div>
          <button type="button" onClick={() => setUploadError(null)}
            className="text-[#94a3b8] hover:text-[#64748b] transition-colors shrink-0 mt-0.5">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Preview modal ────────────────────────────────────────────────── */}
      {previewData && (
        <CardUploadPreviewModal
          preview={previewData}
          productName={productName}
          fileName={selectedFile?.name || 'unknown'}
          onClose={() => setPreviewData(null)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
