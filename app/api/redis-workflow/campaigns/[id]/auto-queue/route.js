import { NextResponse } from "next/server";
import { RedisStreamManager } from "@/libs/redis";
import getRedisClient from "@/libs/redis";

/**
 * POST /api/redis-workflow/campaigns/[id]/auto-queue
 * 
 * Auto-Queue System: Automatically queue leads without messages
 * 
 * This endpoint:
 * 1. Finds leads that don't have messages yet
 * 2. Automatically queues them for background processing
 * 3. Returns queue status
 * 
 * @param {string} id - Campaign ID
 * @returns {object} Auto-queue status
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

    console.log(`🔄 AUTO-QUEUE: Starting auto-queue for campaign ${campaignId}`);

    const redis = getRedisClient();
    const streamManager = new RedisStreamManager(redis);
    
    // Get leads from Redis cache
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      console.log(`📋 AUTO-QUEUE: No leads found in Redis for campaign ${campaignId}`);
      return NextResponse.json({
        success: true,
        message: "No leads found in Redis cache",
        data: {
          campaignId,
          leadsQueued: 0,
          leadsSkipped: 0,
          totalLeads: 0
        }
      });
    }

    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));
    console.log(`📋 AUTO-QUEUE: Found ${leads.length} total leads in Redis`);

    // Filter leads that need messages (completed status + no existing message)
    const leadsNeedingMessages = leads.filter(lead => 
      lead.status === 'completed' && 
      (!lead.hasMessage || lead.hasMessage === false)
    );

    console.log(`📋 AUTO-QUEUE: Found ${leadsNeedingMessages.length} leads needing messages (${leads.length - leadsNeedingMessages.length} already have messages)`);

    if (leadsNeedingMessages.length === 0) {
      console.log(`✅ AUTO-QUEUE: All leads already have messages - no queuing needed`);
      return NextResponse.json({
        success: true,
        message: "All leads already have messages",
        data: {
          campaignId,
          leadsQueued: 0,
          leadsSkipped: leads.length,
          totalLeads: leads.length
        }
      });
    }

    // Check if leads are already in queue to avoid duplicates
    const LEADS_STREAM_NAME = 'leads:message-generation';
    const CONSUMER_GROUP_NAME = 'message-generators';
    
    // Get current queue length to check for existing entries
    let currentQueueLength = 0;
    try {
      // Check if stream exists first
      const streamExists = await redis.exists(LEADS_STREAM_NAME);
      if (streamExists) {
        const queueInfo = await redis.xinfo('GROUPS', LEADS_STREAM_NAME);
        if (queueInfo && queueInfo.length > 0) {
          for (let i = 0; i < queueInfo.length; i++) {
            const group = queueInfo[i];
            if (group[1] === CONSUMER_GROUP_NAME) {
              currentQueueLength = parseInt(group[9]) || 0;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.log(`📊 AUTO-QUEUE: Stream doesn't exist yet, will create it`);
      currentQueueLength = 0;
    }
    
    console.log(`📊 AUTO-QUEUE: Current queue length: ${currentQueueLength}`);

    // Queue leads that need messages
    const queuedLeads = [];
    let leadsQueued = 0;
    let leadsSkipped = 0;

    for (const lead of leadsNeedingMessages) {
      try {
        // Add lead to Redis stream for message generation
        const messageId = await streamManager.addToStream(LEADS_STREAM_NAME, {
          lead_id: lead.id,
          campaign_id: campaignId,
          name: lead.name,
          title: lead.title,
          company: lead.company,
          url: lead.url,
          model: model,
          custom_prompt: customPrompt || ""
        });

        queuedLeads.push({
          leadId: lead.id,
          leadName: lead.name,
          messageId: messageId
        });

        leadsQueued++;
        console.log(`✅ AUTO-QUEUE: Queued lead ${lead.name} (${lead.id}) → ${messageId}`);

      } catch (error) {
        console.error(`❌ AUTO-QUEUE: Failed to queue lead ${lead.id}:`, error);
        leadsSkipped++;
      }
    }

    console.log(`🎉 AUTO-QUEUE: Successfully queued ${leadsQueued} leads for message generation`);

    return NextResponse.json({
      success: true,
      message: `Auto-queued ${leadsQueued} leads for message generation`,
      data: {
        campaignId,
        leadsQueued,
        leadsSkipped: leads.length - leadsNeedingMessages.length,
        totalLeads: leads.length,
        queuedLeads,
        workflow: "auto-queue"
      }
    });

  } catch (error) {
    console.error("❌ AUTO-QUEUE: Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
