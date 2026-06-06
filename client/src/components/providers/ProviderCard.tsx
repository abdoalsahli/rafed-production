import { CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';

export type ProviderStatus = 'active' | 'pending' | 'rejected';

interface ProviderCardProps {
  id: string;
  name: string;
  status: ProviderStatus;
  commission: number;
  creditLimit: number;
  description?: string;
  onViewDetails?: () => void;
  onRequestAccess?: () => void;
}

export function ProviderCard({
  id,
  name,
  status,
  commission,
  creditLimit,
  description,
  onViewDetails,
  onRequestAccess,
}: ProviderCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const getActionButtonColor = () => {
    switch (status) {
      case 'active':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'pending':
        return 'bg-gray-300 text-gray-600 cursor-not-allowed';
      case 'rejected':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        <div className="flex-shrink-0">{getStatusIcon()}</div>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()}`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 mb-6 py-4 border-y border-gray-200">
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wider mb-1">
            Commission
          </p>
          <p className="text-2xl font-bold text-gray-900">{commission}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wider mb-1">
            Credit Limit
          </p>
          <p className="num text-2xl font-bold text-gray-900">{'د.ل '}{creditLimit.toLocaleString('en-US')}</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={status === 'active' ? onViewDetails : onRequestAccess}
        disabled={status === 'pending'}
        className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${getActionButtonColor()}`}
      >
        {status === 'active' && (
          <>
            View Details
            <ChevronRight className="w-4 h-4" />
          </>
        )}
        {status === 'pending' && 'Pending Approval'}
        {status === 'rejected' && 'Request Access Again'}
      </button>

      {/* Footer Info */}
      <p className="text-xs text-gray-500 mt-3 text-center">Provider ID: {id}</p>
    </div>
  );
}
