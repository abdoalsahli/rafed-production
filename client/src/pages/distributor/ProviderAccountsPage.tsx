import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePaginationFooter } from '@/components/ui/TablePagination';
import { DollarSign, CreditCard, TrendingUp, AlertCircle, Wallet } from 'lucide-react';

const PAGE_SIZE = 10;

export const ProviderAccountsPage: React.FC = () => {
  const { data: accountsData, isLoading, error } = trpc.financial.accountBalance.useQuery();
  const [page, setPage] = useState(1);

  const accounts   = accountsData?.accounts || [];
  const summary    = accountsData?.summary;
  const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const pageAccounts = accounts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── loading ──────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <div className="h-8 w-52 bg-[#e5eeff] animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    );
  }

  /* ── error ────────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-start gap-3">
          <AlertCircle size={18} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#b91c1c]">
              فشل تحميل حسابات المزودين
            </p>
            <p className="text-xs text-[#b91c1c] mt-0.5">
              يرجى المحاولة مجدداً.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="حسابات المزودين"
        subtitle="إدارة حساباتك المالية مع كل مزود"
      />

      {/* ── Summary KPIs ────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="إجمالي الرصيد"
            value={summary.totalBalance.toFixed(2)}
            unit="د.ل"
            icon={<DollarSign size={20} />}
            iconVariant="primary"
          />
          <StatCard
            title="الائتمان المستخدم"
            value={summary.totalUsedCredit.toFixed(2)}
            unit="د.ل"
            icon={<CreditCard size={20} />}
            iconVariant="amber"
          />
          <StatCard
            title="المتاح للإنفاق"
            value={summary.totalAvailableToSpend.toFixed(2)}
            unit="د.ل"
            icon={<TrendingUp size={20} />}
            iconVariant="teal"
          />
        </div>
      )}

      {/* ── Accounts table ──────────────────────────────────────────────── */}
      {accounts.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg">
          <EmptyState
            icon={<Wallet size={28} />}
            iconVariant="primary"
            title="لا توجد حسابات مزودين"
            description="قم بالاتصال بمزود للبدء في الشراء."
          />
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e8f0]">
            <h2 className="text-sm font-semibold text-[#0b1c30]">حسابات المزودين</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8f9ff]">
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">المزود</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">الرصيد</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">حد الائتمان</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">الائتمان المستخدم</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#444651]">المتاح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]/60">
                {pageAccounts.map((account) => (
                  <tr
                    key={account.providerId}
                    className="hover:bg-[#eff4ff] transition-colors duration-100"
                  >
                    <td className="px-6 py-3">
                      <span className="font-medium text-[#0b1c30]">
                        {account.providerName}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className="num font-semibold text-[#0b1c30]">{account.balance.toFixed(2)}</span>
                        <span className="text-xs text-[#444651]">د.ل</span>
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className="num text-[#444651]">{account.creditLine.toFixed(2)}</span>
                        <span className="text-xs text-[#444651]">د.ل</span>
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className={["num font-medium", account.usedCredit > 0 ? 'text-[#b45309]' : 'text-[#444651]'].join(' ')}>
                          {account.usedCredit.toFixed(2)}
                        </span>
                        <span className="text-xs text-[#444651]">د.ل</span>
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className={["num font-semibold", account.availableToSpend < 1000 ? 'text-[#b91c1c]' : 'text-[#0f766e]'].join(' ')}>
                          {account.availableToSpend.toFixed(2)}
                        </span>
                        <span className="text-xs text-[#444651]">د.ل</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePaginationFooter
            page={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalRows={accounts.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      )}

      {/* ── Per-account detail cards ─────────────────────────────────────── */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#0b1c30]">تفاصيل الحسابات</h2>
          {accounts.map((account) => (
            <div
              key={account.providerId}
              className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden"
            >
              {/* card header */}
              <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0b1c30]">{account.providerName}</h3>
                <span className="text-xs font-semibold bg-[#ccfbf1] text-[#0f766e] rounded-full px-2 py-0.5">
                  نشط
                </span>
              </div>

              {/* card body */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {[
                    { label: 'الرصيد',              value: account.balance,            color: '' },
                    { label: 'حد الائتمان',         value: account.creditLine,         color: '' },
                    { label: 'الائتمان المستخدم',  value: account.usedCredit,          color: account.usedCredit > 0 ? 'text-[#b45309]' : '' },
                    { label: 'الائتمان المتاح',     value: account.creditLine - account.usedCredit, color: '' },
                    { label: 'المتاح للإنفاق',      value: account.availableToSpend,   color: account.availableToSpend < 1000 ? 'text-[#b91c1c]' : 'text-[#0f766e]' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-xs text-[#444651] font-medium mb-1">{label}</p>
                      <span className="inline-flex items-center gap-1">
                        <span className={["num text-base font-semibold text-[#0b1c30]", color].join(' ')}>
                          {value.toFixed(2)}
                        </span>
                        <span className="text-sm text-[#444651]">د.ل</span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Calculation note */}
                <div className="bg-[#f8f9ff] rounded-lg p-3 text-xs text-[#444651]">
                  <span className="font-medium text-[#0b1c30]">احتساب المتاح: </span>
                  الرصيد + (حد الائتمان - الائتمان المستخدم) ={' '}
                  <span className="num">
                    {account.balance.toFixed(2)} + ({account.creditLine.toFixed(2)} - {account.usedCredit.toFixed(2)}) ={' '}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="num font-semibold text-[#0b1c30]">{account.availableToSpend.toFixed(2)}</span>
                    <span>د.ل</span>
                  </span>
                </div>

                {/* Low balance warning */}
                {account.availableToSpend < 1000 && (
                  <div className="flex items-start gap-2 p-3 bg-[#fef3c7] border border-[#fcd34d] rounded-lg">
                    <AlertCircle size={15} className="text-[#b45309] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#92400e]">
                      <p className="font-semibold">رصيد منخفض</p>
                      <p className="mt-0.5">يُنصح بتعبئة الرصيد للحفاظ على القدرة الشرائية.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderAccountsPage;
