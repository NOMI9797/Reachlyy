import { NextResponse } from "next/server";
import { db } from "@/libs/db";
import { leads, posts } from "@/libs/schema";
import { eq, inArray } from "drizzle-orm";

// POST /api/leads/bulk-update - Bulk update leads and their posts (optimized)
export async function POST(request) {
  try {
    const { leadsData } = await request.json();

    if (!leadsData || !Array.isArray(leadsData)) {
      return NextResponse.json({ 
        error: "leadsData array is required" 
      }, { status: 400 });
    }

    if (leadsData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No leads to update" 
      });
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

    // Use database transaction for atomicity
    const result = await db.transaction(async (tx) => {
      const leadIds = leadsData.map(lead => lead.leadId);
      const allPostsToInsert = [];
      const leadsToUpdate = [];

      // Process each lead's data
      for (const leadData of leadsData) {
        const { leadId, posts: postsData, status, name, title, company, location, profilePicture } = leadData;

        // Prepare lead update data
        const leadUpdateData = {
          status: status || 'completed',
          updatedAt: new Date(),
        };

        // Add optional fields if provided
        if (name) leadUpdateData.name = name;
        if (title) leadUpdateData.title = title;
        if (company) leadUpdateData.company = company;
        if (location) leadUpdateData.location = location;
        if (profilePicture) leadUpdateData.profilePicture = profilePicture;

        leadsToUpdate.push({ leadId, ...leadUpdateData });

        // Prepare posts data if provided
        if (postsData && Array.isArray(postsData) && postsData.length > 0) {
          const postsForLead = postsData.map(post => {
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

          allPostsToInsert.push(...postsForLead);
        }
      }

      // Step 1: Delete existing posts for all leads (batch operation)
      if (allPostsToInsert.length > 0) {
        await tx.delete(posts).where(inArray(posts.leadId, leadIds));
      }

      // Step 2: Insert all new posts (batch operation)
      if (allPostsToInsert.length > 0) {
        await tx.insert(posts).values(allPostsToInsert);
      }

      // Step 3: Update all leads (batch operation)
      const updatedLeads = [];
      for (const leadUpdate of leadsToUpdate) {
        const { leadId, ...updateData } = leadUpdate;
        const [updatedLead] = await tx
          .update(leads)
          .set(updateData)
          .where(eq(leads.id, leadId))
          .returning();
        updatedLeads.push(updatedLead);
      }

      return {
        updatedLeads,
        postsInserted: allPostsToInsert.length,
        leadsUpdated: leadsToUpdate.length
      };
    });

    console.log(`✅ BULK UPDATE: Successfully updated ${result.leadsUpdated} leads and inserted ${result.postsInserted} posts`);

    // Refresh Redis cache for affected campaigns after bulk update
    const campaignIds = [...new Set(result.updatedLeads.map(lead => lead.campaignId))];
    console.log(`🔄 CACHE REFRESH: Triggering cache refresh for ${campaignIds.length} campaigns after bulk update`);
    
    for (const campaignId of campaignIds) {
      try {
        const refreshResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:8085'}/api/redis-workflow/campaigns/${campaignId}/refresh-cache`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          console.log(`✅ CACHE REFRESH: Successfully refreshed cache for campaign ${campaignId}: ${refreshData.data.leadsCount} leads cached`);
        } else {
          console.log(`⚠️ CACHE REFRESH: Failed to refresh cache for campaign ${campaignId}: ${refreshResponse.status}`);
        }
      } catch (error) {
        console.log(`⚠️ CACHE REFRESH: Error refreshing cache for campaign ${campaignId}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.leadsUpdated} leads and inserted ${result.postsInserted} posts`,
      data: {
        leadsUpdated: result.leadsUpdated,
        postsInserted: result.postsInserted,
        updatedLeads: result.updatedLeads
      }
    });

  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
