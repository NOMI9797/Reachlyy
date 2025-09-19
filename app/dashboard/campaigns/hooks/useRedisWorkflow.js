"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

/**
 * Custom hook for Redis Workflow message generation
 * Handles the new Redis-based bulk message generation system
 */
export function useRedisWorkflow() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({
    pending: 0,
    completed: 0,
    error: 0,
    total: 0,
    messagesGenerated: 0,
    queueLength: 0
  });

  // Get completed leads ready for message generation
  const getLeadsReadyForMessages = useCallback(async (campaignId) => {
    try {
      const response = await fetch(`/api/redis-workflow/campaigns/${campaignId}/pending-leads`);
      if (!response.ok) {
        throw new Error('Failed to fetch leads ready for message generation');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching leads ready for message generation:', error);
      throw error;
    }
  }, []);

  // Get generation status for a campaign
  const getGenerationStatus = useCallback(async (campaignId) => {
    try {
      const response = await fetch(`/api/redis-workflow/campaigns/${campaignId}/generation-status`);
      if (!response.ok) {
        throw new Error('Failed to fetch generation status');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching generation status:', error);
      throw error;
    }
  }, []);

  // Queue leads for message generation
  const queueLeadsMutation = useMutation({
    mutationFn: async ({ campaignId, model, customPrompt }) => {
      setIsProcessing(true);
      
      try {
        const response = await fetch(`/api/redis-workflow/campaigns/${campaignId}/queue-leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'llama-3.1-8b-instant',
            customPrompt: customPrompt || ''
          })
        });

        if (!response.ok) {
          throw new Error('Failed to queue leads');
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error queuing leads:', error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: (data) => {
      toast.success(`Successfully queued ${data.data.leadsQueued} leads for processing`);
      // Refresh status after queuing
      queryClient.invalidateQueries({ queryKey: ['redis-workflow-status'] });
    },
    onError: (error) => {
      toast.error(`Failed to queue leads: ${error.message}`);
    }
  });

  // Trigger worker to process messages
  const processMessagesMutation = useMutation({
    mutationFn: async ({ batchSize = 5, consumerName = 'web-worker' }) => {
      try {
        const response = await fetch('/api/redis-workflow/workers/message-generator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batchSize,
            consumerName
          })
        });

        if (!response.ok) {
          throw new Error('Failed to process messages');
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error processing messages:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data.data.processed > 0) {
        toast.success(`Processed ${data.data.processed} messages successfully`);
      }
      // Refresh status after processing
      queryClient.invalidateQueries({ queryKey: ['redis-workflow-status'] });
    },
    onError: (error) => {
      toast.error(`Failed to process messages: ${error.message}`);
    }
  });

  // React Query hooks
  const useLeadsReadyForMessages = (campaignId) => {
    return useQuery({
      queryKey: ['redis-workflow-leads-ready', campaignId],
      queryFn: () => getLeadsReadyForMessages(campaignId),
      enabled: !!campaignId,
      refetchInterval: 5000, // Refetch every 5 seconds
    });
  };

  const useGenerationStatus = (campaignId) => {
    return useQuery({
      queryKey: ['redis-workflow-status', campaignId],
      queryFn: () => getGenerationStatus(campaignId),
      enabled: !!campaignId,
      refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
    });
  };

  // Auto-processing removed - only process when user clicks "Generate Messages"

  // Queue all pending leads for a campaign
  const queueAllPendingLeads = useCallback(async (campaignId, options = {}) => {
    try {
      const result = await queueLeadsMutation.mutateAsync({
        campaignId,
        model: options.model,
        customPrompt: options.customPrompt
      });
      return result;
    } catch (error) {
      throw error;
    }
  }, [queueLeadsMutation]);

  // Process messages manually
  const processMessages = useCallback(async (options = {}) => {
    try {
      const result = await processMessagesMutation.mutateAsync({
        batchSize: options.batchSize || 5,
        consumerName: options.consumerName || 'manual-worker'
      });
      return result;
    } catch (error) {
      throw error;
    }
  }, [processMessagesMutation]);

  return {
    // State
    isProcessing: isProcessing || queueLeadsMutation.isPending || processMessagesMutation.isPending,
    status,
    
    // Mutations
    queueAllPendingLeads,
    processMessages,
    
    // React Query hooks
    useLeadsReadyForMessages,
    useGenerationStatus,
    
    // Individual mutation states
    isQueueing: queueLeadsMutation.isPending,
    isProcessingMessages: processMessagesMutation.isPending,
    
    // Error states
    queueError: queueLeadsMutation.error,
    processError: processMessagesMutation.error,
    
    // Success states
    queueSuccess: queueLeadsMutation.isSuccess,
    processSuccess: processMessagesMutation.isSuccess,
  };
}
