import { NextResponse } from "next/server";
import getRedisClient from "@/libs/redis";
import { db } from "@/libs/db";
import { messages } from "@/libs/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/redis-workflow/campaigns/[id]/pending-leads
 * 
 * Redis Workflow: Get leads ready for message generation
 * 
 * This endpoint:
 * 1. Fetches all COMPLETED leads for a campaign that don't have messages yet
 * 2. Returns lead details for Redis workflow processing
 * 3. OPTIMIZED: Only returns leads without existing messages
 * 
 * @param {string} id - Campaign ID
 * @returns {object} Leads ready for message generation (without existing messages)
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

    // Get existing messages for this campaign (bulk query)
    const existingMessages = await db.select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId));

    // Create a set of lead IDs that already have messages
    const leadsWithMessages = new Set(existingMessages.map(msg => msg.leadId));

    // Filter out leads that already have messages
    const leadsReadyForMessages = leads.filter(lead => !leadsWithMessages.has(lead.id));

    console.log(`📋 Found ${leads.length} total leads, ${leadsReadyForMessages.length} ready for messages (${leads.length - leadsReadyForMessages.length} already have messages)`);

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        leadsReadyForMessages,
        count: leadsReadyForMessages.length,
        totalLeads: leads.length,
        leadsWithMessages: leads.length - leadsReadyForMessages.length,
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
