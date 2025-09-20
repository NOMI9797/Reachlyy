import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { campaigns, leads, messages } from "@/libs/schema";
import { eq, and, notExists } from "drizzle-orm";
import getRedisClient from "@/libs/redis";
import { withAuth } from "@/libs/auth-middleware";

export const POST = withAuth(async (request, { user }) => {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const redis = getRedisClient();

    // Prevent duplicate concurrent runs per user for 60s
    const lockKey = `prefetch:lock:user:${userId}`;
    const gotLock = await redis.set(lockKey, Date.now().toString(), 'NX', 'EX', 60);
    if (!gotLock) {
      console.log(`⏳ PRE-FETCH SKIPPED: already running for user ${userId}`);
      return NextResponse.json({ success: true, message: 'Pre-fetch already running', data: { userId, running: true } }, { status: 202 });
    }

    console.log(`🚀 PRE-FETCH START: Starting bulk pre-fetch for user ${userId}`);
    
    // Bulk fetch campaigns for the authenticated user
    console.log(`📊 PRE-FETCH STEP 1: Fetching campaigns from database...`);
    const userCampaigns = await db.select()
      .from(campaigns)
      .where(eq(campaigns.userId, user.id));

    console.log(`📊 PRE-FETCH STEP 1: Found ${userCampaigns.length} campaigns in database`);

    console.log(`📊 PRE-FETCH STEP 2: Caching campaigns and leads to Redis...`);
    
    let totalLeadsCached = 0;
    let campaignsSkipped = 0;
    let campaignsCached = 0;
    
    // Pre-fetch leads for each campaign (bulk)
    for (const campaign of userCampaigns) {
      // Check if campaign is already cached
      const existingData = await redis.hgetall(`campaign:${campaign.id}:data`);
      const existingLeads = await redis.hgetall(`campaign:${campaign.id}:leads`);
      
      if (existingData && existingData.id && existingLeads && Object.keys(existingLeads).length > 0) {
        console.log(`⏭️ PRE-FETCH: ${campaign.name} (${campaign.id}) → SKIPPED (already cached)`);
        campaignsSkipped++;
        totalLeadsCached += Object.keys(existingLeads).length;
        continue;
      }
      
      const campaignLeads = await db.select()
        .from(leads)
        .where(and(eq(leads.campaignId, campaign.id), eq(leads.userId, user.id)))
        .limit(1000); // Bulk fetch up to 1000 leads per campaign

      // Get existing messages for this campaign
      const campaignMessages = await db.select()
        .from(messages)
        .where(and(eq(messages.campaignId, campaign.id), eq(messages.userId, user.id)));

      console.log(`📦 PRE-FETCH: ${campaign.name} (${campaign.id}) → ${campaignLeads.length} leads, ${campaignMessages.length} messages`);

      // Store campaign data in Redis
      await redis.hset(`campaign:${campaign.id}:data`, {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        leadsCount: campaignLeads.length,
        messagesCount: campaignMessages.length,
        lastUpdated: Date.now()
      });

      // Store leads data in Redis (bulk)
      if (campaignLeads.length > 0) {
        const leadsData = {};
        // Create a set of lead IDs that have messages
        const leadsWithMessages = new Set(campaignMessages.map(msg => msg.leadId));
        
        campaignLeads.forEach(lead => {
          leadsData[lead.id] = JSON.stringify({
            id: lead.id,
            name: lead.name,
            title: lead.title,
            company: lead.company,
            url: lead.url,
            status: lead.status,
            hasMessage: leadsWithMessages.has(lead.id) // Include message status
          });
        });
        
        await redis.hset(`campaign:${campaign.id}:leads`, leadsData);
        totalLeadsCached += campaignLeads.length;
      }

      // Store messages data in Redis (bulk)
      if (campaignMessages.length > 0) {
        const messagesData = {};
        campaignMessages.forEach(message => {
          messagesData[message.leadId] = JSON.stringify({
            id: message.id,
            leadId: message.leadId,
            campaignId: message.campaignId,
            content: message.content,
            model: message.model,
            customPrompt: message.customPrompt,
            status: message.status,
            createdAt: message.createdAt
          });
        });
        
        await redis.hset(`campaign:${campaign.id}:messages`, messagesData);
        console.log(`💾 PRE-FETCH: Cached ${campaignMessages.length} messages for campaign ${campaign.id}`);
      }
      
      campaignsCached++;
    }

    console.log(`🎉 PRE-FETCH COMPLETE: ${campaignsCached} cached, ${campaignsSkipped} skipped, ${totalLeadsCached} total leads`);

    await redis.del(lockKey);

    return NextResponse.json({
      success: true,
      message: `Pre-fetch complete: ${campaignsCached} cached, ${campaignsSkipped} skipped`,
      data: {
        campaignsTotal: userCampaigns.length,
        campaignsCached,
        campaignsSkipped,
        totalLeadsCached,
        userId,
        workflow: "redis-pre-fetch"
      }
    });

  } catch (error) {
    console.error("❌ Redis Pre-Fetch: Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
});
