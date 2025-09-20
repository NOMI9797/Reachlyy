import { NextResponse } from "next/server";
import getRedisClient from "@/libs/redis";
import { db } from "@/libs/db";
import { messages } from "@/libs/schema";
import { eq } from "drizzle-orm";

export async function GET(request, { params }) {
  try {
    const { id: campaignId } = params;
    
    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    console.log(`📊 Redis-First: Getting campaign data from Redis for ${campaignId}`);

    const redis = getRedisClient();
    
    // Use Redis pipeline to batch multiple calls into single round trip
    const pipeline = redis.pipeline();
    pipeline.hgetall(`campaign:${campaignId}:data`);
    pipeline.hgetall(`campaign:${campaignId}:leads`);
    
    const results = await pipeline.exec();
    
    // Extract results from pipeline
    const campaignData = results[0][1]; // [error, result] format
    const leadsData = results[1][1];
    
    if (!campaignData || Object.keys(campaignData).length === 0) {
      return NextResponse.json(
        { error: "Campaign data not found in Redis cache" },
        { status: 404 }
      );
    }

    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));

    // Get existing messages for these leads (bulk query)
    const leadIds = leads.map(lead => lead.id);
    let existingMessages = [];
    
    if (leadIds.length > 0) {
      existingMessages = await db.select()
        .from(messages)
        .where(eq(messages.campaignId, campaignId));
    }

    // Create a map of leadId -> message for quick lookup
    const messageMap = {};
    existingMessages.forEach(message => {
      messageMap[message.leadId] = message;
    });

    // Add message status to each lead
    const leadsWithMessageStatus = leads.map(lead => ({
      ...lead,
      hasMessage: !!messageMap[lead.id],
      messageId: messageMap[lead.id]?.id || null,
      messageStatus: messageMap[lead.id]?.status || null
    }));

    console.log(`✅ Redis-First: Retrieved ${leads.length} leads (${existingMessages.length} with messages) from Redis for campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaignData.id,
          name: campaignData.name,
          status: campaignData.status,
          leadsCount: parseInt(campaignData.leadsCount) || 0,
          lastUpdated: parseInt(campaignData.lastUpdated) || 0
        },
        leads: leadsWithMessageStatus,
        workflow: "redis-first"
      }
    });

  } catch (error) {
    console.error("❌ Redis-First: Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
