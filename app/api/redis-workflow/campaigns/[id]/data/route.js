import { NextResponse } from "next/server";
import getRedisClient from "@/libs/redis";

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
    
    // Get campaign data from Redis
    const campaignData = await redis.hgetall(`campaign:${campaignId}:data`);
    
    if (!campaignData || Object.keys(campaignData).length === 0) {
      return NextResponse.json(
        { error: "Campaign data not found in Redis cache" },
        { status: 404 }
      );
    }

    // Get leads data from Redis
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    const leads = Object.values(leadsData).map(leadStr => JSON.parse(leadStr));

    console.log(`✅ Redis-First: Retrieved ${leads.length} leads from Redis for campaign ${campaignId}`);

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
        leads,
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
