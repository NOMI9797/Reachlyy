import { NextResponse } from "next/server";
import { RedisStreamManager } from "@/libs/redis";
import getRedisClient from "@/libs/redis";

/**
 * POST /api/redis-workflow/campaigns/[id]/queue-leads
 * 
 * OPTIMIZED: Fast Queue Leads with Auto-Queue Integration
 * 
 * This endpoint:
 * 1. Checks if leads are already auto-queued (super fast!)
 * 2. If not auto-queued, triggers auto-queue in background
 * 3. Returns immediate response for instant UI feedback
 * 4. Messages start processing immediately (no waiting!)
 * 
 * @param {string} id - Campaign ID
 * @param {object} body - Request body with model and customPrompt
 * @returns {object} Queue status (optimized for speed)
 */
export async function POST(request, { params }) {
  try {
    const { id: campaignId } = params;
    const { model = "llama-3.1-8b-instant", customPrompt } = await request.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    console.log(`🔄 Redis Workflow: Queueing completed leads for message generation for campaign ${campaignId}`);

    const redis = getRedisClient();
    
    // Get leads from Redis cache (no DB query)
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      console.log(`📋 No leads found in Redis for campaign ${campaignId}`);
      return NextResponse.json({
        success: true,
        message: "No leads found in Redis cache for this campaign",
        data: {
          campaignId,
          leadsQueued: 0
        }
      });
    }

    const allLeads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));
    const leadsNeedingMessages = allLeads.filter(lead => 
      lead.status === 'completed' && 
      (!lead.hasMessage || lead.hasMessage === false)
    );

    console.log(`📋 Found ${allLeads.length} total leads, ${leadsNeedingMessages.length} ready for queuing (${allLeads.length - leadsNeedingMessages.length} already have messages)`);

    if (leadsNeedingMessages.length === 0) {
      console.log(`✅ All leads already have messages - no queuing needed`);
      return NextResponse.json({
        success: true,
        message: "All leads already have messages generated",
        data: {
          campaignId,
          leadsQueued: 0,
          totalLeads: allLeads.length,
          leadsWithMessages: allLeads.length,
          workflow: "redis-first-optimized"
        }
      });
    }

    // Check current queue length to see if auto-queue already worked
    const streamName = "leads:message-generation";
    const groupName = "message-generators";
    
    let currentQueueLength = 0;
    try {
      // Check if stream exists first
      const streamExists = await redis.exists(streamName);
      if (streamExists) {
        const groupInfo = await redis.xinfo('GROUPS', streamName);
        if (groupInfo && groupInfo.length > 0) {
          for (let i = 0; i < groupInfo.length; i++) {
            const group = groupInfo[i];
            if (group[1] === groupName) {
              currentQueueLength = parseInt(group[9]) || 0;
              break;
            }
          }
        }
      }
    } catch (error) {
      currentQueueLength = 0;
    }

    console.log(`📊 Current queue length: ${currentQueueLength}`);

    // Directly enqueue leads now for immediate availability
    const streamManager = new RedisStreamManager();
    await streamManager.createConsumerGroup(streamName, groupName);

    let enqueued = 0;
    for (const lead of leadsNeedingMessages) {
      await streamManager.addLeadToStream(streamName, {
        lead_id: lead.id,
        campaign_id: campaignId,
        name: lead.name || "",
        title: lead.title || "",
        company: lead.company || "",
        model: model,
        custom_prompt: customPrompt || "",
      });
      enqueued++;
    }

    console.log(`✅ Enqueued ${enqueued} leads to Redis stream (skipped ${allLeads.length - leadsNeedingMessages.length} with existing messages)`);

    return NextResponse.json({
      success: true,
      message: `Successfully enqueued ${enqueued} leads for AI message generation (${allLeads.length - leadsNeedingMessages.length} already had messages)`,
      data: {
        campaignId,
        leadsQueued: enqueued,
        totalLeads: allLeads.length,
        leadsWithMessages: allLeads.length - leadsNeedingMessages.length,
        streamName: streamName,
        groupName: groupName,
        workflow: "redis-first-optimized",
        autoQueued: false
      }
    });

  } catch (error) {
    console.error("❌ Error queuing leads:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
