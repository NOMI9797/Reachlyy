import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, leads, posts, campaigns } from '@/lib/schema';
import { eq, desc, and } from 'drizzle-orm';
import { generatePersonalizedMessage, GroqModel } from '@/lib/groq-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, campaignId, model, customPrompt } = body;

    if (!leadId || !campaignId) {
      return NextResponse.json(
        { success: false, message: 'Lead ID and Campaign ID are required' },
        { status: 400 }
      );
    }

    // Check if GROQ_API_KEY is configured
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Groq API key is not configured. Please add GROQ_API_KEY to your environment variables.' 
        },
        { status: 500 }
      );
    }

    // Fetch lead information
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (lead.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Lead not found' },
        { status: 404 }
      );
    }

    const leadData = lead[0];

    // Fetch lead's posts
    const leadPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.leadId, leadId))
      .orderBy(desc(posts.timestamp))
      .limit(5);

    // If no posts in database, check if lead has posts in JSON field
    let postsToAnalyze = leadPosts;
    if (leadPosts.length === 0 && leadData.posts) {
      const jsonPosts = leadData.posts as any[];
      if (Array.isArray(jsonPosts)) {
        postsToAnalyze = jsonPosts.slice(0, 5).map(post => ({
          content: post.text || post.content || '',
          timestamp: post.timestamp || new Date().toISOString(),
          engagement: post.engagement || 0,
        }));
      }
    }

    if (postsToAnalyze.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No posts found for this lead. Please run the scraper first.' 
        },
        { status: 400 }
      );
    }

    // Generate personalized message using Groq
    const generatedMessage = await generatePersonalizedMessage({
      leadName: leadData.name || 'there',
      leadTitle: leadData.title || undefined,
      leadCompany: leadData.company || undefined,
      posts: postsToAnalyze.map(post => ({
        content: typeof post.content === 'string' ? post.content : (post as any).text || '',
        timestamp: typeof post.timestamp === 'string' ? post.timestamp : (post as any).timestamp?.toISOString() || new Date().toISOString(),
        engagement: typeof post.engagement === 'number' ? post.engagement : (post as any).engagement || 0,
      })),
      customPrompt,
      model: model as GroqModel,
    });

    // Save message to database
    const savedMessage = await db
      .insert(messages)
      .values({
        leadId,
        campaignId,
        content: generatedMessage,
        model: model || 'llama-3.1-8b-instant',
        customPrompt: customPrompt || null,
        postsAnalyzed: postsToAnalyze.length,
        status: 'draft',
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        message: savedMessage[0],
        content: generatedMessage,
      },
    });
  } catch (error) {
    console.error('Error generating message:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate message',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET /api/messages/generate - Get messages for a lead
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const campaignId = searchParams.get('campaignId');

    if (!leadId) {
      return NextResponse.json(
        { success: false, message: 'Lead ID is required' },
        { status: 400 }
      );
    }

    let query = db
      .select()
      .from(messages)
      .where(eq(messages.leadId, leadId));

    if (campaignId) {
      query = db
        .select()
        .from(messages)
        .where(and(eq(messages.leadId, leadId), eq(messages.campaignId, campaignId)));
    }

    const leadMessages = await query.orderBy(desc(messages.createdAt));

    return NextResponse.json({
      success: true,
      data: leadMessages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch messages',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
