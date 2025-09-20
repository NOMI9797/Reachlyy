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
    mutationFn: async ({ batchSize = 5, consumerName = 'web-worker', campaignId }) => {
      if (!campaignId) {
        throw new Error('Campaign ID is required for message processing');
      }

      try {
        const response = await fetch('/api/redis-workflow/workers/message-generator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batchSize,
            consumerName,
            campaignId
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
      refetchInterval: (data) => {
        // Stop polling if no leads are ready for messages
        if (data?.data?.count === 0) {
          console.log(`✅ LEADS POLLING: No leads ready - STOPPING polling`);
          return false; // Stop polling
        }
        
        // Continue polling every 5s if there are leads ready
        console.log(`🔄 LEADS POLLING: ${data?.data?.count || 0} leads ready - polling every 5s`);
        return 5000;
      },
    });
  };

  const useGenerationStatus = (campaignId) => {
    return useQuery({
      queryKey: ['redis-workflow-status', campaignId],
      queryFn: () => getGenerationStatus(campaignId),
      enabled: !!campaignId,
      refetchInterval: (data) => {
        // Smart polling based on campaign state
        if (!data?.data) return 10000; // 10s if no data
        
        const { redis, leads } = data.data;
        const queueLength = redis?.queueLength || 0;
        const hasPendingLeads = leads?.pending > 0;
        const hasCompletedLeads = leads?.completed > 0;
        const isCurrentlyProcessing = isProcessing;
        
        // Active state: Poll every 2s when there's work
        if (queueLength > 0 || isProcessing || hasPendingLeads) {
          console.log(`🔄 SMART POLLING: Active state - polling every 2s (queue: ${queueLength}, processing: ${isProcessing})`);
          return 2000;
        }
        
        // Idle state: Poll every 10s when no active work but has completed leads
        if (hasCompletedLeads) {
          console.log(`⏸️ SMART POLLING: Idle state - polling every 10s (completed: ${leads.completed})`);
          return 10000;
        }
        
        // Stable state: STOP POLLING when everything is done
        console.log(`✅ SMART POLLING: Stable state - STOPPING polling (no active work)`);
        return false; // Stop polling completely
      },
    });
  };

  // Auto-processing removed - only process when user clicks "Generate Messages"

  // Queue all pending leads for a campaign
  const queueAllPendingLeads = useCallback(async (campaignId, options = {}) => {
    return await queueLeadsMutation.mutateAsync({
      campaignId,
      model: options.model,
      customPrompt: options.customPrompt
    });
  }, [queueLeadsMutation]);

  // Process messages manually
  const processMessages = useCallback(async (options = {}) => {
    if (!options.campaignId) {
      throw new Error('Campaign ID is required for message processing');
    }

    return await processMessagesMutation.mutateAsync({
      batchSize: options.batchSize || 5,
      consumerName: options.consumerName || 'manual-worker',
      campaignId: options.campaignId
    });
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
