import { useRef } from 'react';
import { Upload, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface LogoUploadProps {
  logoUrl:    string | null;
  onUpload:   (dataUrl: string) => Promise<void>;
  isUploading: boolean;
}

export function LogoUpload({ logoUrl, onUpload, isUploading }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (الحد الأقصى 1.5 ميغابايت)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        className="relative w-20 h-20 rounded-xl border-2 border-dashed border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#00236f] transition-colors"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="شعار المؤسسة" className="w-full h-full object-contain p-1" />
        ) : (
          <Building2 size={28} className="text-[#94a3b8]" />
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#00236f]" />
          </div>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => !isUploading && inputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#0b1c30] hover:bg-[#f8f9ff] transition-colors disabled:opacity-50"
        >
          <Upload size={14} />
          {logoUrl ? 'تغيير الشعار' : 'رفع الشعار'}
        </button>
        <p className="text-xs text-[#94a3b8] mt-1">PNG أو JPG، بحد أقصى 1.5 ميغابايت</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
