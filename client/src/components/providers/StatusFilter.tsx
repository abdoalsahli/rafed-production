import { ProviderStatus } from './ProviderCard';

interface StatusFilterProps {
  selectedStatus: ProviderStatus | 'all';
  onStatusChange: (status: ProviderStatus | 'all') => void;
}

export function StatusFilter({ selectedStatus, onStatusChange }: StatusFilterProps) {
  const statuses: Array<{ value: ProviderStatus | 'all'; label: string; color: string }> = [
    { value: 'all', label: 'All Providers', color: 'text-gray-700' },
    { value: 'active', label: 'Active', color: 'text-green-700' },
    { value: 'pending', label: 'Pending', color: 'text-yellow-700' },
    { value: 'rejected', label: 'Rejected', color: 'text-red-700' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {statuses.map((status) => (
        <button
          key={status.value}
          onClick={() => onStatusChange(status.value)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            selectedStatus === status.value
              ? 'bg-blue-600 text-white shadow-md'
              : `bg-gray-100 ${status.color} hover:bg-gray-200`
          }`}
        >
          {status.label}
        </button>
      ))}
    </div>
  );
}
