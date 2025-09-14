import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { messages } from "@/libs/schema";
import { eq } from "drizzle-orm";

// DELETE /api/messages/[id] - Delete a message (like Reachly)
export async function DELETE(request, { params }) {
  try {
    const messageId = params.id;

    // Check if message exists
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Delete the message
    await db.delete(messages).where(eq(messages.id, messageId));

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully"
    });

  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/messages/[id] - Update a message (like Reachly)
export async function PUT(request, { params }) {
  try {
    const messageId = params.id;
    const updateData = await request.json();

    // Check if message exists
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Update the message
    const [updatedMessage] = await db
      .update(messages)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    return NextResponse.json({
      success: true,
      message: updatedMessage
    });

  } catch (error) {
    console.error("Update message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}