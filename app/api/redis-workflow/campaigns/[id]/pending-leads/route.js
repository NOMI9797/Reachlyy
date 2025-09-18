import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, messages } from "@/libs/schema";
import { eq, and, notExists } from "drizzle-orm";

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

    console.log(`🔍 Redis Workflow: Fetching completed leads ready for message generation for campaign ${campaignId}`);

    // Fetch completed leads that don't have messages yet
    const leadsReadyForMessages = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.status, 'completed'),
          notExists(
            db.select().from(messages).where(eq(messages.leadId, leads.id))
          )
        )
      );

    console.log(`✅ Redis Workflow: Found ${leadsReadyForMessages.length} completed leads ready for message generation`);

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        leadsReadyForMessages,
        count: leadsReadyForMessages.length,
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
