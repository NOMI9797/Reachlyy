import { NextResponse } from "next/server";
import getRedisClient, { RedisStreamManager } from "@/libs/redis";

/**
 * POST /api/redis-workflow/campaigns/[id]/auto-queue
 *
 * Reads campaign leads from Redis, filters ones without messages,
 * and enqueues them into the Redis stream for message generation.
 */
export async function POST(request, { params }) {
  try {
    const { id: campaignId } = params;
    const { model = "llama-3.1-8b-instant", customPrompt = "" } = await request.json().catch(() => ({}));

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const redis = getRedisClient();
    const streamManager = new RedisStreamManager();

    const STREAM_NAME = "leads:message-generation";
    const GROUP_NAME = "message-generators";

    // Ensure consumer group exists (creates stream if missing)
    await streamManager.createConsumerGroup(STREAM_NAME, GROUP_NAME);

    // Read leads cache
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    if (!leadsData || Object.keys(leadsData).length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads found in Redis cache for this campaign",
        data: { campaignId, leadsQueued: 0 }
      });
    }

    const allLeads = Object.values(leadsData).map((s) => JSON.parse(s));

    // Filter leads that are completed and do not yet have a message flag
    const leadsNeedingMessages = allLeads.filter((lead) =>
      lead.status === "completed" && (!lead.hasMessage || lead.hasMessage === false)
    );

    if (leadsNeedingMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All leads already have messages generated",
        data: { campaignId, leadsQueued: 0 }
      });
    }

    // Enqueue each lead
    let enqueued = 0;
    for (const lead of leadsNeedingMessages) {
      await streamManager.addLeadToStream(STREAM_NAME, {
        lead_id: lead.id,
        campaign_id: campaignId,
        name: lead.name || "",
        title: lead.title || "",
        company: lead.company || "",
        model,
        custom_prompt: customPrompt,
      });
      enqueued++;
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${enqueued} leads for AI message generation`,
      data: {
        campaignId,
        leadsQueued: enqueued,
        streamName: STREAM_NAME,
        groupName: GROUP_NAME,
        workflow: "redis-first-auto-queue",
      },
    });
  } catch (error) {
    console.error("❌ Auto-Queue error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}


