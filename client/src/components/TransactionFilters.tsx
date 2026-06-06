/**
 * Transaction Filtering Component
 * Provides date range, status, amount range, and provider filters
 */

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Filter } from "lucide-react";
import Decimal from "decimal.js";

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: "all" | "completed" | "pending" | "failed";
  amountMin?: number;
  amountMax?: number;
  providerId?: number;
  searchTerm?: string;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  providers?: Array<{ id: number; name: string }>;
  isLoading?: boolean;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  onFiltersChange,
  providers = [],
  isLoading = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, dateFrom: e.target.value });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, dateTo: e.target.value });
  };

  const handleStatusChange = (status: TransactionFilters["status"]) => {
    onFiltersChange({ ...filters, status });
  };

  const handleAmountMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : undefined;
    onFiltersChange({ ...filters, amountMin: value });
  };

  const handleAmountMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : undefined;
    onFiltersChange({ ...filters, amountMax: value });
  };

  const handleProviderChange = (providerId: number) => {
    onFiltersChange({
      ...filters,
      providerId: filters.providerId === providerId ? undefined : providerId,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, searchTerm: e.target.value });
  };

  const handleReset = () => {
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      status: "all",
      amountMin: undefined,
      amountMax: undefined,
      providerId: undefined,
      searchTerm: undefined,
    });
    setShowAdvanced(false);
  };

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    (filters.status && filters.status !== "all") ||
    filters.amountMin ||
    filters.amountMax ||
    filters.providerId ||
    filters.searchTerm;

  return (
    <Card className="bg-white shadow-lg border-0 mb-6">
      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-4">
          <Input
            placeholder="Search by transaction ID, provider, or reference..."
            value={filters.searchTerm || ""}
            onChange={handleSearchChange}
            disabled={isLoading}
            className="w-full"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={filters.status === "all" || !filters.status ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange("all")}
            disabled={isLoading}
          >
            All
          </Button>
          <Button
            variant={filters.status === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange("completed")}
            disabled={isLoading}
          >
            Completed
          </Button>
          <Button
            variant={filters.status === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange("pending")}
            disabled={isLoading}
          >
            Pending
          </Button>
          <Button
            variant={filters.status === "failed" ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusChange("failed")}
            disabled={isLoading}
          >
            Failed
          </Button>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-4"
          disabled={isLoading}
        >
          <Filter className="w-4 h-4" />
          {showAdvanced ? "Hide" : "Show"} Advanced Filters
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg mb-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  From Date
                </label>
                <Input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={handleDateFromChange}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  To Date
                </label>
                <Input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={handleDateToChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Min Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.amountMin || ""}
                  onChange={handleAmountMinChange}
                  disabled={isLoading}
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Max Amount
                </label>
                <Input
                  type="number"
                  placeholder="10000.00"
                  value={filters.amountMax || ""}
                  onChange={handleAmountMaxChange}
                  disabled={isLoading}
                  step="0.01"
                />
              </div>
            </div>

            {/* Provider Filter */}
            {providers.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Provider
                </label>
                <div className="flex flex-wrap gap-2">
                  {providers.map((provider) => (
                    <Button
                      key={provider.id}
                      variant={
                        filters.providerId === provider.id ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleProviderChange(provider.id)}
                      disabled={isLoading}
                    >
                      {provider.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Filters Display & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-900">
              {hasActiveFilters ? "Filters applied" : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
              className="text-blue-600 hover:text-blue-700"
            >
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TransactionFilters;
