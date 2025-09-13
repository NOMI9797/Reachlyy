import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaigns, leads } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/campaigns - Get all campaigns with lead counts
export async function GET() {
  try {
    // Get campaigns with lead counts using LEFT JOIN and GROUP BY
    const allCampaigns = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        status: campaigns.status,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
        leadsCount: sql<number>`COALESCE(COUNT(${leads.id})::int, 0)`.as('leadsCount')
      })
      .from(campaigns)
      .leftJoin(leads, eq(leads.campaignId, campaigns.id))
      .groupBy(campaigns.id, campaigns.name, campaigns.description, campaigns.status, campaigns.createdAt, campaigns.updatedAt)
      .orderBy(campaigns.createdAt);

    return NextResponse.json({ 
      success: true, 
      data: allCampaigns 
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch campaigns',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign name is required' 
      }, { status: 400 });
    }

    const newCampaign = await db.insert(campaigns).values({
      name: name.trim(),
      description: description?.trim() || null,
      status: 'draft'
    }).returning();

    return NextResponse.json({ 
      success: true, 
      data: newCampaign[0],
      message: 'Campaign created successfully' 
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to create campaign',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
