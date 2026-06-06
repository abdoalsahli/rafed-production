/**
 * Enterprise Asynchronous Fulfillment Tracking Console
 * 
 * Transforms purchase history into operational fulfillment tracking with:
 * - Async lifecycle visibility (PENDING → PROCESSING → SUCCEEDED/FAILED)
 * - Webhook delivery observability
 * - Retry/replay operations
 * - Operational debugging tools
 * - Support workflows
 * - Reconciliation capabilities
 * 
 * This is NOT a simple sales history page.
 * This is an enterprise async job console (like Stripe events or AWS job console).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { formatDateTime, formatTimeOnly } from '@/lib/dateUtils';
import { useLocation } from 'wouter';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  TrendingUp,
  Filter,
  X,
  ExternalLink,
  Activity,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type LifecycleStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'RETRYING' | 'DELIVERING' | 'DEAD_LETTERED';
type WebhookDeliveryStatus = 'delivered' | 'retry_pending' | 'retrying' | 'failed' | 'dead_lettered' | 'replay_available';

interface FulfillmentRequest {
  id: string;
  requestId: string;
  correlationId: string;
  idempotencyKey: string;
  transactionId: string;
  
  // Lifecycle
  status: LifecycleStatus;
  webhookDeliveryStatus: WebhookDeliveryStatus;
  
  // Financial
  providerId: number;
  providerName: string;
  amount: number;
  currency: string;
  commission: number;
  
  // Timing
  submittedAt: string;
  processingStartedAt?: string;
  completedAt?: string;
  processingDuration?: number; // milliseconds
  webhookDeliveryLatency?: number; // milliseconds
  totalCompletionTime?: number; // milliseconds
  queueWaitDuration?: number; // milliseconds
  
  // Delivery
  webhookEndpoint?: string;
  retryCount: number;
  lastDeliveryAttempt?: string;
  nextRetryTime?: string;
  
  // Metadata
  productName: string;
  quantity: number;
  metadata?: Record<string, any>;
}

interface EventTimelineEntry {
  timestamp: string;
  event: string;
  status: LifecycleStatus;
  details?: string;
}

interface FilterState {
  status?: LifecycleStatus;
  webhookDeliveryStatus?: WebhookDeliveryStatus;
  providerId?: number;
  searchTerm?: string;
  dateFrom?: string;
  dateTo?: string;
  showFailedOnly?: boolean;
  showDelayedOnly?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

// ============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================================

type UserRole = 'admin' | 'operator' | 'viewer';

interface RBACPermissions {
  canView: boolean;
  canReplay: boolean;
  canRefresh: boolean;
  canExport: boolean;
  canViewDiagnostics: boolean;
  canViewDeliveryTrace: boolean;
}

const getRBACPermissions = (userRole?: UserRole): RBACPermissions => {
  switch (userRole) {
    case 'admin':
      return {
        canView: true,
        canReplay: true,
        canRefresh: true,
        canExport: true,
        canViewDiagnostics: true,
        canViewDeliveryTrace: true,
      };
    case 'operator':
      return {
        canView: true,
        canReplay: true,
        canRefresh: true,
        canExport: false,
        canViewDiagnostics: true,
        canViewDeliveryTrace: true,
      };
    case 'viewer':
    default:
      return {
        canView: true,
        canReplay: false,
        canRefresh: false,
        canExport: false,
        canViewDiagnostics: false,
        canViewDeliveryTrace: false,
      };
  }
};

export const FulfillmentTrackingPage: React.FC = () => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [location, navigate] = useLocation();
  
  // Determine user role (placeholder - will be replaced with actual user.role)
  const userRole = (user?.role as UserRole) || 'viewer';
  const permissions = getRBACPermissions(userRole);
  
  // Permission denied view
  if (!permissions.canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ليس لديك صلاحية الوصول إلى تتبع التنفيذ. تواصل مع مسؤول النظام.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Parse URL parameters for deep-linking and state persistence
  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const requestIdFromUrl = queryParams.get('requestId');
  const statusFromUrl = queryParams.get('status');
  const pageFromUrl = queryParams.get('page');
  const searchFromUrl = queryParams.get('search');
  
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(requestIdFromUrl);
  const [filters, setFilters] = useState<FilterState>({
    status: (statusFromUrl as LifecycleStatus) || undefined,
    webhookDeliveryStatus: (queryParams.get('webhookStatus') as WebhookDeliveryStatus) || undefined,
    providerId: queryParams.get('providerId') ? parseInt(queryParams.get('providerId')!) : undefined,
    searchTerm: searchFromUrl || undefined,
    dateFrom: queryParams.get('dateFrom') || undefined,
    dateTo: queryParams.get('dateTo') || undefined,
  });
  const [currentPage, setCurrentPage] = useState(pageFromUrl ? parseInt(pageFromUrl) : 0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  
  const PAGE_SIZE = 15;

  // Fetch fulfillment requests - placeholder until backend is ready
  const { data: requestsData, isLoading: isLoadingRequests, error: requestsError } = { data: null, isLoading: false, error: null } as any;

  // Fetch request details (timeline, events) - placeholder until backend is ready
  const { data: requestDetailsData } = { data: null } as any;

  // Replay webhook mutation - placeholder until backend is ready
  const replayWebhookMutation = {
    mutateAsync: async () => {
      toast.success('بدأت إعادة تشغيل Webhook');
    },
    isPending: false,
  };

  // Refresh status mutation - placeholder until backend is ready
  const refreshStatusMutation = {
    mutateAsync: async () => {
      toast.success('تم تحديث الحالة');
    },
    isPending: false,
  };

  // Export mutation - placeholder until backend is ready
  const exportMutation = {
    mutateAsync: async () => {
      toast.success('بدأ التصدير — تحقق من التنزيلات');
    },
    isPending: false,
  };

  // Get providers list for filter - using existing endpoint
  const { data: providersData } = { data: { providers: [] } } as any;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // ============================================================================
  // OPERATIONAL SEVERITY HIGHLIGHTING
  // ============================================================================
  
  type SeverityLevel = 'critical' | 'warning' | 'delayed' | 'normal';
  
  const getSeverityLevel = (request: FulfillmentRequest): SeverityLevel => {
    // Critical: Dead-lettered requests
    if (request.status === 'DEAD_LETTERED') return 'critical';
    if (request.webhookDeliveryStatus === 'dead_lettered') return 'critical';
    
    // Warning: High retry count (>5 retries)
    if (request.retryCount > 5) return 'warning';
    if (request.webhookDeliveryStatus === 'retrying' && request.retryCount > 3) return 'warning';
    
    // Delayed: Processing for too long (>60 seconds)
    if (request.status === 'PROCESSING' || request.status === 'DELIVERING') {
      const processingTime = Date.now() - new Date(request.submittedAt).getTime();
      if (processingTime > 60000) return 'delayed';
    }
    
    return 'normal';
  };
  
  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical': return 'bg-[#fee2e2] text-[#7f1d1d] border-[#fca5a5]';
      case 'warning':  return 'bg-[#fef3c7] text-[#78350f] border-[#fde68a]';
      case 'delayed':  return 'bg-[#fff7ed] text-[#7c2d12] border-[#fed7aa]';
      case 'normal':   return 'bg-[#f8f9ff] text-[#0b1c30] border-[#e2e8f0]';
    }
  };

  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-[#b91c1c]" />;
      case 'warning':  return <AlertCircle className="w-4 h-4 text-[#b45309]" />;
      case 'delayed':  return <Clock className="w-4 h-4 text-[#c2410c]" />;
      case 'normal':   return <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />;
    }
  };

  const getSeverityLabel = (severity: SeverityLevel) => {
    switch (severity) {
      case 'critical': return 'حرج';
      case 'warning':  return 'تحذير';
      case 'delayed':  return 'متأخر';
      case 'normal':   return 'عادي';
    }
  };

  const getStatusColor = (status: LifecycleStatus) => {
    switch (status) {
      case 'PENDING':      return 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]';
      case 'PROCESSING':   return 'bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]';
      case 'DELIVERING':   return 'bg-[#f3e8ff] text-[#6b21a8] border-[#d8b4fe]';
      case 'SUCCEEDED':    return 'bg-[#dcfce7] text-[#166534] border-[#86efac]';
      case 'RETRYING':     return 'bg-[#fff7ed] text-[#9a3412] border-[#fed7aa]';
      case 'FAILED':       return 'bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]';
      case 'DEAD_LETTERED':return 'bg-[#fecaca] text-[#7f1d1d] border-[#f87171]';
      default:             return 'bg-[#f8f9ff] text-[#444651] border-[#e2e8f0]';
    }
  };

  const getStatusIcon = (status: LifecycleStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'PROCESSING':
        return <Activity className="w-4 h-4 animate-pulse" />;
      case 'DELIVERING':
        return <Zap className="w-4 h-4" />;
      case 'SUCCEEDED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'RETRYING':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'FAILED':
        return <AlertCircle className="w-4 h-4" />;
      case 'DEAD_LETTERED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getDeliveryStatusBadge = (status: WebhookDeliveryStatus) => {
    switch (status) {
      case 'delivered':
        return <span className="inline-block px-2 py-1 text-xs bg-[#dcfce7] text-[#166534] rounded">✓ تم التسليم</span>;
      case 'retry_pending':
        return <span className="inline-block px-2 py-1 text-xs bg-[#fef3c7] text-[#92400e] rounded">⟳ في انتظار إعادة المحاولة</span>;
      case 'retrying':
        return <span className="inline-block px-2 py-1 text-xs bg-[#fff7ed] text-[#9a3412] rounded">↻ جاري إعادة المحاولة</span>;
      case 'failed':
        return <span className="inline-block px-2 py-1 text-xs bg-[#fee2e2] text-[#991b1b] rounded">✗ فاشل</span>;
      case 'dead_lettered':
        return <span className="inline-block px-2 py-1 text-xs bg-[#fecaca] text-[#7f1d1d] rounded">✗ في قائمة الرسائل الميتة</span>;
      case 'replay_available':
        return <span className="inline-block px-2 py-1 text-xs bg-[#dbeafe] text-[#1e40af] rounded">↻ إعادة التشغيل متاحة</span>;
      default:
        return null;
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('تم النسخ إلى الحافظة');
  };
  
  const handleClearFilters = () => {
    setFilters({});
    setCurrentPage(0);
  };
  
  // Update URL when filters, page, or expanded request changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 0) params.set('page', currentPage.toString());
    if (filters.status) params.set('status', filters.status);
    if (filters.webhookDeliveryStatus) params.set('webhookStatus', filters.webhookDeliveryStatus);
    if (filters.providerId) params.set('providerId', filters.providerId.toString());
    if (filters.searchTerm) params.set('search', filters.searchTerm);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (expandedRequestId) params.set('requestId', expandedRequestId);
    
    const newUrl = params.toString() ? `/distributor/fulfillment?${params.toString()}` : '/distributor/fulfillment';
    if (location !== newUrl) {
      navigate(newUrl);
    }
  }, [currentPage, filters, expandedRequestId, navigate, location]);

  const handleReplayWebhook = async (requestId: string) => {
    if (!permissions.canReplay) {
      setShowPermissionAlert(true);
      toast.error('ليس لديك صلاحية إعادة تشغيل Webhook');
      return;
    }
    try {
      // Deep-link to this request for support
      navigate(`/distributor/fulfillment?requestId=${requestId}`);
      setExpandedRequestId(requestId);
      await replayWebhookMutation.mutateAsync();
    } catch (err) {
      console.error('Replay failed:', err);
    }
  };

  const handleRefreshStatus = async (requestId: string) => {
    if (!permissions.canRefresh) {
      setShowPermissionAlert(true);
      toast.error('ليس لديك صلاحية تحديث الحالة');
      return;
    }
    try {
      await refreshStatusMutation.mutateAsync();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  const handleExport = async () => {
    if (!permissions.canExport) {
      setShowPermissionAlert(true);
      toast.error('ليس لديك صلاحية تصدير سجلات التنفيذ');
      return;
    }
    try {
      await exportMutation.mutateAsync();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (authLoading || isLoadingRequests) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#444651]">جاري تحميل طلبات التنفيذ…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight">تتبع التنفيذ</h1>
          <p className="mt-1 text-sm text-[#444651] leading-relaxed">
            مراقبة تنفيذ المشتريات وتسليم الـ Webhook والحالة التشغيلية
          </p>
        </div>
      </div>

      {/* Error State */}
      {requestsError && (
        <Alert className="border-[#fecaca] bg-[#fff5f5]">
          <AlertCircle className="h-4 w-4 text-[#b91c1c]" />
          <AlertDescription className="text-[#991b1b]">
            فشل تحميل طلبات التنفيذ: {requestsError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      {requestsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-[#444651]">إجمالي الطلبات</div>
              <div className="text-2xl font-bold text-[#0b1c30] num">{requestsData.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-[#444651]">ناجحة</div>
              <div className="text-2xl font-bold text-[#0f766e] num">{requestsData.succeeded}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-[#444651]">قيد المعالجة</div>
              <div className="text-2xl font-bold text-[#1e40af] num">{requestsData.processing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-sm text-[#444651]">فاشلة</div>
              <div className="text-2xl font-bold text-[#b91c1c] num">{requestsData.failed}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444651]" />
              <input
                type="text"
                placeholder="ابحث بمعرف الطلب أو معرف الارتباط أو معرف المعاملة..."
                value={filters.searchTerm || ''}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full pr-10 pl-4 py-2 border border-[#e2e8f0] rounded-lg focus:border-[#00236f] focus:outline-none bg-[#f8f9ff]"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              فلاتر
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!permissions.canExport}
              title={!permissions.canExport ? 'ليس لديك صلاحية تصدير سجلات التنفيذ' : ''}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              تصدير
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[#e2e8f0] grid grid-cols-2 md:grid-cols-3 gap-4" dir="rtl">
              <div>
                <label className="text-xs font-medium text-[#444651] block mb-1">الحالة</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: (e.target.value as LifecycleStatus) || undefined })}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#00236f] focus:outline-none bg-[#f8f9ff]"
                >
                  <option value="">جميع الحالات</option>
                  <option value="PENDING">قيد الانتظار</option>
                  <option value="PROCESSING">قيد المعالجة</option>
                  <option value="DELIVERING">جاري التسليم</option>
                  <option value="SUCCEEDED">ناجح</option>
                  <option value="RETRYING">إعادة المحاولة</option>
                  <option value="FAILED">فاشل</option>
                  <option value="DEAD_LETTERED">رسائل ميتة</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#444651] block mb-1">حالة التسليم</label>
                <select
                  value={filters.webhookDeliveryStatus || ''}
                  onChange={(e) => setFilters({ ...filters, webhookDeliveryStatus: (e.target.value as WebhookDeliveryStatus) || undefined })}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#00236f] focus:outline-none bg-[#f8f9ff]"
                >
                  <option value="">جميع حالات التسليم</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="retry_pending">في انتظار إعادة المحاولة</option>
                  <option value="retrying">جاري إعادة المحاولة</option>
                  <option value="failed">فاشل</option>
                  <option value="dead_lettered">رسائل ميتة</option>
                  <option value="replay_available">إعادة التشغيل متاحة</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#444651] block mb-1">المزود</label>
                <select
                  value={filters.providerId || ''}
                  onChange={(e) => setFilters({ ...filters, providerId: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#00236f] focus:outline-none bg-[#f8f9ff]"
                >
                  <option value="">جميع المزودين</option>
                  {providersData?.providers?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#444651] block mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#00236f] focus:outline-none bg-[#f8f9ff]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#444651] block mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:border-[#00236f] focus:outline-none bg-[#f8f9ff]"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({})}
                  className="w-full"
                >
                  مسح الفلاتر
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="py-0">
          {requestsData?.requests && requestsData.requests.length > 0 ? (
            <div className="space-y-0 divide-y divide-slate-200">
              {requestsData.requests.map((request: FulfillmentRequest) => (
                <div key={request.id} className="border-b border-slate-200 last:border-b-0">
                  {/* Request Row */}
                  <div
                    className={`p-4 cursor-pointer transition-colors ${
                      getSeverityLevel(request) !== 'normal'
                        ? 'bg-[#fff5f5] hover:bg-[#fee2e2]'
                        : 'hover:bg-[#f8f9ff]'
                    }`}
                    onClick={() => setExpandedRequestId(expandedRequestId === request.id ? null : request.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(request.status)}
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                          {getDeliveryStatusBadge(request.webhookDeliveryStatus)}
                          {getSeverityLevel(request) !== 'normal' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${getSeverityColor(getSeverityLevel(request))}`}>
                              {getSeverityIcon(getSeverityLevel(request))}
                              {getSeverityLabel(getSeverityLevel(request))}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-[#444651]">معرف الطلب</div>
                            <div className="font-mono text-xs text-[#0b1c30] truncate">{request.requestId}</div>
                          </div>
                          <div>
                            <div className="text-xs text-[#444651]">المزود</div>
                            <div className="font-medium text-[#0b1c30]">{request.providerName}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">المبلغ</div>
                            <div className="font-medium text-slate-900 num">{request.amount} {request.currency}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">تاريخ الإرسال</div>
                            <div className="text-slate-900 text-xs">{formatDateTime(request.submittedAt)}</div>
                          </div>
                        </div>

                        {/* Processing Metrics */}
                        {request.processingDuration && (
                          <div className="mt-2 flex gap-4 text-xs text-slate-600">
                            {request.queueWaitDuration && (
                              <span>Queue: {Math.round(request.queueWaitDuration / 1000)}s</span>
                            )}
                            {request.processingDuration && (
                              <span>Processing: {Math.round(request.processingDuration / 1000)}s</span>
                            )}
                            {request.webhookDeliveryLatency && (
                              <span>Delivery: {Math.round(request.webhookDeliveryLatency / 1000)}s</span>
                            )}
                            {request.totalCompletionTime && (
                              <span className="font-medium">Total: {Math.round(request.totalCompletionTime / 1000)}s</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {expandedRequestId === request.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedRequestId === request.id && (
                    <div className="bg-[#f8f9ff] p-4 border-t border-[#e2e8f0] space-y-4" dir="rtl">
                      {/* Operational Identifiers */}
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div className="font-semibold text-sm text-[#0b1c30]">المعرفات التشغيلية</div>
                        {[
                          { label: 'معرف الطلب', value: request.requestId },
                          { label: 'معرف الارتباط', value: request.correlationId },
                          { label: 'مفتاح الاتساق', value: request.idempotencyKey },
                          { label: 'معرف المعاملة', value: request.transactionId },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between p-2 bg-[#f8f9ff] rounded">
                            <div>
                              <div className="text-xs text-[#444651]">{item.label}</div>
                              <div className="font-mono text-xs text-[#0b1c30] break-all">{item.value}</div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(item.value, item.label)}
                              className="mr-2 p-1 hover:bg-[#e2e8f0] rounded transition-colors"
                              title="نسخ"
                            >
                              {copiedId === item.label ? (
                                <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
                              ) : (
                                <Copy className="w-4 h-4 text-[#444651]" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Event Timeline */}
                      {requestDetailsData?.timeline && (
                        <div className="bg-white rounded-lg p-4 space-y-3">
                          <div className="font-semibold text-sm text-[#0b1c30]">الجدول الزمني للأحداث</div>
                          <div className="space-y-2">
                            {requestDetailsData.timeline.map((event: EventTimelineEntry, idx: number) => (
                              <div key={idx} className="flex gap-3 text-sm">
                                <div className="text-xs text-[#444651] min-w-fit num">
                                  {formatTimeOnly(event.timestamp)}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-[#0b1c30]">{event.event}</div>
                                  {event.details && (
                                    <div className="text-xs text-[#444651]">{event.details}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Webhook Delivery Details */}
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div className="font-semibold text-sm text-[#0b1c30]">تسليم Webhook</div>
                        <div className="space-y-2 text-sm">
                          {request.webhookEndpoint && (
                            <div className="flex justify-between">
                              <span className="text-[#444651]">نقطة النهاية:</span>
                              <span className="font-mono text-xs text-[#0b1c30]">{request.webhookEndpoint}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[#444651]">الحالة:</span>
                            <span>{getDeliveryStatusBadge(request.webhookDeliveryStatus)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#444651]">عدد إعادة المحاولات:</span>
                            <span className="font-medium text-[#0b1c30] num">{request.retryCount}</span>
                          </div>
                          {request.lastDeliveryAttempt && (
                            <div className="flex justify-between">
                              <span className="text-[#444651]">آخر محاولة:</span>
                              <span className="text-xs text-[#0b1c30] num">{formatDateTime(request.lastDeliveryAttempt)}</span>
                            </div>
                          )}
                          {request.nextRetryTime && (
                            <div className="flex justify-between">
                              <span className="text-[#444651]">المحاولة التالية:</span>
                              <span className="text-xs text-[#0b1c30] num">{formatDateTime(request.nextRetryTime)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {['failed', 'dead_lettered', 'replay_available'].includes(request.webhookDeliveryStatus) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReplayWebhook(request.requestId)}
                            disabled={replayWebhookMutation.isPending}
                            className="gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            إعادة تشغيل Webhook
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshStatus(request.requestId)}
                          disabled={refreshStatusMutation.isPending}
                          className="gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          تحديث الحالة
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center" dir="rtl">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 bg-[#f8f9ff] rounded-full border border-[#e2e8f0]">
                    <Zap className="w-8 h-8 text-[#444651]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#0b1c30] mb-2">لا توجد طلبات تنفيذ بعد</h3>
                  <p className="text-[#444651]">تتبع هذه اللوحة عمليات شراء البطاقات غير المتزامنة وتسليم Webhook.</p>
                </div>
                <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4 text-right space-y-3">
                  <div className="font-semibold text-[#1e3a8a] text-sm">كيف يعمل تتبع التنفيذ:</div>
                  <div className="space-y-2 text-sm text-[#1e40af]">
                    <div className="flex gap-3"><div className="text-[#2563eb] font-bold min-w-fit">١.</div><div><strong>دورة حياة غير متزامنة:</strong> تنتقل المشتريات عبر انتظار → معالجة → تسليم → نجاح</div></div>
                    <div className="flex gap-3"><div className="text-[#2563eb] font-bold min-w-fit">٢.</div><div><strong>Webhook أولاً:</strong> نُسلّم النتائج عبر Webhook إلى نقطة النهاية المُهيأة لديك.</div></div>
                    <div className="flex gap-3"><div className="text-[#2563eb] font-bold min-w-fit">٣.</div><div><strong>معرفات تشغيلية:</strong> كل طلب له معرف طلب، ومعرف ارتباط، ومفتاح اتساق.</div></div>
                    <div className="flex gap-3"><div className="text-[#2563eb] font-bold min-w-fit">٤.</div><div><strong>رؤية التسليم:</strong> تتبع حالة Webhook وعدد المحاولات وإعادة تشغيل عمليات التسليم الفاشلة.</div></div>
                  </div>
                </div>
                <div className="bg-[#fef3c7] border border-[#fde68a] rounded-lg p-4 text-right space-y-2">
                  <div className="font-semibold text-[#92400e] text-sm">استكشاف الأخطاء:</div>
                  <ul className="text-sm text-[#b45309] space-y-1 list-disc list-inside">
                    <li>تحقق من إعدادات Webhook في الإعدادات</li>
                    <li>تأكد من أن نقطة نهاية Webhook تستجيب بـ 200 OK</li>
                    <li>استخدم إعادة تشغيل Webhook للتسليمات الفاشلة</li>
                    <li>راجع الجدول الزمني للأحداث للتشخيص التفصيلي</li>
                  </ul>
                </div>
                <div className="text-sm text-[#444651]">
                  ستظهر الطلبات هنا بعد بدء عمليات الشراء. جرب تعديل الفلاتر أو مسحها لعرض جميع الطلبات.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {requestsData && requestsData.total > PAGE_SIZE && (
        <div className="flex justify-between items-center" dir="rtl">
          <div className="text-sm text-[#444651] num">
            عرض {currentPage * PAGE_SIZE + 1} إلى {Math.min((currentPage + 1) * PAGE_SIZE, requestsData.total)} من {requestsData.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={(currentPage + 1) * PAGE_SIZE >= requestsData.total}
            >
              التالي
            </Button>
          </div>
        </div>
      )}

      {/* Support Info */}
      <Alert className="border-[#bfdbfe] bg-[#eff6ff]">
        <Activity className="h-4 w-4 text-[#2563eb]" />
        <AlertDescription className="text-[#1e40af]">
          <div className="font-semibold text-sm mb-1">التصحيح التشغيلي</div>
          <div className="text-sm">
            استخدم هذه اللوحة لتتبع دورة حياة التنفيذ، وتشخيص مشكلات تسليم Webhook، وإعادة تشغيل عمليات التسليم الفاشلة، والتحقيق في التناقضات. جميع المعرفات التشغيلية قابلة للنسخ لدعم الإحالة.
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default FulfillmentTrackingPage;
