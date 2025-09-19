import { NextResponse } from "next/server";
import { RedisStreamManager } from "@/libs/redis";
import getRedisClient from "@/libs/redis";

/**
 * POST /api/redis-workflow/campaigns/[id]/queue-leads
 * 
 * Redis Workflow: Queue leads for AI message generation
 * 
 * This endpoint:
 * 1. Fetches pending leads for a campaign
 * 2. Pushes them to Redis stream for background processing
 * 3. Returns queue status and message IDs
 * 
 * @param {string} id - Campaign ID
 * @param {object} body - Request body with model and customPrompt
 * @returns {object} Queue status and message IDs
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

    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));
    console.log(`📋 Found ${leads.length} leads ready for queuing`);

    const streamManager = new RedisStreamManager();
    const streamName = "leads-stream";
    const groupName = "message-generators";

    await streamManager.createConsumerGroup(streamName, groupName);

    const messageIds = [];
    for (const lead of leads) {
      const leadData = {
        campaign_id: campaignId,
        lead_id: lead.id,
        name: lead.name || "LinkedIn User",
        title: lead.title,
        company: lead.company,
        url: lead.url,
        model: model,
        custom_prompt: customPrompt || ""
      };

      const messageId = await streamManager.addLeadToStream(streamName, leadData);
      messageIds.push(messageId);
    }

    console.log(`✅ Queued ${leads.length} leads to Redis stream`);

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${leads.length} leads from Redis cache for AI message generation`,
      data: {
        campaignId,
        leadsQueued: leads.length,
        messageIds: messageIds,
        streamName: streamName,
        groupName: groupName,
        workflow: "redis-first"
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
