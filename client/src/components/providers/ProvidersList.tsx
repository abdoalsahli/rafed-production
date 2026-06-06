import React from 'react';
import { ProviderCard, ProviderStatus } from './ProviderCard';
import { StatusFilter } from './StatusFilter';
import { ProvidersEmptyState } from './ProvidersEmptyState';

interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
  commission: number;
  creditLimit: number;
  description?: string;
}

interface ProvidersListProps {
  providers?: Provider[];
  isLoading?: boolean;
  onViewDetails?: (providerId: string) => void;
  onRequestAccess?: (providerId?: string) => void;
}

export function ProvidersList({
  providers = [],
  isLoading = false,
  onViewDetails,
  onRequestAccess,
}: ProvidersListProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<ProviderStatus | 'all'>('all');

  // Mock providers if none provided
  const defaultProviders: Provider[] = [
    {
      id: 'PRV-001',
      name: 'Telecom A',
      status: 'active',
      commission: 5,
      creditLimit: 50000,
      description: 'Leading telecom provider with nationwide coverage',
    },
    {
      id: 'PRV-002',
      name: 'Electricity Co',
      status: 'active',
      commission: 3,
      creditLimit: 30000,
      description: 'National electricity distribution company',
    },
    {
      id: 'PRV-003',
      name: 'Water Co',
      status: 'pending',
      commission: 2,
      creditLimit: 20000,
      description: 'Municipal water supply provider',
    },
    {
      id: 'PRV-004',
      name: 'Telecom B',
      status: 'active',
      commission: 6,
      creditLimit: 60000,
      description: 'Premium telecom services provider',
    },
    {
      id: 'PRV-005',
      name: 'Internet Provider',
      status: 'rejected',
      commission: 4,
      creditLimit: 25000,
      description: 'High-speed internet services',
    },
  ];

  const displayProviders = providers.length > 0 ? providers : defaultProviders;

  // Filter providers by status
  const filteredProviders =
    selectedStatus === 'all'
      ? displayProviders
      : displayProviders.filter((p) => p.status === selectedStatus);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  if (displayProviders.length === 0) {
    return <ProvidersEmptyState onRequestAccess={onRequestAccess} />;
  }

  return (
    <div>
      {/* Filter */}
      <StatusFilter selectedStatus={selectedStatus} onStatusChange={setSelectedStatus} />

      {/* Results Count */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Showing {filteredProviders.length} of {displayProviders.length} providers
        </p>
      </div>

      {/* Provider Cards */}
      {filteredProviders.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              id={provider.id}
              name={provider.name}
              status={provider.status}
              commission={provider.commission}
              creditLimit={provider.creditLimit}
              description={provider.description}
              onViewDetails={() => onViewDetails?.(provider.id)}
              onRequestAccess={() => onRequestAccess?.(provider.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No providers found with status: {selectedStatus}</p>
          <button
            onClick={() => setSelectedStatus('all')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
