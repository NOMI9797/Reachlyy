import { NextResponse } from "next/server";
import getRedisClient, { RedisStreamManager } from "@/libs/redis";
import { withAuth } from "@/libs/auth-middleware";
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/redis-workflow/campaigns/[id]/queue-invites
 * 
 * Batch Processing: Queue leads for invite sending in 5-lead batches
 * 
 * This endpoint:
 * 1. Gets leads from Redis cache
 * 2. Filters leads that need invites (not sent yet)
 * 3. Creates batches of 5 leads each
 * 4. Queues batches to Redis stream for invite processing
 */
export const POST = withAuth(async (request, { params, user }) => {
  try {
    const { id: campaignId } = params;
    const { 
      linkedinAccountId, 
      customMessage = "Hi there! I'd like to connect with you.",
      batchSize = 5 
    } = await request.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    if (!linkedinAccountId) {
      return NextResponse.json(
        { error: "LinkedIn Account ID is required" },
        { status: 400 }
      );
    }

    const redis = getRedisClient();
    const streamManager = new RedisStreamManager();

    const STREAM_NAME = `campaign:${campaignId}:invite-sending`;
    const GROUP_NAME = "invite-senders";
    const LOCK_KEY = `batch-processing:campaign:${campaignId}`;

    // Check if batch processing is already in progress for this campaign
    const isLocked = await streamManager.isBatchLocked(LOCK_KEY);
    if (isLocked) {
      return NextResponse.json({
        success: false,
        message: "Batch processing is already in progress for this campaign. Please wait for current batch to complete.",
        data: { campaignId, batchesQueued: 0 }
      });
    }

    // Use Redis pipeline to batch calls
    const pipeline = redis.pipeline();
    pipeline.hgetall(`campaign:${campaignId}:leads`);
    
    const results = await pipeline.exec();
    const leadsData = results[0][1]; // [error, result] format

    // Ensure consumer group exists (creates stream if missing)
    await streamManager.createConsumerGroup(STREAM_NAME, GROUP_NAME);
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads found in Redis cache for this campaign",
        data: { campaignId, batchesQueued: 0 }
      });
    }

    const allLeads = Object.values(leadsData).map((s) => JSON.parse(s));

    // Filter leads that need invites (completed, not sent yet, pending or failed status)
    const leadsNeedingInvites = allLeads.filter((lead) =>
      lead.status === "completed" && 
      lead.status !== "error" &&
      (!lead.inviteSent || lead.inviteSent === false) &&
      (lead.inviteStatus === 'pending' || lead.inviteStatus === 'failed' || !lead.inviteStatus)
    );

    // Count invite statuses
    const inviteStats = allLeads.reduce((acc, lead) => {
      const status = lead.inviteStatus || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    const leadsWithInvites = allLeads.filter(lead => lead.inviteSent === true).length;
    
    console.log(`📊 INVITE STATUS: ${JSON.stringify(inviteStats)}`);
    console.log(`📊 QUEUE FILTER: ${leadsNeedingInvites.length} need invites, ${leadsWithInvites} already sent`);

    if (leadsNeedingInvites.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All leads already have invites sent",
        data: { campaignId, batchesQueued: 0 }
      });
    }

    // Create batches of specified size
    const batches = [];
    for (let i = 0; i < leadsNeedingInvites.length; i += batchSize) {
      const batchLeads = leadsNeedingInvites.slice(i, i + batchSize);
      
      const batchData = {
        batch_id: uuidv4(),
        campaign_id: campaignId,
        linkedin_account_id: linkedinAccountId,
        custom_message: customMessage,
        leads: batchLeads,
        batch_size: batchLeads.length,
        created_at: new Date().toISOString()
      };
      
      batches.push(batchData);
    }

    // Queue each batch to Redis stream
    let batchesQueued = 0;
    for (const batch of batches) {
      try {
        await streamManager.addBatchToStream(STREAM_NAME, batch);
        batchesQueued++;
        console.log(`📦 BATCH QUEUED: ${batch.batch_id} with ${batch.batch_size} leads`);
      } catch (error) {
        console.error(`❌ Failed to queue batch ${batch.batch_id}:`, error);
      }
    }

    // Get stream info for response
    const streamInfo = await streamManager.getBatchInfo(STREAM_NAME);
    const streamLength = streamInfo ? streamInfo[1] : 0; // Second element is length

    console.log(`🎉 INVITE QUEUE COMPLETE: ${batchesQueued} batches queued for campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${batchesQueued} batches for invite sending`,
      data: {
        campaignId,
        batchesQueued,
        totalLeads: leadsNeedingInvites.length,
        batchSize,
        streamLength,
        leadsWithInvites,
        inviteStats
      }
    });

  } catch (error) {
    console.error("❌ Invite Queue Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
});
