import { Inbox, Plus } from 'lucide-react';

interface ProvidersEmptyStateProps {
  onRequestAccess?: () => void;
}

export function ProvidersEmptyState({ onRequestAccess }: ProvidersEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-gray-100 rounded-full p-4 mb-4">
        <Inbox className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Providers Yet</h3>
      <p className="text-gray-600 text-center mb-6 max-w-sm">
        You haven't connected with any providers yet. Start by requesting access to providers in our marketplace.
      </p>
      <button
        onClick={onRequestAccess}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Request Provider Access
      </button>
    </div>
  );
}
