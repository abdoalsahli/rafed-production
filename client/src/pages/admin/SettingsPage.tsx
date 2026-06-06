import React, { useState, useEffect } from 'react';
import { Lock, Bell, User, Save, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';

/* ── Local helpers ──────────────────────────────────────────────────────── */

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
        <div className="text-[#444651]">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-[#0b1c30]">{title}</h2>
          {subtitle && <p className="text-xs text-[#444651] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <CardContent className="py-6 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00236f] focus:ring-offset-1 disabled:opacity-50 ${
        checked ? 'bg-[#00236f]' : 'bg-[#cbd5e1]'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */
interface NotificationPreferences {
  transactionAlerts: boolean;
  weeklyReport: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function AdminSettingsPage() {
  // ── Profile state ───────────────────────────────────────────────────────
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');

  // ── Notifications state ─────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    transactionAlerts: true,
    weeklyReport:      true,
    securityAlerts:    true,
    productUpdates:    false,
  });

  // ── Password modal state ────────────────────────────────────────────────
  const [pwModal,          setPwModal]          = useState(false);
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [showCurrentPw,    setShowCurrentPw]    = useState(false);
  const [showNewPw,        setShowNewPw]        = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: profileData, isLoading: profileLoading } = trpc.admin.getProfile.useQuery();
  const { data: notifPrefs,  isLoading: notifLoading   } = trpc.user.getNotificationPreferences.useQuery();

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateProfileMutation = trpc.admin.updateProfile.useMutation({
    onSuccess: () => toast.success('تم حفظ الملف الشخصي'),
    onError:   (err) => toast.error(err.message || 'فشل حفظ الملف الشخصي'),
  });

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح');
      closePwModal();
    },
    onError: (err) => toast.error(err.message || 'فشل تغيير كلمة المرور'),
  });

  const updateNotifMutation = trpc.user.updateNotificationPreferences.useMutation({
    onSuccess: () => toast.success('تم حفظ إعدادات الإشعارات'),
    onError:   (err) => toast.error(err.message || 'فشل حفظ الإعدادات'),
  });

  // ── Hydrate from queries ─────────────────────────────────────────────────
  useEffect(() => {
    if (profileData) {
      setName(profileData.name  || '');
      setEmail(profileData.email || '');
    }
  }, [profileData]);

  useEffect(() => {
    if (notifPrefs) setNotifications(notifPrefs as NotificationPreferences);
  }, [notifPrefs]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveProfile = () => {
    if (!name.trim())  { toast.error('الاسم مطلوب');             return; }
    if (!email.trim()) { toast.error('البريد الإلكتروني مطلوب'); return; }
    updateProfileMutation.mutate({ name: name.trim(), email: email.trim() });
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('جميع حقول كلمة المرور مطلوبة'); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمتا المرور الجديدتان غير متطابقتين'); return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword, confirmPassword });
  };

  const closePwModal = () => {
    setPwModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
  };

  const handleToggleNotif = (key: keyof NotificationPreferences) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    updateNotifMutation.mutate(updated);
  };

  const isLoading = profileLoading || notifLoading;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00236f] mx-auto mb-4" />
          <p className="text-[#444651]">جاري التحميل…</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-6">

      <PageHeader title="الإعدادات" subtitle="إدارة حسابك وتفضيلاتك" />

      {/* Admin badge */}
      <div className="flex items-center gap-3 p-4 bg-[#eff4ff] border border-[#dce1ff] rounded-lg">
        <ShieldCheck size={20} className="text-[#00236f] flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#0b1c30]">حساب مدير النظام</p>
          <p className="text-xs text-[#444651]">لديك صلاحيات الوصول الكامل وإدارة المنصة.</p>
        </div>
      </div>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <SectionCard icon={<User size={18} />} title="معلومات الملف الشخصي" subtitle="تحديث بيانات حسابك">
        <div>
          <label className="text-xs font-medium text-[#444651] block mb-1.5">الاسم الكامل</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="أدخل اسمك الكامل"
            className="w-full px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-sm text-[#0b1c30] focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#444651] block mb-1.5">البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="أدخل بريدك الإلكتروني"
            className="w-full px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-sm text-[#0b1c30] focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors"
          />
        </div>
        {profileData?.role && (
          <div>
            <label className="text-xs font-medium text-[#444651] block mb-1.5">الدور</label>
            <input
              type="text"
              value={profileData.role}
              readOnly
              className="w-full px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-sm text-[#444651] cursor-not-allowed"
            />
          </div>
        )}
        <div className="pt-2 border-t border-[#e2e8f0]">
          <button
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-medium hover:bg-[#00164e] transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            {updateProfileMutation.isPending ? 'جاري الحفظ…' : 'حفظ الملف الشخصي'}
          </button>
        </div>
      </SectionCard>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <SectionCard icon={<Lock size={18} />} title="الأمان" subtitle="إدارة أمان حسابك">
        <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
          <div>
            <h3 className="font-semibold text-[#0b1c30] text-sm">كلمة المرور</h3>
            <p className="text-xs text-[#444651] mt-0.5">تغيير كلمة المرور الخاصة بك</p>
          </div>
          <button
            onClick={() => setPwModal(true)}
            className="px-4 py-2 rounded-lg bg-[#e2e8f0] text-[#0b1c30] font-medium hover:bg-[#d1d9e6] transition-colors text-sm"
          >
            تغيير
          </button>
        </div>
      </SectionCard>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <SectionCard icon={<Bell size={18} />} title="الإشعارات" subtitle="يتم حفظ التفضيلات فور التبديل">
        {([
          { key: 'transactionAlerts', label: 'تنبيهات العمليات',    desc: 'الإشعار عند حدوث عمليات مالية' },
          { key: 'weeklyReport',      label: 'التقرير الأسبوعي',    desc: 'ملخص أسبوعي لنشاط المنصة' },
          { key: 'securityAlerts',    label: 'تنبيهات الأمان',      desc: 'إشعارات الأمان والتدقيق المهمة' },
          { key: 'productUpdates',    label: 'تحديثات المنتج',      desc: 'أخبار الميزات الجديدة والتحسينات' },
        ] as { key: keyof NotificationPreferences; label: string; desc: string }[]).map((pref) => (
          <div key={pref.key} className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
            <div>
              <h3 className="font-semibold text-[#0b1c30] text-sm">{pref.label}</h3>
              <p className="text-xs text-[#444651] mt-0.5">{pref.desc}</p>
            </div>
            <Toggle
              checked={notifications[pref.key]}
              onChange={() => handleToggleNotif(pref.key)}
              disabled={updateNotifMutation.isPending}
            />
          </div>
        ))}
      </SectionCard>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0b1c30]">تغيير كلمة المرور</h2>
              <button onClick={closePwModal} className="p-1 hover:bg-[#f1f5f9] rounded transition-colors">
                <X size={18} className="text-[#444651]" />
              </button>
            </div>
            <CardContent className="py-6 space-y-4">
              {([
                { label: 'كلمة المرور الحالية',   value: currentPassword,  setter: setCurrentPassword,  show: showCurrentPw, toggleShow: () => setShowCurrentPw(p => !p) },
                { label: 'كلمة المرور الجديدة',    value: newPassword,      setter: setNewPassword,      show: showNewPw,     toggleShow: () => setShowNewPw(p => !p) },
                { label: 'تأكيد كلمة المرور الجديدة', value: confirmPassword, setter: setConfirmPassword, show: showNewPw,     toggleShow: () => setShowNewPw(p => !p) },
              ]).map(({ label, value, setter, show, toggleShow }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-[#444651] block mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={label}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-sm text-[#0b1c30] focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={toggleShow}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651] hover:text-[#0b1c30]"
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closePwModal}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] font-medium hover:bg-[#f8f9ff] transition-colors text-sm"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#00236f] text-white font-medium hover:bg-[#00164e] transition-colors text-sm disabled:opacity-50"
                >
                  {changePasswordMutation.isPending ? 'جاري التحديث…' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
