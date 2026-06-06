import { Clock } from 'lucide-react';
import { useLocation } from 'wouter';

export default function PendingActivationPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#fef3c7] mb-5">
            <Clock size={30} className="text-[#b45309]" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-[#0b1c30] mb-2">الحساب قيد المراجعة</h1>
          <p className="text-sm text-[#444651] mb-6">
            تم إنشاء حسابك وهو بانتظار التفعيل من قِبل مسؤول النظام.
          </p>

          {/* Info box */}
          <div className="bg-[#fef3c7] border border-[#fcd34d] rounded-lg p-4 text-right mb-6 space-y-2">
            <p className="text-xs font-semibold text-[#78350f]">ماذا يحدث بعد ذلك؟</p>
            <ul className="text-xs text-[#92400e] space-y-1">
              <li className="flex items-center gap-2"><span className="text-[#b45309]">✓</span> حسابك تحت المراجعة</li>
              <li className="flex items-center gap-2"><span className="text-[#b45309]">✓</span> ستتلقى بريدًا إلكترونيًا عند التفعيل</li>
              <li className="flex items-center gap-2"><span className="text-[#b45309]">✓</span> يمكنك تسجيل الدخول بعد التفعيل</li>
            </ul>
          </div>

          <button
            onClick={() => setLocation('/login')}
            className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm font-medium text-[#0b1c30] hover:bg-[#f8f9ff] transition-colors"
          >
            العودة إلى تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
