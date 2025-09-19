import { NextResponse } from "next/server";
import { RedisStreamManager } from "@/libs/redis";
import { generatePersonalizedMessage } from "@/libs/groq-service";
import { db } from "@/libs/db";
import { leads, messages } from "@/libs/schema";
import { eq, inArray } from "drizzle-orm";
import getRedisClient from "@/libs/redis";

/**
 * POST /api/redis-workflow/workers/message-generator
 * 
 * Redis-First: Message Generation Worker with Bulk DB Updates
 * 
 * This worker:
 * 1. Consumes leads from Redis stream
 * 2. Generates AI messages
 * 3. Updates Redis cache first
 * 4. Performs bulk DB updates
 * 5. Invalidates cache
 */
export async function POST(request) {
  try {
    const streamManager = new RedisStreamManager();
    const redis = getRedisClient();
    
    const LEADS_STREAM_NAME = 'leads:message-generation';
    const CONSUMER_GROUP_NAME = 'message-generators';
    const CONSUMER_NAME = process.env.WORKER_ID || 'default-worker';

    await streamManager.createConsumerGroup(LEADS_STREAM_NAME, CONSUMER_GROUP_NAME);

    const { batchSize = 5, consumerName = CONSUMER_NAME } = await request.json();
    const streamResult = await streamManager.readFromStream(
      LEADS_STREAM_NAME,
      CONSUMER_GROUP_NAME,
      consumerName,
      batchSize
    );

    if (!streamResult || streamResult.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No messages to process",
        data: {
          processed: 0,
          failed: 0,
          total: 0,
          results: [],
          consumerName,
          workflow: "redis-first"
        }
      });
    }

    const consumedMessages = streamResult[0][1]; // Get messages from first stream
    console.log(`🤖 Processing ${consumedMessages.length} messages`);

    let processedCount = 0;
    let failedCount = 0;
    const results = [];
    const messagesToInsert = [];
    const leadIdsToUpdate = [];

    // Process each message
    for (const [messageId, fields] of consumedMessages) {
      try {
        // Convert Redis stream fields array to object
        const leadData = {};
        for (let i = 0; i < fields.length; i += 2) {
          leadData[fields[i]] = fields[i + 1];
        }

        console.log(`🔄 Processing lead ${leadData.lead_id} from message ${messageId}`);

        // Generate AI message
        const aiMessage = await generatePersonalizedMessage({
          leadName: leadData.name || "LinkedIn User",
          leadTitle: leadData.title || "",
          leadCompany: leadData.company || "",
          posts: [],
          customPrompt: leadData.custom_prompt || "",
          model: leadData.model || "llama-3.1-8b-instant"
        });

        // Prepare message for bulk insert
        messagesToInsert.push({
          leadId: leadData.lead_id,
          campaignId: leadData.campaign_id,
          content: aiMessage,
          model: leadData.model || "llama-3.1-8b-instant",
          customPrompt: leadData.custom_prompt || "",
          status: 'draft'
        });

        leadIdsToUpdate.push(leadData.lead_id);

        // Acknowledge message in Redis
        await streamManager.acknowledgeMessage(LEADS_STREAM_NAME, CONSUMER_GROUP_NAME, messageId);

        console.log(`✅ Generated message for lead ${leadData.lead_id}: ${messagesToInsert[messagesToInsert.length - 1].id || 'pending'}`);

        results.push({
          success: true,
          leadId: leadData.lead_id,
          campaignId: leadData.campaign_id,
          redisMessageId: messageId
        });

        processedCount++;

      } catch (error) {
        console.error(`❌ Failed to process message ${messageId}:`, error);
        failedCount++;
        results.push({
          success: false,
          messageId,
          error: error.message
        });
      }
    }

    // Bulk insert messages to database
    if (messagesToInsert.length > 0) {
      try {
        await db.insert(messages).values(messagesToInsert);
        console.log(`✅ Generated ${messagesToInsert.length} messages`);
      } catch (error) {
        console.error(`❌ Redis-First: Bulk insert failed:`, error);
      }
    }

    // Update Redis cache for affected campaigns
    if (processedCount > 0) {
      const campaigns = [...new Set(results.map(r => r.campaignId))];
      for (const campaignId of campaigns) {
        try {
          // Remove processed leads from Redis cache
          if (leadIdsToUpdate.length > 0) {
            await redis.hdel(`campaign:${campaignId}:leads`, ...leadIdsToUpdate);
          }
          
          // Update campaign data
          const currentData = await redis.hgetall(`campaign:${campaignId}:data`);
          if (currentData && currentData.leadsCount) {
            const newCount = Math.max(0, parseInt(currentData.leadsCount) - processedCount);
            await redis.hset(`campaign:${campaignId}:data`, 'leadsCount', newCount);
            await redis.hset(`campaign:${campaignId}:data`, 'lastUpdated', Date.now());
          }
          
        } catch (error) {
          console.log(`⚠️ Cache update error for campaign ${campaignId}:`, error.message);
        }
      }
    }

    console.log(`🎉 Processed ${processedCount} messages, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} messages successfully`,
      data: {
        processed: processedCount,
        failed: failedCount,
        total: consumedMessages.length,
        results: results,
        consumerName,
        workflow: "redis-first"
      }
    });

  } catch (error) {
    console.error("❌ Worker error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}