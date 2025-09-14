import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// PUT /api/messages/[id] - Update message status
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, content } = body;

    const updatedMessage = await db
      .update(messages)
      .set({
        ...(status && { status }),
        ...(content && { content }),
        ...(status === 'sent' && { sentAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(messages.id, params.id))
      .returning();

    if (updatedMessage.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedMessage[0],
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update message',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/[id] - Delete a message
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deletedMessage = await db
      .delete(messages)
      .where(eq(messages.id, params.id))
      .returning();

    if (deletedMessage.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete message',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
