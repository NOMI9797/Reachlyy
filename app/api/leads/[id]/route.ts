import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// GET /api/leads/[id] - Get a specific lead
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await db.select().from(leads).where(eq(leads.id, params.id)).limit(1);
    
    if (lead.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Lead not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: lead[0] 
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch lead',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/leads/[id] - Update a lead (after scraping, status changes, etc.)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { 
      name, 
      title, 
      company, 
      status, 
      profilePicture, 
      posts 
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (company !== undefined) updateData.company = company;
    if (status !== undefined) updateData.status = status;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
    if (posts !== undefined) updateData.posts = posts;
    updateData.updatedAt = new Date();

    const updatedLead = await db.update(leads)
      .set(updateData)
      .where(eq(leads.id, params.id))
      .returning();

    if (updatedLead.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Lead not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedLead[0],
      message: 'Lead updated successfully' 
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to update lead',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/leads/[id] - Delete a lead
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deletedLead = await db.delete(leads)
      .where(eq(leads.id, params.id))
      .returning();

    if (deletedLead.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Lead not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Lead deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to delete lead',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
