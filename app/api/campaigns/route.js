import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { campaigns } from "@/libs/schema.js";
import { desc } from "drizzle-orm";

// GET /api/campaigns - Get all campaigns (like Reachly)
export async function GET() {
  try {
    const allCampaigns = await db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt));

    return NextResponse.json({
      success: true,
      campaigns: allCampaigns,
    });
  } catch (error) {
    console.error("Get campaigns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns - Create a new campaign (like Reachly)
export async function POST(request) {
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
}