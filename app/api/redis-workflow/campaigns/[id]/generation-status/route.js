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

    console.log(`📊 Redis Workflow: Getting generation status for campaign ${campaignId}`);

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
          redis: { queueLength: 0, streamName: "leads:message-generation", groupName: "message-generators" },
          workflow: "redis-first",
          timestamp: Date.now()
        }
      });
    }

    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));
    const leadsNeedingMessages = leads.filter(lead => 
      lead.status === 'completed' && 
      (!lead.hasMessage || lead.hasMessage === false)
    );

    console.log(`📋 Found ${leadsNeedingMessages.length} leads ready for messages`);

    // Auto-queue leads that need messages (background process)
    if (leadsNeedingMessages.length > 0) {
      try {
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
        
        console.log(`🚀 AUTO-QUEUE: Triggered background auto-queue for ${leadsNeedingMessages.length} leads`);
      } catch (error) {
        console.log(`⚠️ Auto-queue trigger failed: ${error.message}`);
      }
    }
    
    // Get Redis stream queue length
    const streamName = "leads:message-generation";
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
        streamName: "leads:message-generation",
        groupName: "message-generators"
      },
      workflow: "redis-first-auto-queue",
      timestamp: Date.now()
    };

    console.log(`📊 Status: ${leadsCount} leads, ${streamLength} in queue`);

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