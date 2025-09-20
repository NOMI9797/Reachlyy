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
    
    const CONSUMER_GROUP_NAME = 'message-generators';
    const CONSUMER_NAME = process.env.WORKER_ID || 'default-worker';

    const { batchSize = 5, consumerName = CONSUMER_NAME } = await request.json();

    // Discover all campaign streams
    const campaignStreams = await redis.keys('campaign:*:message-generation');
    // Found campaign streams to process

    if (campaignStreams.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No campaign streams found",
        data: {
          processed: 0,
          failed: 0,
          total: 0,
          results: [],
          consumerName,
          workflow: "redis-first-campaign-specific"
        }
      });
    }

    // Process each campaign stream
    let totalProcessed = 0;
    let totalFailed = 0;
    const allResults = [];

    for (const streamName of campaignStreams) {
      try {
        await streamManager.createConsumerGroup(streamName, CONSUMER_GROUP_NAME);
        
        const streamResult = await streamManager.readFromStream(
          streamName,
          CONSUMER_GROUP_NAME,
          consumerName,
          batchSize
        );

        if (!streamResult || streamResult.length === 0) {
          // No messages in this stream
          continue; // Move to next stream
        }

        const consumedMessages = streamResult[0][1]; // Get messages from first stream
        // Processing messages from stream

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

            // Processing lead for message generation

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
            await streamManager.acknowledgeMessage(streamName, CONSUMER_GROUP_NAME, messageId);

            // Message generated successfully

            results.push({
              success: true,
              leadId: leadData.lead_id,
              campaignId: leadData.campaign_id,
              redisMessageId: messageId,
              streamName: streamName
            });

            processedCount++;

          } catch (error) {
            console.error(`❌ Failed to process message ${messageId}:`, error);
            failedCount++;
            results.push({
              success: false,
              messageId,
              error: error.message,
              streamName: streamName
            });
          }
        }

        // Bulk insert messages to database for this stream
        if (messagesToInsert.length > 0) {
          try {
            await db.insert(messages).values(messagesToInsert);
            // Messages inserted to database
          } catch (error) {
            console.error(`❌ Redis-First: Bulk insert failed for ${streamName}:`, error);
          }
        }

        // Update Redis cache for affected campaigns
        if (processedCount > 0) {
          const campaigns = [...new Set(results.map(r => r.campaignId))];
          for (const campaignId of campaigns) {
            try {
              // Keep all leads in Redis cache (don't remove processed leads)
              // This ensures consistency with existing campaigns
              // Updated Redis cache for campaign
              
              // Update campaign data timestamp only
              const currentData = await redis.hgetall(`campaign:${campaignId}:data`);
              if (currentData && currentData.leadsCount) {
                await redis.hset(`campaign:${campaignId}:data`, 'lastUpdated', Date.now());
                // Updated timestamp for campaign
              }
              
            } catch (error) {
              console.log(`⚠️ Cache update error for campaign ${campaignId}:`, error.message);
            }
          }
        }

        // Stream processing completed
        
        // Accumulate totals
        totalProcessed += processedCount;
        totalFailed += failedCount;
        allResults.push(...results);

      } catch (error) {
        console.error(`❌ Error processing stream ${streamName}:`, error);
        totalFailed++;
      }
    }

    // All streams processed

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} messages successfully across ${campaignStreams.length} campaign streams`,
      data: {
        processed: totalProcessed,
        failed: totalFailed,
        total: totalProcessed + totalFailed,
        results: allResults,
        consumerName,
        workflow: "redis-first-campaign-specific",
        streamsProcessed: campaignStreams.length
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