import React, { useState } from 'react';
import { Check, X, Edit2, AlertCircle, Lock } from 'lucide-react';

export interface Distributor {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'rejected' | 'suspended';
  commissionPercentage: number;
  creditLine: number;
  usedCredit: number;
  totalSales: number;
}

interface DistributorManagementProps {
  distributors: Distributor[];
  isLoading?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEditCommission?: (id: string, rate: number) => void;
  onEditCredit?: (id: string, limit: number) => void;
  onSuspend?: (id: string) => void;
}

interface EditModalProps {
  isOpen: boolean;
  distributor: Distributor | null;
  type: 'commission' | 'credit';
  onSave: (value: number) => void;
  onCancel: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, distributor, type, onSave, onCancel }) => {
  const [value, setValue] = useState(
    type === 'commission' ? distributor?.commissionPercentage || 0 : distributor?.creditLine || 0
  );

  if (!isOpen || !distributor) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Edit {type === 'commission' ? 'Commission Rate' : 'Credit Line'}
            </h3>
          </div>

          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {type === 'commission' ? 'Commission Rate (%)' : 'Credit Line ($)'}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={type === 'commission' ? 0 : 0}
              step={type === 'commission' ? 0.1 : 100}
            />
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(value)}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const DistributorManagement: React.FC<DistributorManagementProps> = ({
  distributors,
  isLoading = false,
  onApprove,
  onReject,
  onEditCommission,
  onEditCredit,
  onSuspend,
}) => {
  const [editModal, setEditModal] = useState<{ isOpen: boolean; distributor: Distributor | null; type: 'commission' | 'credit' }>({
    isOpen: false,
    distributor: null,
    type: 'commission',
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'suspended':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Distributor Management</h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">Distributor Management</h3>
          <p className="text-sm text-gray-600 mt-1">{distributors.length} distributors</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-6 font-semibold text-gray-700">Name</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-700">Status</th>
                <th className="text-right py-3 px-6 font-semibold text-gray-700">Commission</th>
                <th className="text-right py-3 px-6 font-semibold text-gray-700">Credit Line</th>
                <th className="text-right py-3 px-6 font-semibold text-gray-700">Total Sales</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {distributors.map((distributor) => {
                const creditUtilization = (distributor.usedCredit / distributor.creditLine) * 100;
                const isHighCredit = creditUtilization > 80;

                return (
                  <tr key={distributor.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{distributor.name}</p>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(distributor.status)}`}>
                        {getStatusText(distributor.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <p className="font-semibold text-gray-900">{distributor.commissionPercentage}%</p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex flex-col items-end">
                        <p className={`num font-semibold ${isHighCredit ? 'text-red-600' : 'text-gray-900'}`}>
                          {'د.ل '}{distributor.creditLine.toLocaleString('en-US')}
                        </p>
                        <p className="num text-xs text-gray-500 mt-1">
                          {'د.ل '}{distributor.usedCredit.toLocaleString('en-US')} used ({creditUtilization.toFixed(0)}%)
                        </p>
                        {isHighCredit && (
                          <div className="flex items-center gap-1 text-red-600 mt-1">
                            <AlertCircle size={14} />
                            <span className="text-xs">High usage</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <p className="num font-semibold text-green-600">
                        {'د.ل '}{distributor.totalSales.toLocaleString('en-US')}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        {distributor.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onApprove?.(distributor.id)}
                              className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check size={18} className="text-green-600" />
                            </button>
                            <button
                              onClick={() => onReject?.(distributor.id)}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X size={18} className="text-red-600" />
                            </button>
                          </>
                        )}
                        {distributor.status === 'active' && (
                          <>
                            <button
                              onClick={() =>
                                setEditModal({
                                  isOpen: true,
                                  distributor,
                                  type: 'commission',
                                })
                              }
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Edit Commission"
                            >
                              <Edit2 size={18} className="text-blue-600" />
                            </button>
                            <button
                              onClick={() =>
                                setEditModal({
                                  isOpen: true,
                                  distributor,
                                  type: 'credit',
                                })
                              }
                              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                              title="Adjust Credit Limit"
                            >
                              <AlertCircle size={18} className="text-purple-600" />
                            </button>
                            <button
                              onClick={() => onSuspend?.(distributor.id)}
                              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Suspend Distributor"
                            >
                              <Lock size={18} className="text-gray-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <EditModal
        isOpen={editModal.isOpen}
        distributor={editModal.distributor}
        type={editModal.type}
        onSave={(value) => {
          if (editModal.distributor) {
            if (editModal.type === 'commission') {
              onEditCommission?.(editModal.distributor.id, value);
            } else {
              onEditCredit?.(editModal.distributor.id, value);
            }
          }
          setEditModal({ isOpen: false, distributor: null, type: 'commission' });
        }}
        onCancel={() => setEditModal({ isOpen: false, distributor: null, type: 'commission' })}
      />
    </>
  );
};
