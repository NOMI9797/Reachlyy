import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, messages } from "@/libs/schema";
import { eq, and, count } from "drizzle-orm";
import getRedisClient from "@/libs/redis";

/**
 * GET /api/redis-workflow/campaigns/[id]/generation-status
 * 
 * Redis Workflow: Get real-time generation status
 * 
 * This endpoint:
 * 1. Fetches lead counts by status (pending, completed, error)
 * 2. Gets message generation counts
 * 3. Returns Redis stream queue length
 * 4. Provides real-time monitoring for Redis workflow
 * 
 * @param {string} id - Campaign ID
 * @returns {object} Generation status and Redis queue info
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

    // Get lead counts by status
    const [pendingCount] = await db
      .select({ count: count(leads.id) })
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.status, 'pending')
        )
      );

    const [completedCount] = await db
      .select({ count: count(leads.id) })
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.status, 'completed')
        )
      );

    const [errorCount] = await db
      .select({ count: count(leads.id) })
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.status, 'error')
        )
      );

    // Get message counts
    const [messagesCount] = await db
      .select({ count: count(messages.id) })
      .from(messages)
      .where(eq(messages.campaignId, campaignId));

    // Get Redis stream queue length (unprocessed messages)
    const redis = getRedisClient();
    const streamName = "leads-stream";
    const groupName = "message-generators";
    
    let streamLength = 0;
    try {
      // Get consumer group info to find lag (unprocessed messages)
      const groupInfo = await redis.xinfo('GROUPS', streamName);
      if (groupInfo && groupInfo.length > 0) {
        // Find our consumer group
        for (let i = 0; i < groupInfo.length; i++) {
          const group = groupInfo[i];
          if (group[1] === groupName) { // group[1] is the group name
            // group[9] is the lag (unprocessed messages) - it's the 10th element (index 9)
            streamLength = parseInt(group[9]) || 0;
            break;
          }
        }
      }
    } catch (error) {
      // If consumer group doesn't exist, return 0
      streamLength = 0;
    }

    const statusData = {
      campaignId,
      leads: {
        pending: pendingCount.count,
        completed: completedCount.count,
        error: errorCount.count,
        total: pendingCount.count + completedCount.count + errorCount.count
      },
      messages: {
        total: messagesCount.count
      },
      redis: {
        queueLength: streamLength,
        streamName: "leads-stream",
        groupName: "message-generators"
      },
      workflow: "redis-stream"
    };

    console.log(`✅ Redis Workflow: Status - ${statusData.leads.pending} pending, ${statusData.leads.completed} completed, ${statusData.redis.queueLength} in queue`);

    return NextResponse.json({
      success: true,
      data: statusData
    });

  } catch (error) {
    console.error("❌ Redis Workflow: Get generation status error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
