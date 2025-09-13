import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaigns } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// GET /api/campaigns/[id] - Get a specific campaign
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await db.select().from(campaigns).where(eq(campaigns.id, params.id)).limit(1);
    
    if (campaign.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: campaign[0] 
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch campaign',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/campaigns/[id] - Update a campaign
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, status } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    updateData.updatedAt = new Date();

    const updatedCampaign = await db.update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, params.id))
      .returning();

    if (updatedCampaign.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedCampaign[0],
      message: 'Campaign updated successfully' 
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to update campaign',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/campaigns/[id] - Delete a campaign
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deletedCampaign = await db.delete(campaigns)
      .where(eq(campaigns.id, params.id))
      .returning();

    if (deletedCampaign.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to delete campaign',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
