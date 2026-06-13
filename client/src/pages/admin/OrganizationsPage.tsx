import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useOrganizations, Organization } from '@/hooks/data/useOrganizations';
import { OrganizationsTable } from '@/components/admin/OrganizationsTable';
import { OrganizationForm } from '@/components/admin/OrganizationForm';
import { Plus, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/skeleton';

export default function OrganizationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen,   setIsEditOpen]   = useState(false);
  const [selectedOrg,  setSelectedOrg]  = useState<Organization | null>(null);

  const { organizations, isLoading, isCreating, isUpdating, handleCreate, handleUpdate } =
    useOrganizations();

  const totalOrgs     = organizations?.length || 0;
  const activeOrgs    = organizations?.filter(org => org.status === 'active').length    || 0;
  const suspendedOrgs = organizations?.filter(org => org.status === 'suspended').length || 0;

  const handleSelectOrg = (org: Organization) => {
    setSelectedOrg(org);
    setIsEditOpen(true);
  };

  const handleCreateSubmit = async (data: any) => {
    try {
      await handleCreate(data);
      setIsCreateOpen(false);
    } catch {
      // error already shown via onError toast
    }
  };

  const handleEditSubmit = async (data: any) => {
    try {
      await handleUpdate(data);
      setIsEditOpen(false);
      setSelectedOrg(null);
    } catch {
      // error already shown via onError toast
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="المؤسسات"
        subtitle="إدارة جميع المؤسسات في المنصة"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#00236f] hover:bg-[#00164e] text-white gap-2">
                <Plus size={16} />
                إنشاء مؤسسة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء مؤسسة</DialogTitle>
                <DialogDescription>إضافة مؤسسة جديدة إلى المنصة</DialogDescription>
              </DialogHeader>
              <OrganizationForm
                organization={null}
                isLoading={isCreating}
                onSubmit={handleCreateSubmit}
                onCancel={() => setIsCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {/* ── Summary Stats ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="إجمالي المؤسسات"
            value={totalOrgs}
            icon={<Building2 size={20} />}
            iconVariant="primary"
          />
          <StatCard
            title="النشطة"
            value={activeOrgs}
            icon={<CheckCircle2 size={20} />}
            iconVariant="teal"
          />
          <StatCard
            title="الموقوفة"
            value={suspendedOrgs}
            icon={<XCircle size={20} />}
            iconVariant="red"
          />
        </div>
      )}

      {/* ── Organizations Table ──────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <OrganizationsTable
          organizations={organizations}
          isLoading={isLoading}
          onEdit={handleSelectOrg}
        />
      </div>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المؤسسة</DialogTitle>
            <DialogDescription>تحديث بيانات المؤسسة</DialogDescription>
          </DialogHeader>
          <OrganizationForm
            organization={selectedOrg}
            isLoading={isUpdating}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setIsEditOpen(false);
              setSelectedOrg(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
