import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads } from "@/libs/schema";
import { eq, and } from "drizzle-orm";
import { RedisStreamManager } from "@/libs/redis";

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

    console.log(`🔄 Redis Workflow: Queueing leads for campaign ${campaignId}`);

    // Fetch pending leads for the campaign
    const pendingLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.status, 'pending')
        )
      );

    if (pendingLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending leads found for this campaign",
        data: {
          campaignId,
          leadsQueued: 0
        }
      });
    }

    // Initialize Redis stream manager
    const streamManager = new RedisStreamManager();
    const streamName = "leads-stream";
    const groupName = "message-generators";

    // Create consumer group if it doesn't exist
    await streamManager.createConsumerGroup(streamName, groupName);

    // Push leads to Redis stream
    const messageIds = [];
    for (const lead of pendingLeads) {
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
      console.log(`✅ Queued lead ${lead.id} to Redis stream: ${messageId}`);
    }

    console.log(`🎉 Redis Workflow: Successfully queued ${pendingLeads.length} leads`);

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${pendingLeads.length} leads for AI message generation`,
      data: {
        campaignId,
        leadsQueued: pendingLeads.length,
        messageIds: messageIds,
        streamName: streamName,
        groupName: groupName,
        workflow: "redis-stream"
      }
    });

  } catch (error) {
    console.error("❌ Redis Workflow: Queue leads error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
