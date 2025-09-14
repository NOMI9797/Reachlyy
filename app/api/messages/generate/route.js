import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, campaigns, posts, messages } from "@/libs/schema";
import { eq, desc } from "drizzle-orm";
import { generatePersonalizedMessage } from "@/libs/groq-service";

export async function POST(request) {
  try {
    const { leadId, customPrompt, model } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 }
      );
    }

    // Get lead information (like Reachly - no user auth)
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Get posts for this lead
    const leadPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.leadId, leadId))
      .orderBy(desc(posts.engagement), desc(posts.timestamp))
      .limit(5);

    if (leadPosts.length === 0) {
      return NextResponse.json(
        { error: "No posts found for this lead. Please scrape the profile first." },
        { status: 400 }
      );
    }

    // Generate personalized message using Groq
    const messageContent = await generatePersonalizedMessage({
      leadName: lead.name || "LinkedIn User",
      leadTitle: lead.title,
      leadCompany: lead.company,
      posts: leadPosts.map(post => ({
        content: post.content,
        timestamp: post.timestamp.toISOString(),
        engagement: post.engagement
      })),
      customPrompt,
      model: model || "llama-3.1-8b-instant"
    });

    // Save message to database
    const [savedMessage] = await db
      .insert(messages)
      .values({
        leadId: leadId,
        campaignId: lead.campaignId,
        content: messageContent,
        model: model || "llama-3.1-8b-instant",
        customPrompt: customPrompt || null,
        postsAnalyzed: leadPosts.length,
        status: "draft",
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: savedMessage,
      messageContent: messageContent
    });

  } catch (error) {
    console.error("Message generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate message", details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/messages/generate - Get message history for a lead (like Reachly)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 }
      );
    }

    // Check if lead exists
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Get messages for this lead
    const leadMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.leadId, leadId))
      .orderBy(desc(messages.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      messages: leadMessages,
    });

  } catch (error) {
    console.error("Get messages API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}