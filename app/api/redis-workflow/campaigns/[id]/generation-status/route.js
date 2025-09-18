import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, messages } from "@/libs/schema";
import { eq, and, count } from "drizzle-orm";
import { getRedisClient } from "@/libs/redis";

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

    // Get Redis stream length
    const redis = getRedisClient();
    const streamLength = await redis.xlen("leads-stream");

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
