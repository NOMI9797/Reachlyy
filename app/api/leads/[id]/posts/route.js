import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, campaigns, posts } from "@/libs/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/leads/[id]/posts - Get posts for a lead (like Reachly)
export async function GET(request, { params }) {
  try {
    const leadId = params.id;

    // Check if lead exists
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Get posts for this lead
    const leadPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.leadId, leadId))
      .orderBy(desc(posts.timestamp));

    return NextResponse.json({
      success: true,
      posts: leadPosts
    });

  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/leads/[id]/posts - Save posts for a lead (like Reachly)
export async function POST(request, { params }) {
  try {
    const leadId = params.id;
    const { posts: postsData } = await request.json();

    if (!postsData || !Array.isArray(postsData)) {
      return NextResponse.json({ error: "Posts array is required" }, { status: 400 });
    }

    // Check if lead exists
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Helper function to safely convert to number
    const safeNumber = (value) => {
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'number') return Math.max(0, value);
      if (typeof value === 'string') {
        const parsed = parseInt(value.replace(/[^\d]/g, ''));
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      }
      return 0;
    };

    // Delete existing posts for this lead
    await db.delete(posts).where(eq(posts.leadId, leadId));

    // Prepare posts data
    const postsToInsert = postsData.map(post => {
      const likes = safeNumber(post.numLikes || post.likes || post.likeCount);
      const comments = safeNumber(post.numComments || post.comments || post.commentCount);
      const shares = safeNumber(post.numShares || post.reposts || post.repostCount || post.shares);
      
      return {
        leadId: leadId,
        content: post.content || post.text || post.description || 'No content available',
        timestamp: new Date(post.timestamp || post.date || post.createdAt || new Date()),
        likes: likes,
        comments: comments,
        shares: shares,
        engagement: likes + (comments * 2) + (shares * 3),
      };
    });

    // Save new posts
    const savedPosts = await db
      .insert(posts)
      .values(postsToInsert)
      .returning();

    return NextResponse.json({
      success: true,
      savedPosts: savedPosts.length,
      posts: savedPosts
    });

  } catch (error) {
    console.error("Save posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}