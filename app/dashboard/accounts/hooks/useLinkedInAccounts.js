"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { linkedinAccountKeys } from "./queryKeys";
import { linkedinAccountApi } from "./api";

/**
 * Custom hook for managing LinkedIn accounts using React Query
 * Handles fetching, connecting, toggling, and deleting accounts with automatic caching
 */
export function useLinkedInAccounts() {
  const queryClient = useQueryClient();

  // Fetch LinkedIn accounts with React Query
  const {
    data: accounts = [],
    isLoading: loading,
    error,
    refetch: fetchAccounts,
  } = useQuery({
    queryKey: linkedinAccountKeys.lists(),
    queryFn: linkedinAccountApi.fetchAccounts,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  // Connect account mutation
  const connectAccountMutation = useMutation({
    mutationFn: linkedinAccountApi.connectAccount,
    onSuccess: () => {
      // Invalidate and refetch accounts list
      queryClient.invalidateQueries({ queryKey: linkedinAccountKeys.lists() });
    },
    onError: (error) => {
      console.error("Failed to connect LinkedIn account:", error);
    },
  });

  // Toggle account status mutation with optimistic updates
  const toggleAccountStatusMutation = useMutation({
    mutationFn: linkedinAccountApi.toggleAccountStatus,
    onMutate: async ({ accountId, isActive }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: linkedinAccountKeys.lists() });
      
      // Snapshot previous value
      const previousAccounts = queryClient.getQueryData(linkedinAccountKeys.lists());
      
      // Optimistically update
      queryClient.setQueryData(linkedinAccountKeys.lists(), (oldAccounts = []) =>
        oldAccounts.map(account => ({
          ...account,
          isActive: account.id === accountId ? isActive : false
        }))
      );
      
      return { previousAccounts };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousAccounts) {
        queryClient.setQueryData(linkedinAccountKeys.lists(), context.previousAccounts);
      }
      console.error("Failed to toggle account status:", error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: linkedinAccountKeys.lists() });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: linkedinAccountApi.deleteAccount,
    onSuccess: (_, accountId) => {
      // Remove from cache
      queryClient.setQueryData(linkedinAccountKeys.lists(), (oldAccounts = []) =>
        oldAccounts.filter(account => account.id !== accountId)
      );
    },
    onError: (error) => {
      console.error("Failed to delete account:", error);
    },
  });

  // Update account settings mutation
  const updateAccountSettingsMutation = useMutation({
    mutationFn: linkedinAccountApi.updateAccountSettings,
    onSuccess: (updatedAccount) => {
      // Update the cache
      queryClient.setQueryData(linkedinAccountKeys.lists(), (oldAccounts = []) =>
        oldAccounts.map(account => 
          account.id === updatedAccount.id ? { ...account, ...updatedAccount } : account
        )
      );
    },
    onError: (error) => {
      console.error("Failed to update account settings:", error);
    },
  });

  // Connect account function
  const connectAccount = async () => {
    return connectAccountMutation.mutateAsync();
  };

  // Toggle account status function
  const toggleAccountStatus = async (accountId, isActive) => {
    return toggleAccountStatusMutation.mutateAsync({ accountId, isActive });
  };

  // Delete account function
  const deleteAccount = async (accountId) => {
    return deleteAccountMutation.mutateAsync(accountId);
  };

  // Update account settings function
  const updateAccountSettings = async (accountId, settings) => {
    return updateAccountSettingsMutation.mutateAsync({ accountId, settings });
  };

  // Refresh accounts
  const refreshAccounts = () => {
    fetchAccounts();
  };

  // For backward compatibility, provide setAccounts and setError
  const setAccounts = (updater) => {
    const currentAccounts = queryClient.getQueryData(linkedinAccountKeys.lists()) || [];
    const newAccounts = typeof updater === 'function' ? updater(currentAccounts) : updater;
    queryClient.setQueryData(linkedinAccountKeys.lists(), newAccounts);
  };

  const setError = () => {
    // React Query handles errors automatically, this is just for compatibility
    console.warn("setError is deprecated when using React Query");
  };

  return {
    accounts,
    setAccounts,
    loading,
    error: error?.message || null,
    setError,
    fetchAccounts,
    connectAccount,
    toggleAccountStatus,
    deleteAccount,
    updateAccountSettings,
    refreshAccounts,
    // Additional React Query specific properties
    isConnecting: connectAccountMutation.isPending,
    isToggling: toggleAccountStatusMutation.isPending,
    isDeleting: deleteAccountMutation.isPending,
    isUpdating: updateAccountSettingsMutation.isPending,
  };
}
