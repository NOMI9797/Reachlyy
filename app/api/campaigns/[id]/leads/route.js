import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { db } from "@/libs/db";
import { campaigns, leads } from "@/libs/schema";
import { eq, and } from "drizzle-orm";

// GET /api/campaigns/[id]/leads - Get leads for a campaign (like Reachly)
export async function GET(request, { params }) {
  try {
    const campaignId = params.id;

    // Check if campaign exists
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

    // Get leads for this campaign
    const campaignLeads = await db
      .select()
      .from(leads)
      .where(eq(leads.campaignId, campaignId))
      .orderBy(leads.createdAt);

    return NextResponse.json({
      success: true,
      leads: campaignLeads,
    });
  } catch (error) {
    console.error("Get leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/[id]/leads - Add leads to a campaign (like Reachly)
export async function POST(request, { params }) {
  try {
    const campaignId = params.id;

    // Check if campaign exists
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    const body = await request.json();
    const { urls, csvData } = body;

    let leadsToInsert = [];

    // Handle URL input
    if (urls && Array.isArray(urls)) {
      const validUrls = urls.filter((url) => 
        url && typeof url === 'string' && url.includes('linkedin.com')
      );

      leadsToInsert = validUrls.map((url) => ({
        campaignId: campaignId,
        url: url.trim(),
        status: 'pending'
      }));
    }

    // Handle CSV data
    if (csvData && Array.isArray(csvData)) {
      const csvLeads = csvData.map((row) => ({
        campaignId: campaignId,
        url: row.url || row.linkedinUrl || row.profile_url,
        name: row.name || row.fullName || row.full_name,
        title: row.title || row.jobTitle || row.job_title,
        company: row.company || row.companyName || row.company_name,
        status: 'pending'
      })).filter((lead) => 
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
    const existingLeads = await db
      .select({ url: leads.url })
      .from(leads)
      .where(eq(leads.campaignId, campaignId));
    
    const existingUrls = new Set(existingLeads.map(lead => lead.url));
    const newLeads = leadsToInsert.filter(lead => !existingUrls.has(lead.url));

    if (newLeads.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'All URLs already exist in this campaign'
      }, { status: 400 });
    }

    // Insert new leads
    const insertedLeads = await db
      .insert(leads)
      .values(newLeads)
      .returning();

    // Update campaign stats
    await db
      .update(campaigns)
      .set({
        totalLeads: campaign.totalLeads + insertedLeads.length,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    return NextResponse.json({
      success: true,
      message: `Successfully added ${insertedLeads.length} leads`,
      leads: insertedLeads,
      duplicatesSkipped: leadsToInsert.length - newLeads.length
    });

  } catch (error) {
    console.error("Add leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}