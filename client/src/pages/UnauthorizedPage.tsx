import { Lock } from 'lucide-react';
import { useLocation } from 'wouter';

export default function UnauthorizedPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#fee2e2] mb-5">
            <Lock size={30} className="text-[#b91c1c]" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-[#0b1c30] mb-2">غير مصرح بالوصول</h1>
          <p className="text-sm text-[#444651] mb-6">
            ليس لديك صلاحية الوصول إلى هذه الصفحة. دورك الحالي لا يتيح لك الوصول إلى هذا المورد.
          </p>

          <button
            onClick={() => setLocation('/dashboard')}
            className="w-full px-4 py-2.5 bg-[#00236f] hover:bg-[#00164e] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            الانتقال إلى لوحة التحكم
          </button>
        </div>
      </div>
    </div>
  );
}
