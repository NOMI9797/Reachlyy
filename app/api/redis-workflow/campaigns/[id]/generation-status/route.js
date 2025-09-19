import { NextResponse } from "next/server";
import getRedisClient from "@/libs/redis";

/**
 * GET /api/redis-workflow/campaigns/[id]/generation-status
 * 
 * Redis-First: Get real-time generation status from Redis cache
 * 
 * This endpoint:
 * 1. Gets campaign data from Redis cache (no DB queries)
 * 2. Gets Redis stream queue length
 * 3. Returns real-time status
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

    const redis = getRedisClient();
    
    // Get campaign data from Redis cache (no DB queries)
    const campaignData = await redis.hgetall(`campaign:${campaignId}:data`);
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    
    // Get Redis stream queue length
    const streamName = "leads-stream";
    const groupName = "message-generators";
    
    let streamLength = 0;
    try {
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
        streamName: "leads-stream",
        groupName: "message-generators"
      },
      workflow: "redis-first",
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