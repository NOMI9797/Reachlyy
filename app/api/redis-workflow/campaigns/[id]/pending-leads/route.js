import { NextResponse } from "next/server";
import getRedisClient from "@/libs/redis";

/**
 * GET /api/redis-workflow/campaigns/[id]/pending-leads
 * 
 * Redis Workflow: Get leads ready for message generation
 * 
 * This endpoint:
 * 1. Fetches all COMPLETED leads for a campaign that don't have messages yet
 * 2. Returns lead details for Redis workflow processing
 * 
 * @param {string} id - Campaign ID
 * @returns {object} Leads ready for message generation
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
    
    // Get leads from Redis cache (no DB query)
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      console.log(`📋 No leads found in Redis for campaign ${campaignId}`);
      return NextResponse.json({
        success: true,
        data: {
          campaignId,
          leadsReadyForMessages: [],
          count: 0,
          workflow: "redis-first"
        }
      });
    }

    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));
    console.log(`📋 Found ${leads.length} leads ready for messages`);

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        leadsReadyForMessages: leads,
        count: leads.length,
        workflow: "redis-first"
      }
    });

  } catch (error) {
    console.error("❌ Error getting leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
