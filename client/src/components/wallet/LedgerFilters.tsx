import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { TransactionType } from './FullLedgerTable';

interface LedgerFiltersProps {
  startDate?: Date;
  endDate?: Date;
  selectedType?: TransactionType | 'all';
  onStartDateChange?: (date: Date) => void;
  onEndDateChange?: (date: Date) => void;
  onTypeChange?: (type: TransactionType | 'all') => void;
  onReset?: () => void;
}

export function LedgerFilters({
  startDate,
  endDate,
  selectedType = 'all',
  onStartDateChange,
  onEndDateChange,
  onTypeChange,
  onReset,
}: LedgerFiltersProps) {
  const types: Array<{ value: TransactionType | 'all'; label: string; color: string }> = [
    { value: 'all', label: 'All Types', color: 'text-gray-700' },
    { value: 'credit', label: 'Credit', color: 'text-green-700' },
    { value: 'debit', label: 'Debit', color: 'text-red-700' },
    { value: 'commission', label: 'Commission', color: 'text-blue-700' },
    { value: 'refund', label: 'Refund', color: 'text-purple-700' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-900">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <input
              type="date"
              value={startDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => onStartDateChange?.(new Date(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <input
              type="date"
              value={endDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => onEndDateChange?.(new Date(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex items-end">
          <button
            onClick={onReset}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Transaction Type Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Transaction Type</label>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type.value}
              onClick={() => onTypeChange?.(type.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedType === type.value
                  ? 'bg-blue-600 text-white shadow-md'
                  : `bg-gray-100 ${type.color} hover:bg-gray-200`
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
