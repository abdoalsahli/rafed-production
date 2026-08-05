import { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, Building2, Users } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { getPostLoginRedirectPath } from '@/lib/roleRedirect';
import { trpc } from '@/lib/trpc';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  const { user, isAuthenticated, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: demoStatus } = trpc.demo.isDemoLoginEnabled.useQuery(undefined, {
    retry: false,
  });
  const isDemoEnabled = demoStatus?.enabled === true;

  const demoLoginMutation = trpc.demo.loginWithDemo.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      refresh();
    },
    onError: (err: any) => {
      setError(err.message || 'فشل تسجيل الدخول التجريبي');
    },
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      refresh();
    },
    onError: (err: any) => {
      setError(err.message || 'فشل تسجيل الدخول');
    },
  });

  useEffect(() => {
    const isComingFromLogout = !localStorage.getItem('manus-runtime-user-info');
    if (isAuthenticated && user && (user as any).organizationType && !isComingFromLogout) {
      const redirectPath = getPostLoginRedirectPath(user);
      setLocation(redirectPath);
    }
  }, [isAuthenticated, user, setLocation]);

  const isLoading = demoLoginMutation.isPending || loginMutation.isPending;

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-10 w-full max-w-sm text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[#00236f]" />
          <p className="text-[#444651] text-sm">جاري التوجيه إلى لوحة التحكم…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8">

          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#00236f] mb-4">
              <span className="text-white font-bold text-2xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>ر</span>
            </div>
            <h1 className="text-xl font-bold text-[#0b1c30]">أهلاً بك في منصة رافد</h1>
            <p className="text-sm text-[#444651] mt-1">اختر نوع حسابك للمتابعة</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
              <p className="text-sm text-[#b91c1c]">{error}</p>
            </div>
          )}

          {/* Demo account cards */}
          {isDemoEnabled && (
            <div className="mb-6">
              <p className="text-xs text-[#8a96a3] mb-3 text-center tracking-wide">اختر حساباً للدخول</p>
              <div className="flex flex-col gap-2.5">

                <button
                  type="button"
                  onClick={() => { setError(''); demoLoginMutation.mutate({ email: 'admin@mostanad.ly' }); }}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 border border-[#e2e8f0] rounded-xl bg-white hover:bg-[#f0f4ff] hover:border-[#00236f] transition-all disabled:opacity-50 group text-right"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#eef2fb] flex items-center justify-center group-hover:bg-[#d9e4f8] transition-colors">
                    {demoLoginMutation.isPending && demoLoginMutation.variables?.email === 'admin@mostanad.ly'
                      ? <Loader2 size={18} className="animate-spin text-[#00236f]" />
                      : <Building2 size={18} className="text-[#00236f]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0b1c30] leading-snug">مزوّد الخدمة</p>
                    <p className="text-xs text-[#8a96a3] mt-0.5">إدارة الكروت والموزّعين والمخزون</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setError(''); demoLoginMutation.mutate({ email: 'admin@distributer1.ly' }); }}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 border border-[#e2e8f0] rounded-xl bg-white hover:bg-[#f0f4ff] hover:border-[#00236f] transition-all disabled:opacity-50 group text-right"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#eef2fb] flex items-center justify-center group-hover:bg-[#d9e4f8] transition-colors">
                    {demoLoginMutation.isPending && demoLoginMutation.variables?.email === 'admin@distributer1.ly'
                      ? <Loader2 size={18} className="animate-spin text-[#00236f]" />
                      : <Users size={18} className="text-[#00236f]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0b1c30] leading-snug">موزّع</p>
                    <p className="text-xs text-[#8a96a3] mt-0.5">شراء الكروت وسجل المعاملات</p>
                  </div>
                </button>

              </div>
            </div>
          )}

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-[#8a96a3]">أو تسجيل الدخول بكلمة المرور</span>
            </div>
          </div>

          {/* Email / password form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              loginMutation.mutate({ email, password });
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#444651] mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96a3]" size={15} />
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#444651] mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96a3]" size={15} />
                <input
                  id="password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00236f] hover:bg-[#00164e] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  جاري تسجيل الدخول…
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-xs text-[#8a96a3] mt-5">
          © 2026 منصة رافد. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
