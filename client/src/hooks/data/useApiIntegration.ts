import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

export interface ApiCredentials {
  id: number;
  keyId: string;
  maskedKey: string;
  webhookUrl?: string | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  status: string;
}

/**
 * Hook to manage distributor API integration.
 * Handles API key management and webhook configuration via tRPC.
 */
export function useApiIntegration() {
  const [credentials, setCredentials] = useState<ApiCredentials | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current credentials on mount
  const { data: credentialsData, isLoading: isLoadingCredentials } = trpc.distributorApi.getCredentials.useQuery();

  // Mutations
  const generateKeyMutation = trpc.distributorApi.generateApiKey.useMutation();
  const rotateKeyMutation = trpc.distributorApi.rotateApiKey.useMutation();
  const updateWebhookMutation = trpc.distributorApi.updateWebhookUrl.useMutation();

  // Update credentials when data changes
  useEffect(() => {
    if (credentialsData) {
      setCredentials(credentialsData);
    }
  }, [credentialsData]);

  const generateApiKey = async () => {
    setError(null);
    setSuccessMessage(null);
    setNewSecret(null);

    try {
      const result = await generateKeyMutation.mutateAsync();
      setNewSecret(result.secret);
      setSuccessMessage(result.message);
      setCredentials({
        id: 0, // Will be updated when credentials are refetched
        keyId: result.keyId,
        maskedKey: result.maskedKey,
        webhookUrl: null,
        createdAt: new Date(),
        status: 'active',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key');
    }
  };

  const rotateApiKey = async () => {
    setError(null);
    setSuccessMessage(null);
    setNewSecret(null);

    try {
      const result = await rotateKeyMutation.mutateAsync();
      setNewSecret(result.secret);
      setSuccessMessage(result.message);
      setCredentials({
        id: 0,
        keyId: result.keyId,
        maskedKey: result.maskedKey,
        webhookUrl: credentials?.webhookUrl || null,
        createdAt: credentials?.createdAt || new Date(),
        status: 'active',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to rotate API key');
    }
  };

  const updateWebhookUrl = async (webhookUrl: string | null) => {
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await updateWebhookMutation.mutateAsync({ webhookUrl: webhookUrl || undefined });
      setSuccessMessage(result.message);
      if (credentials) {
        setCredentials({
          ...credentials,
          webhookUrl: result.webhookUrl,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update webhook URL');
    }
  };

  return {
    credentials,
    newSecret,
    successMessage,
    isLoading: isLoadingCredentials || generateKeyMutation.isPending || rotateKeyMutation.isPending || updateWebhookMutation.isPending,
    error,
    generateApiKey,
    rotateApiKey,
    updateWebhookUrl,
  };
}
