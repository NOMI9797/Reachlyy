import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, campaigns } from "@/libs/schema";
import { eq } from "drizzle-orm";

// GET /api/leads/[id] - Get a specific lead (like Reachly)
export async function GET(request, { params }) {
  try {
    const leadId = params.id;

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: lead
    });

  } catch (error) {
    console.error("Get lead error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/leads/[id] - Update a lead (like Reachly)
export async function PUT(request, { params }) {
  try {
    const leadId = params.id;
    const updateData = await request.json();

    // Check if lead exists
    const [existingLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Update the lead
    const [updatedLead] = await db
      .update(leads)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return NextResponse.json({
      success: true,
      lead: updatedLead
    });

  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id] - Delete a lead (like Reachly)
export async function DELETE(request, { params }) {
  try {
    const leadId = params.id;

    // Check if lead exists
    const [existingLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Delete the lead (posts and messages will be cascaded)
    await db.delete(leads).where(eq(leads.id, leadId));

    return NextResponse.json({
      success: true,
      message: "Lead deleted successfully"
    });

  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}