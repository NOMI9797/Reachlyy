import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { campaigns } from "@/libs/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/libs/auth-middleware";

// GET /api/campaigns/[id] - Get a specific campaign for authenticated user
export const GET = withAuth(async (request, { params, user }) => {
  try {
    const campaignId = params.id;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      campaign: campaign,
    });
  } catch (error) {
    console.error("Get campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

// PUT /api/campaigns/[id] - Update a campaign for authenticated user
export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const campaignId = params.id;
    const updateData = await request.json();

    // Check if campaign exists and belongs to user
    const [existingCampaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .limit(1);

    if (!existingCampaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Update the campaign (ensure user owns it)
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .returning();

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error("Update campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

// DELETE /api/campaigns/[id] - Delete a campaign for authenticated user
export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const campaignId = params.id;

    // Check if campaign exists and belongs to user
    const [existingCampaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .limit(1);

    if (!existingCampaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Delete the campaign (leads and posts will be cascaded, ensure user owns it)
    await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)));

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    console.error("Delete campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});