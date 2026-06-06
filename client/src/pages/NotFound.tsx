import { useLocation } from 'wouter';
import { Home } from 'lucide-react';

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">

          {/* 404 number */}
          <div className="mb-4">
            <span
              className="font-bold text-[#dce1ff] select-none"
              style={{ fontFamily: "'Inter', sans-serif", fontSize: '5rem', lineHeight: 1 }}
            >
              404
            </span>
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-[#0b1c30] mb-2">الصفحة غير موجودة</h1>
          <p className="text-sm text-[#444651] mb-6">
            عذرًا، الصفحة التي تبحث عنها غير موجودة أو ربما تم نقلها.
          </p>

          <button
            onClick={() => setLocation('/')}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#00236f] hover:bg-[#00164e] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Home size={16} />
            العودة إلى الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
