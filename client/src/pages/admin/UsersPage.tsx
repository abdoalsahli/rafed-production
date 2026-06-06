import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUsers } from '@/hooks/data/useUsers';
import { useOrganizations } from '@/hooks/data/useOrganizations';
import { UsersTable } from '@/components/admin/UsersTable';
import { ActivateUserModal } from '@/components/admin/ActivateUserModal';
import { SuspendUserModal } from '@/components/admin/SuspendUserModal';
import { AlertCircle, CheckCircle2, Clock, XCircle, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';

export default function UsersPage() {
  const [activeTab,       setActiveTab]       = useState('pending');
  const [isActivateOpen,  setIsActivateOpen]  = useState(false);
  const [isSuspendOpen,   setIsSuspendOpen]   = useState(false);
  const [selectedUserId,  setSelectedUserId]  = useState<number | null>(null);

  const {
    users, isLoading, isActivating, isSuspending,
    handleActivate, handleSuspend, handleAssignRole, filterByStatus,
  } = useUsers();
  const { organizations } = useOrganizations();

  const pendingUsers   = filterByStatus('pending');
  const activeUsers    = filterByStatus('active');
  const suspendedUsers = filterByStatus('suspended');

  const totalUsers     = users?.length       || 0;
  const pendingCount   = pendingUsers?.length || 0;
  const activeCount    = activeUsers?.length  || 0;
  const suspendedCount = suspendedUsers?.length || 0;

  const handleActivateClick  = (userId: number) => { setSelectedUserId(userId); setIsActivateOpen(true);  };
  const handleSuspendClick   = (userId: number) => { setSelectedUserId(userId); setIsSuspendOpen(true);   };
  const handleAssignRoleClick = (userId: number, organizationId: number, role: string) =>
    handleAssignRole({ userId, organizationId, role: role as 'admin' | 'operator' | 'viewer' });

  const handleActivateSubmit = async (organizationId: number) => {
    if (selectedUserId) {
      await handleActivate({ userId: selectedUserId, organizationId });
      setIsActivateOpen(false);
      setSelectedUserId(null);
    }
  };

  const handleSuspendSubmit = async (reason: string) => {
    if (selectedUserId) {
      await handleSuspend({ userId: selectedUserId, reason });
      setIsSuspendOpen(false);
      setSelectedUserId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="إدارة المستخدمين"
        subtitle="إدارة حسابات المستخدمين والتفعيل والصلاحيات"
      />

      {/* ── Summary Stats ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي المستخدمين"
            value={totalUsers}
            icon={<Users size={20} />}
            iconVariant="primary"
          />
          <StatCard
            title="في انتظار التفعيل"
            value={pendingCount}
            icon={<Clock size={20} />}
            iconVariant="amber"
          />
          <StatCard
            title="نشط"
            value={activeCount}
            icon={<CheckCircle2 size={20} />}
            iconVariant="teal"
          />
          <StatCard
            title="موقوف"
            value={suspendedCount}
            icon={<XCircle size={20} />}
            iconVariant="red"
          />
        </div>
      )}

      {/* ── Pending Alert ────────────────────────────────────────────────── */}
      {pendingCount > 0 && (
        <div className="p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg flex items-start gap-3">
          <AlertCircle size={18} className="text-[#b45309] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#78350f] text-sm">إجراء مطلوب</h3>
            <p className="text-sm text-[#92400e] mt-0.5">
              {pendingCount} مستخدم{pendingCount !== 1 ? 'ين' : ''} في انتظار التفعيل. راجع وفعّل في تبويب «معلق».
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-[#e2e8f0] px-6">
            <TabsList className="bg-transparent border-b-0 w-full justify-start h-auto p-0 rounded-none">
              <TabsTrigger
                value="pending"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00236f] data-[state=active]:text-[#00236f] px-4 py-3 font-medium text-[#444651] hover:text-[#0b1c30] gap-2"
              >
                <Clock size={16} />
                معلق {pendingCount > 0 && `(${pendingCount})`}
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00236f] data-[state=active]:text-[#00236f] px-4 py-3 font-medium text-[#444651] hover:text-[#0b1c30] gap-2"
              >
                <CheckCircle2 size={16} />
                نشط {activeCount > 0 && `(${activeCount})`}
              </TabsTrigger>
              <TabsTrigger
                value="suspended"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00236f] data-[state=active]:text-[#00236f] px-4 py-3 font-medium text-[#444651] hover:text-[#0b1c30] gap-2"
              >
                <XCircle size={16} />
                موقوف {suspendedCount > 0 && `(${suspendedCount})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Pending tab */}
          <TabsContent value="pending" className="m-0">
            {!isLoading && pendingCount === 0 ? (
              <div className="py-14 text-center">
                <CheckCircle2 size={36} className="text-[#0f766e] mx-auto mb-3" />
                <p className="font-medium text-[#0b1c30]">لا يوجد مستخدمون معلقون</p>
                <p className="text-sm text-[#444651] mt-1">تم تفعيل جميع المستخدمين.</p>
              </div>
            ) : (
              <UsersTable
                users={pendingUsers}
                isLoading={isLoading}
                status="pending"
                onActivate={handleActivateClick}
                onSuspend={handleSuspendClick}
                onAssignRole={handleAssignRoleClick}
              />
            )}
          </TabsContent>

          {/* Active tab */}
          <TabsContent value="active" className="m-0">
            {!isLoading && activeCount === 0 ? (
              <div className="py-14 text-center">
                <AlertCircle size={36} className="text-[#444651] mx-auto mb-3" />
                <p className="font-medium text-[#0b1c30]">لا يوجد مستخدمون نشطون</p>
                <p className="text-sm text-[#444651] mt-1">فعّل المستخدمين من تبويب «معلق».</p>
              </div>
            ) : (
              <UsersTable
                users={activeUsers}
                isLoading={isLoading}
                status="active"
                onActivate={handleActivateClick}
                onSuspend={handleSuspendClick}
                onAssignRole={handleAssignRoleClick}
              />
            )}
          </TabsContent>

          {/* Suspended tab */}
          <TabsContent value="suspended" className="m-0">
            {!isLoading && suspendedCount === 0 ? (
              <div className="py-14 text-center">
                <CheckCircle2 size={36} className="text-[#0f766e] mx-auto mb-3" />
                <p className="font-medium text-[#0b1c30]">لا يوجد مستخدمون موقوفون</p>
                <p className="text-sm text-[#444651] mt-1">جميع المستخدمون في وضع جيد.</p>
              </div>
            ) : (
              <UsersTable
                users={suspendedUsers}
                isLoading={isLoading}
                status="suspended"
                onActivate={handleActivateClick}
                onSuspend={handleSuspendClick}
                onAssignRole={handleAssignRoleClick}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <ActivateUserModal
        isOpen={isActivateOpen}
        isLoading={isActivating}
        organizations={organizations}
        onSubmit={handleActivateSubmit}
        onClose={() => { setIsActivateOpen(false); setSelectedUserId(null); }}
      />
      <SuspendUserModal
        isOpen={isSuspendOpen}
        isLoading={isSuspending}
        onSubmit={handleSuspendSubmit}
        onClose={() => { setIsSuspendOpen(false); setSelectedUserId(null); }}
      />
    </div>
  );
}
