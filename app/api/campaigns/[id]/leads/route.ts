import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, campaigns } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { normalizeLinkedInUrl } from '@/lib/scraping-utils';

// GET /api/campaigns/[id]/leads - Get all leads for a specific campaign
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First verify the campaign exists
    const campaign = await db.select().from(campaigns).where(eq(campaigns.id, params.id)).limit(1);
    
    if (campaign.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    // Get all leads for this campaign
    const campaignLeads = await db.select()
      .from(leads)
      .where(eq(leads.campaignId, params.id))
      .orderBy(leads.addedAt);

    return NextResponse.json({ 
      success: true, 
      data: campaignLeads 
    });
  } catch (error) {
    console.error('Error fetching campaign leads:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch campaign leads',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/campaigns/[id]/leads - Add leads to a campaign (URLs or CSV data)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First verify the campaign exists
    const campaign = await db.select().from(campaigns).where(eq(campaigns.id, params.id)).limit(1);
    
    if (campaign.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    const body = await request.json();
    const { urls, csvData } = body;

    let leadsToInsert: any[] = [];

    // Handle URL input
    if (urls && Array.isArray(urls)) {
      const validUrls = urls.filter((url: string) => 
        url && typeof url === 'string' && url.includes('linkedin.com')
      );

      leadsToInsert = validUrls.map((url: string) => ({
        campaignId: params.id,
        url: url.trim(),
        status: 'pending'
      }));
    }

    // Handle CSV data
    if (csvData && Array.isArray(csvData)) {
      const csvLeads = csvData.map((row: any) => ({
        campaignId: params.id,
        url: row.url || row.linkedinUrl || row.profile_url,
        name: row.name || row.fullName || row.full_name,
        title: row.title || row.jobTitle || row.job_title,
        company: row.company || row.companyName || row.company_name,
        status: 'pending'
      })).filter((lead: any) => 
        lead.url && lead.url.includes('linkedin.com')
      );

      leadsToInsert = [...leadsToInsert, ...csvLeads];
    }

    if (leadsToInsert.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No valid LinkedIn URLs found' 
      }, { status: 400 });
    }

    // Check for existing URLs in this campaign to prevent duplicates
    const existingLeads = await db.select({ url: leads.url })
      .from(leads)
      .where(eq(leads.campaignId, params.id));
    
    const existingUrls = new Set(existingLeads.map(lead => normalizeLinkedInUrl(lead.url)));
    
    // Filter out duplicate URLs
    const uniqueLeadsToInsert = leadsToInsert.filter(lead => {
      const normalizedUrl = normalizeLinkedInUrl(lead.url);
      return !existingUrls.has(normalizedUrl);
    });
    
    // Also remove duplicates within the current batch
    const seenUrls = new Set();
    const deduplicatedLeads = uniqueLeadsToInsert.filter(lead => {
      const normalizedUrl = normalizeLinkedInUrl(lead.url);
      if (seenUrls.has(normalizedUrl)) {
        return false;
      }
      seenUrls.add(normalizedUrl);
      return true;
    });

    const duplicateCount = leadsToInsert.length - deduplicatedLeads.length;
    
    if (deduplicatedLeads.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: duplicateCount > 0 
          ? `All ${duplicateCount} URLs are duplicates and already exist in this campaign`
          : 'No valid LinkedIn URLs found' 
      }, { status: 400 });
    }

    // Insert unique leads into database
    const newLeads = await db.insert(leads).values(deduplicatedLeads).returning();

    const message = duplicateCount > 0 
      ? `Successfully added ${newLeads.length} leads to campaign (${duplicateCount} duplicates skipped)`
      : `Successfully added ${newLeads.length} leads to campaign`;

    return NextResponse.json({ 
      success: true, 
      data: newLeads,
      duplicatesSkipped: duplicateCount,
      message 
    });
  } catch (error) {
    console.error('Error adding leads to campaign:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to add leads to campaign',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
