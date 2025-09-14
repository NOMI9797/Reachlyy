import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { db } from "@/libs/db";
import { campaigns } from "@/libs/schema";
import { eq, and } from "drizzle-orm";

// GET /api/campaigns/[id] - Get a specific campaign (like Reachly)
export async function GET(request, { params }) {
  try {
    const campaignId = params.id;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
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
}

// PUT /api/campaigns/[id] - Update a campaign (like Reachly)
export async function PUT(request, { params }) {
  try {
    const campaignId = params.id;
    const updateData = await request.json();

    // Check if campaign exists
    const [existingCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!existingCampaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Update the campaign
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId))
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
}

// DELETE /api/campaigns/[id] - Delete a campaign (like Reachly)
export async function DELETE(request, { params }) {
  try {
    const campaignId = params.id;

    // Check if campaign exists
    const [existingCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!existingCampaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Delete the campaign (leads and posts will be cascaded)
    await db
      .delete(campaigns)
      .where(eq(campaigns.id, campaignId));

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
}