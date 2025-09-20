import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { campaigns, leads, messages } from "@/libs/schema.js";
import { desc, eq, count, and } from "drizzle-orm";
import { withAuth } from "@/libs/auth-middleware";

// GET /api/campaigns - Get all campaigns for authenticated user
export const GET = withAuth(async (request, { user }) => {
  try {
    // Get all campaigns for the authenticated user with their lead and message counts
    const allCampaigns = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        status: campaigns.status,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        leadsCount: count(leads.id),
        messagesGenerated: count(messages.id),
      })
      .from(campaigns)
      .leftJoin(leads, and(eq(campaigns.id, leads.campaignId), eq(leads.userId, user.id)))
      .leftJoin(messages, and(eq(campaigns.id, messages.campaignId), eq(messages.userId, user.id)))
      .where(eq(campaigns.userId, user.id))
      .groupBy(campaigns.id)
      .orderBy(desc(campaigns.createdAt));

    // Now get processed leads count for each campaign and update status
    const campaignsWithProgress = await Promise.all(
      allCampaigns.map(async (campaign) => {
        const [processedCount] = await db
          .select({ count: count(leads.id) })
          .from(leads)
          .where(
            and(
              eq(leads.campaignId, campaign.id),
              eq(leads.userId, user.id),
              eq(leads.status, 'completed')
            )
          );

        // Get sent messages count for this campaign
        const [sentMessagesCount] = await db
          .select({ count: count(messages.id) })
          .from(messages)
          .where(
            and(
              eq(messages.campaignId, campaign.id),
              eq(messages.userId, user.id),
              eq(messages.status, 'sent')
            )
          );

        const processedLeads = processedCount.count || 0;
        const totalLeads = campaign.leadsCount;

        // Determine the correct status based on campaign state
        let newStatus = campaign.status;
        if (totalLeads === 0) {
          newStatus = 'draft'; // No leads added yet
        } else if (processedLeads === 0) {
          newStatus = 'active'; // Has leads but none processed yet
        } else if (processedLeads < totalLeads) {
          newStatus = 'active'; // Some leads processed, still in progress
        } else if (processedLeads === totalLeads && totalLeads > 0) {
          newStatus = 'completed'; // All leads processed
        }

        // Update campaign status if it changed (ensure user owns the campaign)
        if (newStatus !== campaign.status) {
          await db
            .update(campaigns)
            .set({ 
              status: newStatus,
              updatedAt: new Date()
            })
            .where(and(eq(campaigns.id, campaign.id), eq(campaigns.userId, user.id)));
        }

        return {
          ...campaign,
          status: newStatus,
          processedLeads: processedLeads,
          messagesSent: sentMessagesCount.count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithProgress,
    });
  } catch (error) {
    console.error("Get campaigns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

// POST /api/campaigns - Create a new campaign for authenticated user
export const POST = withAuth(async (request, { user }) => {
  try {
    const { name, description } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        status: "draft",
      })
      .returning();

    return NextResponse.json({
      success: true,
      campaign: newCampaign,
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});