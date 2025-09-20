import { NextResponse } from "next/server";
import getRedisClient from "@/libs/redis";

/**
 * GET /api/redis-workflow/campaigns/[id]/generation-status
 * 
 * Redis-First: Get real-time generation status from Redis cache + Auto-Queue
 * 
 * This endpoint:
 * 1. Gets campaign data from Redis cache (no DB queries)
 * 2. Gets Redis stream queue length
 * 3. Auto-queues leads without messages for faster processing
 * 4. Returns real-time status
 * 
 * @param {string} id - Campaign ID
 * @returns {object} Real-time generation status
 */
export async function GET(request, { params }) {
  try {
    const { id: campaignId } = params;

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Getting generation status

    const redis = getRedisClient();
    
    // Get campaign data from Redis cache (no DB queries)
    const campaignData = await redis.hgetall(`campaign:${campaignId}:data`);
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      console.log(`📋 No leads found in Redis for campaign ${campaignId}`);
      return NextResponse.json({
        success: true,
        data: {
          campaignId,
          leads: { pending: 0, completed: 0, error: 0, total: 0 },
          messages: { total: 0 },
          redis: { queueLength: 0, streamName: `campaign:${campaignId}:message-generation`, groupName: "message-generators" },
          workflow: "redis-first",
          timestamp: Date.now()
        }
      });
    }

    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));
    const leadsNeedingMessages = leads.filter(lead => 
      lead.status === 'completed' && 
      lead.status !== 'error' &&
      (!lead.hasMessage || lead.hasMessage === false)
    );

    // Found leads ready for messages

    // Get Redis stream queue length first
    const streamName = `campaign:${campaignId}:message-generation`;
    const groupName = "message-generators";
    
    let streamLength = 0;
    try {
      // Check if stream exists first
      const streamExists = await redis.exists(streamName);
      if (streamExists) {
        const groupInfo = await redis.xinfo('GROUPS', streamName);
        if (groupInfo && groupInfo.length > 0) {
          for (let i = 0; i < groupInfo.length; i++) {
            const group = groupInfo[i];
            if (group[1] === groupName) {
              streamLength = parseInt(group[9]) || 0;
              break;
            }
          }
        }
      }
    } catch (error) {
      streamLength = 0;
    }

    // Auto-queue leads that need messages (background process) - with smart conditions and circuit breaker
    if (leadsNeedingMessages.length > 0) {
      // Check if there's already a queue to prevent spam
      if (streamLength === 0) {
        // Circuit breaker: Check if auto-queue was recently attempted
        const autoQueueKey = `auto-queue:${campaignId}:attempt`;
        const lastAttempt = await redis.get(autoQueueKey);
        const now = Date.now();
        const cooldownPeriod = 30000; // 30 seconds cooldown
        
        if (!lastAttempt || (now - parseInt(lastAttempt)) > cooldownPeriod) {
          try {
            // Set attempt timestamp
            await redis.setex(autoQueueKey, 60, now.toString());
            
            // Trigger auto-queue in background (don't wait for response)
            fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:8085'}/api/redis-workflow/campaigns/${campaignId}/auto-queue`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                model: "llama-3.1-8b-instant",
                customPrompt: ""
              })
            }).catch(error => {
              console.log(`⚠️ Auto-queue background call failed: ${error.message}`);
            });
            
            // Auto-queue triggered successfully
          } catch (error) {
            console.log(`⚠️ Auto-queue trigger failed: ${error.message}`);
          }
        } else {
          const timeLeft = Math.ceil((cooldownPeriod - (now - parseInt(lastAttempt))) / 1000);
          // Auto-queue skipped due to cooldown
        }
      } else {
        // Auto-queue skipped - queue already has items
      }
    } else {
      // Auto-queue skipped - no leads need messages
    }

    const leadsCount = Object.keys(leadsData).length;
    
    const statusData = {
      campaignId,
      leads: {
        pending: 0,
        completed: leadsCount,
        error: 0,
        total: leadsCount
      },
      messages: {
        total: 0 // Will be updated by worker
      },
      redis: {
        queueLength: streamLength,
        streamName: streamName,
        groupName: "message-generators"
      },
      workflow: "redis-first-auto-queue",
      timestamp: Date.now()
    };

    // Status updated

    return NextResponse.json({
      success: true,
      data: statusData
    });

  } catch (error) {
    console.error("❌ Error getting status:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}