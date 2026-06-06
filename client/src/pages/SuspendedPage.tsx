import { ShieldOff } from 'lucide-react';
import { useLocation } from 'wouter';

export default function SuspendedPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#fee2e2] mb-5">
            <ShieldOff size={30} className="text-[#b91c1c]" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h1 className="text-lg font-bold text-[#0b1c30] mb-2">تم تعليق الحساب</h1>
          <p className="text-sm text-[#444651] mb-6">
            تم تعليق حسابك. يرجى التواصل مع الدعم للاستفسار أو الطعن في هذا القرار.
          </p>

          {/* Info box */}
          <div className="bg-[#fee2e2] border border-[#fca5a5] rounded-lg p-4 text-right mb-6">
            <p className="text-xs text-[#b91c1c]">
              إذا كنت تعتقد أن هذا خطأ أو تودّ تقديم طعن، يرجى التواصل مع فريق الدعم.
            </p>
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
