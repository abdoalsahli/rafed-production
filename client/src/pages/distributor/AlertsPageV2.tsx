import React, { useState, useMemo } from 'react';
import { formatDateTime } from '@/lib/dateUtils';
import { Search, AlertCircle, AlertTriangle, Info, Loader2, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ButtonV2 } from '@/components/ui/ButtonV2';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  createdAt: Date | string;
  status?: string;
  referenceId?: string;
}

export const AlertsPageV2: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const { data: alertsData, isLoading: isLoadingAlerts, error: alertsError } = trpc.financial.alerts.useQuery(
    { severity: severityFilter === 'all' ? undefined : severityFilter },
    { enabled: isAuthenticated && !authLoading }
  );

  const isLoading = authLoading || isLoadingAlerts;
  const error = alertsError?.message || null;

  const filteredAlerts = useMemo(() => {
    if (!alertsData) return [];
    return alertsData.filter((alert: Alert) => {
      const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (alert.referenceId && alert.referenceId.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [alertsData, searchTerm]);

  const totalAlerts  = alertsData?.length || 0;
  const criticalCount = alertsData?.filter((a: Alert) => a.severity === 'critical').length || 0;
  const warningCount  = alertsData?.filter((a: Alert) => a.severity === 'warning').length || 0;
  const infoCount     = alertsData?.filter((a: Alert) => a.severity === 'info').length || 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#fff5f5] text-[#b91c1c] border-[#fecaca]';
      case 'warning':  return 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]';
      case 'info':     return 'bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]';
      default:         return 'bg-[#f8f9ff] text-[#444651] border-[#e2e8f0]';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle size={18} strokeWidth={2} />;
      case 'warning':  return <AlertTriangle size={18} strokeWidth={2} />;
      case 'info':     return <Info size={18} strokeWidth={2} />;
      default:         return <Bell size={18} strokeWidth={2} />;
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'حرج';
      case 'warning':  return 'تحذير';
      case 'info':     return 'معلومة';
      default:         return severity;
    }
  };

  const getSeverityFilterLabel = (severity: SeverityFilter) => {
    switch (severity) {
      case 'all':      return 'الكل';
      case 'critical': return 'حرج';
      case 'warning':  return 'تحذير';
      case 'info':     return 'معلومة';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight">التنبيهات</h1>
          <p className="mt-1 text-sm text-[#444651]">مراقبة التنبيهات والإشعارات</p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">خطأ في تحميل التنبيهات: {error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="py-5">
            <div className="text-xs font-medium text-[#444651] mb-1">إجمالي التنبيهات</div>
            {isLoading ? (
              <div className="h-8 bg-[#e2e8f0] rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold text-[#0b1c30] num">{totalAlerts}</div>
                <div className="text-[#444651] text-xs font-medium mt-1">الكل</div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="text-xs font-medium text-[#444651] mb-1">حرجة</div>
            {isLoading ? (
              <div className="h-8 bg-[#e2e8f0] rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold text-[#b91c1c] num">{criticalCount}</div>
                <div className="text-[#b91c1c] text-xs font-bold flex items-center gap-1 mt-1">
                  <AlertCircle size={14} strokeWidth={2} />
                  تتطلب إجراءً
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="text-xs font-medium text-[#444651] mb-1">تحذيرات</div>
            {isLoading ? (
              <div className="h-8 bg-[#e2e8f0] rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold text-[#b45309] num">{warningCount}</div>
                <div className="text-[#b45309] text-xs font-bold flex items-center gap-1 mt-1">
                  <AlertTriangle size={14} strokeWidth={2} />
                  تحتاج انتباهاً
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="text-xs font-medium text-[#444651] mb-1">معلومات</div>
            {isLoading ? (
              <div className="h-8 bg-[#e2e8f0] rounded animate-pulse" />
            ) : (
              <>
                <div className="text-2xl font-bold text-[#1e40af] num">{infoCount}</div>
                <div className="text-[#1e40af] text-xs font-medium mt-1">إعلامية</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search size={18} className="absolute right-3 top-3 text-[#444651]" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="ابحث في التنبيهات بالرسالة أو معرف المرجع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoading}
                  className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] focus:border-[#00236f] focus:outline-none transition-colors text-sm disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(['all', 'critical', 'warning', 'info'] as const).map((severity) => (
                <ButtonV2
                  key={severity}
                  onClick={() => setSeverityFilter(severity)}
                  variant={severityFilter === severity ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={isLoading}
                >
                  {getSeverityFilterLabel(severity)}
                </ButtonV2>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <div>
        <h2 className="text-lg font-bold text-[#0b1c30] mb-4">التنبيهات</h2>
        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="text-[#444651] animate-spin" strokeWidth={1.5} />
            </div>
          </Card>
        ) : filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            {filteredAlerts.map((alert: Alert) => (
              <Card key={alert.id} className={`border-r-4 ${getSeverityColor(alert.severity)}`}>
                <CardContent className="py-4 px-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white bg-opacity-50">
                              {getSeverityLabel(alert.severity)}
                            </span>
                            {alert.status && (
                              <span className="text-xs font-medium text-[#444651]">
                                {alert.status}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-[#0b1c30] mb-1">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-[#444651]">
                            <span className="num">{formatDateTime(alert.createdAt)}</span>
                            {alert.referenceId && (
                              <span className="font-mono text-[#444651]">مرجع: {alert.referenceId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <Bell size={40} className="text-[#e2e8f0] mb-3" strokeWidth={1.5} />
                <p className="text-[#444651] font-medium">لم يتم العثور على تنبيهات</p>
                <p className="text-[#444651] text-sm">جرب تعديل الفلاتر أو البحث</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
};
