import { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, CheckCircle2, User, Mail, Lock } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name:            '',
    email:           '',
    password:        '',
    confirmPassword: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
      setTimeout(() => setLocation('/login'), 4000);
    },
    onError: (err: any) => {
      setError(err.message || 'فشل إنشاء الحساب');
    },
  });

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين'); return;
    }
    if (formData.password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return;
    }
    signupMutation.mutate({
      email:           formData.email,
      password:        formData.password,
      confirmPassword: formData.confirmPassword,
      name:            formData.name || undefined,
    });
  };

  const field = (key: keyof typeof formData) => ({
    value:    formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData({ ...formData, [key]: e.target.value }),
    disabled: signupMutation.isPending,
  });

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8">

          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#00236f] mb-4">
              <span className="text-white font-bold text-2xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>ر</span>
            </div>
            <h1 className="text-xl font-bold text-[#0b1c30]">إنشاء حساب جديد</h1>
            <p className="text-sm text-[#444651] mt-1">انضم إلى منصة رافد</p>
          </div>

          {/* Success */}
          {success && (
            <div className="mb-5 p-4 bg-[#ccfbf1] border border-[#5eead4] rounded-lg flex items-start gap-3">
              <CheckCircle2 size={18} className="text-[#0f766e] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#0f766e]">
                تم إنشاء حسابك بنجاح! حسابك قيد المراجعة من قِبل المسؤول. سيتم تفعيله قريبًا. يتم توجيهك الآن…
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
              <p className="text-sm text-[#b91c1c]">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">الاسم الكامل</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651]" size={16} />
                <input
                  type="text"
                  {...field('name')}
                  placeholder="اسمك الكامل"
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651]" size={16} />
                <input
                  type="email"
                  dir="ltr"
                  {...field('email')}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651]" size={16} />
                <input
                  type="password"
                  dir="ltr"
                  {...field('password')}
                  placeholder="8 أحرف على الأقل"
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651]" size={16} />
                <input
                  type="password"
                  dir="ltr"
                  {...field('confirmPassword')}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={signupMutation.isPending || success}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00236f] hover:bg-[#00164e] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 mt-1"
            >
              {signupMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء…</>
              ) : (
                'إنشاء الحساب'
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-xs text-[#444651]">
            لديك حساب بالفعل؟{' '}
            <button
              onClick={() => setLocation('/login')}
              disabled={signupMutation.isPending}
              className="text-[#00236f] hover:text-[#00164e] font-semibold disabled:opacity-50"
            >
              تسجيل الدخول
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-[#444651] mt-5">
          © 2026 منصة رافد. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
