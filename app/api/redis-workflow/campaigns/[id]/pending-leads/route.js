import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads } from "@/libs/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/redis-workflow/campaigns/[id]/pending-leads
 * 
 * Redis Workflow: Get pending leads for a campaign
 * 
 * This endpoint:
 * 1. Fetches all pending leads for a campaign
 * 2. Returns lead details for Redis workflow processing
 * 
 * @param {string} id - Campaign ID
 * @returns {object} Pending leads data
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

    console.log(`🔍 Redis Workflow: Fetching pending leads for campaign ${campaignId}`);

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

    console.log(`✅ Redis Workflow: Found ${pendingLeads.length} pending leads`);

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        pendingLeads,
        count: pendingLeads.length,
        workflow: "redis-stream"
      }
    });

  } catch (error) {
    console.error("❌ Redis Workflow: Get pending leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
