import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { campaigns, leads } from "@/libs/schema";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/libs/auth-middleware";

// GET /api/campaigns/[id]/leads - Get leads for a campaign (authenticated user)
export const GET = withAuth(async (request, { params, user }) => {
  try {
    const campaignId = params.id;

    // Check if campaign exists and belongs to user
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Get leads for this campaign (ensure user owns the leads)
    const campaignLeads = await db
      .select()
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), eq(leads.userId, user.id)))
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
});

// POST /api/campaigns/[id]/leads - Add leads to a campaign (authenticated user)
export const POST = withAuth(async (request, { params, user }) => {
  try {
    const campaignId = params.id;

    // Check if campaign exists and belongs to user
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
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
        userId: user.id,
        campaignId: campaignId,
        url: url.trim(),
        status: 'pending'
      }));
    }

    // Handle CSV data
    if (csvData && Array.isArray(csvData)) {
      const csvLeads = csvData.map((row) => ({
        userId: user.id,
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

    // Check for existing URLs in this campaign to prevent duplicates (user-scoped)
    const existingLeads = await db
      .select({ url: leads.url })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), eq(leads.userId, user.id)));
    
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

    // Update campaign status to 'active' when first leads are added
    const updates = {
      updatedAt: new Date(),
    };
    
    // If campaign was in draft and now has leads, make it active
    if (campaign.status === 'draft') {
      updates.status = 'active';
    }

    await db
      .update(campaigns)
      .set(updates)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)));

    console.log(`✅ LEADS ADDED: Successfully added ${insertedLeads.length} leads to campaign ${campaignId}`);

    // Refresh Redis cache for this campaign after adding leads
    console.log(`🔄 CACHE REFRESH: Triggering cache refresh for campaign ${campaignId} after adding leads`);
    try {
      const refreshResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:8085'}/api/redis-workflow/campaigns/${campaignId}/refresh-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        console.log(`✅ CACHE REFRESH: Successfully refreshed cache for campaign ${campaignId}: ${refreshData.data.leadsCount} leads cached`);
      } else {
        console.log(`⚠️ CACHE REFRESH: Failed to refresh cache for campaign ${campaignId}: ${refreshResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️ CACHE REFRESH: Error refreshing cache for campaign ${campaignId}: ${error.message}`);
    }

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
});