import { NextResponse } from "next/server";
import { RedisStreamManager } from "@/libs/redis";
import { generatePersonalizedMessage } from "@/libs/groq-service";
import { db } from "@/libs/db";
import { leads, messages } from "@/libs/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/redis-workflow/workers/message-generator
 * 
 * Redis Workflow: Message Generation Worker
 * 
 * This endpoint:
 * 1. Consumes leads from Redis stream
 * 2. Generates AI messages using Groq
 * 3. Saves messages to database
 * 4. Acknowledges Redis messages
 * 
 * @param {object} body - Request body with batchSize and consumerName
 * @returns {object} Processing results and statistics
 */
export async function POST(request) {
  try {
    const { batchSize = 5, consumerName = "worker-1" } = await request.json();

    console.log(`🤖 Redis Workflow: Starting message generation worker (${consumerName})`);

    // Initialize Redis stream manager
    const streamManager = new RedisStreamManager();
    const streamName = "leads-stream";
    const groupName = "message-generators";

    // Create consumer group if it doesn't exist
    await streamManager.createConsumerGroup(streamName, groupName);

    // Consume messages from Redis stream
    const streamResult = await streamManager.readFromStream(
      streamName, 
      groupName, 
      consumerName, 
      batchSize
    );

    // Parse stream result
    const consumedMessages = [];
    if (streamResult && streamResult.length > 0) {
      const streamData = streamResult[0];
      if (streamData && streamData.length > 1) {
        const messages = streamData[1];
        for (const [messageId, fields] of messages) {
          const data = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }
          consumedMessages.push({ id: messageId, data });
        }
      }
    }

    if (consumedMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No messages to process",
        data: {
          processed: 0,
          failed: 0,
          consumerName,
          workflow: "redis-stream"
        }
      });
    }

    console.log(`📥 Redis Workflow: Consumed ${consumedMessages.length} messages`);

    let processedCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each message
    for (const message of consumedMessages) {
      try {
        const { id: messageId, data: leadData } = message;
        
        console.log(`🔄 Processing lead ${leadData.lead_id} from message ${messageId}`);

        // Get lead details from database
        const [lead] = await db
          .select()
          .from(leads)
          .where(eq(leads.id, leadData.lead_id))
          .limit(1);

        if (!lead) {
          throw new Error(`Lead ${leadData.lead_id} not found`);
        }

        // Generate AI message using Groq
        const aiMessage = await generatePersonalizedMessage({
          leadName: leadData.name,
          leadTitle: leadData.title,
          leadCompany: leadData.company,
          posts: lead.posts || [],
          customPrompt: leadData.custom_prompt,
          model: leadData.model
        });

        // Save message to database
        const [newMessage] = await db
          .insert(messages)
          .values({
            leadId: lead.id,
            campaignId: leadData.campaign_id,
            content: aiMessage,
            model: leadData.model,
            customPrompt: leadData.custom_prompt,
            status: 'draft'
          })
          .returning();

        // Acknowledge message in Redis
        await streamManager.acknowledgeMessage(streamName, groupName, messageId);

        processedCount++;
        results.push({
          messageId,
          leadId: lead.id,
          messageId: newMessage.id,
          status: 'success'
        });

        console.log(`✅ Generated message for lead ${lead.id}: ${newMessage.id}`);

      } catch (error) {
        console.error(`❌ Failed to process message ${message.id}:`, error);
        failedCount++;
        results.push({
          messageId: message.id,
          leadId: message.data.lead_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`🎉 Redis Workflow: Processed ${processedCount} messages, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} messages successfully`,
      data: {
        processed: processedCount,
        failed: failedCount,
        total: consumedMessages.length,
        results: results,
        consumerName,
        workflow: "redis-stream"
      }
    });

  } catch (error) {
    console.error("❌ Redis Workflow: Message generator error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
