import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts, leads } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// GET /api/leads/[id]/posts - Get all posts for a specific lead
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First verify the lead exists
    const lead = await db.select().from(leads).where(eq(leads.id, params.id)).limit(1);
    
    if (lead.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Lead not found' 
      }, { status: 404 });
    }

    // Get all posts for this lead
    const leadPosts = await db.select()
      .from(posts)
      .where(eq(posts.leadId, params.id))
      .orderBy(posts.timestamp);

    return NextResponse.json({ 
      success: true, 
      data: leadPosts 
    });
  } catch (error) {
    console.error('Error fetching lead posts:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch lead posts',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/leads/[id]/posts - Add posts to a lead (bulk insert from scraping)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First verify the lead exists
    const lead = await db.select().from(leads).where(eq(leads.id, params.id)).limit(1);
    
    if (lead.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Lead not found' 
      }, { status: 404 });
    }

    const body = await request.json();
    const { posts: scrapedPosts } = body;

    if (!Array.isArray(scrapedPosts) || scrapedPosts.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Posts array is required and must not be empty' 
      }, { status: 400 });
    }

    // Transform scraped posts to database format
    const postsToInsert = scrapedPosts.map((post: any) => ({
      leadId: params.id,
      content: post.content || post.text || post.description || 'No content available',
      timestamp: new Date(post.timestamp || post.date || post.createdAt || new Date()),
      likes: parseInt(post.numLikes || post.likes || post.likeCount || '0') || 0,
      comments: parseInt(post.numComments || post.comments || post.commentCount || '0') || 0,
      shares: parseInt(post.numShares || post.reposts || post.repostCount || post.shares || '0') || 0,
      engagement: calculateEngagement(post)
    }));

    // Insert posts into database
    const newPosts = await db.insert(posts).values(postsToInsert).returning();

    return NextResponse.json({ 
      success: true, 
      data: newPosts,
      message: `Successfully saved ${newPosts.length} posts for lead` 
    });
  } catch (error) {
    console.error('Error saving posts for lead:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to save posts for lead',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to calculate engagement score
function calculateEngagement(post: any): number {
  const likes = parseInt(post.numLikes || post.likes || post.likeCount || '0') || 0;
  const comments = parseInt(post.numComments || post.comments || post.commentCount || '0') || 0;
  const shares = parseInt(post.numShares || post.reposts || post.repostCount || post.shares || '0') || 0;
  
  // Simple engagement calculation: likes + (comments * 2) + (shares * 3)
  return likes + (comments * 2) + (shares * 3);
}
