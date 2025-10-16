/**
 * Lead Status Manager Module
 * 
 * Centralized management of lead status updates across PostgreSQL and Redis.
 * Single source of truth for all lead-related database operations.
 */

import getRedisClient from './redis';
import { db } from './db';
import { leads } from './schema';
import { eq } from 'drizzle-orm';

/**
 * Update lead status in both PostgreSQL and Redis
 * 
 * @param {string} campaignId - Campaign ID
 * @param {string} leadId - Lead ID
 * @param {string} inviteStatus - Invite status (sent, pending, accepted, rejected, failed)
 * @param {boolean} inviteSent - Whether invite was sent
 */
export async function updateLeadStatus(campaignId, leadId, inviteStatus, inviteSent) {
  try {
    // Update PostgreSQL
    await db.update(leads)
      .set({
        inviteSent: inviteSent,
        inviteStatus: inviteStatus,
        inviteSentAt: new Date()
      })
      .where(eq(leads.id, leadId));

    // Update Redis cache
    const redis = getRedisClient();
    const leadKey = `campaign:${campaignId}:leads`;
    const leadData = await redis.hget(leadKey, leadId);
    
    if (leadData) {
      const lead = JSON.parse(leadData);
      lead.inviteSent = inviteSent;
      lead.inviteStatus = inviteStatus;
      lead.inviteSentAt = new Date().toISOString();
      await redis.hset(leadKey, leadId, JSON.stringify(lead));
    }
    
  } catch (error) {
    console.error(`❌ Failed to update lead ${leadId}:`, error.message);
  }
}

/**
 * Fetch eligible leads for invite sending
 * First tries Redis cache, falls back to PostgreSQL
 * 
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} - Object containing allLeads and eligibleLeads arrays
 */
export async function fetchEligibleLeads(campaignId) {
  const redis = getRedisClient();
  let leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
  let allLeads = [];
  
  if (!leadsData || Object.keys(leadsData).length === 0) {
    console.log(`⚠️ Redis cache empty, fetching from PostgreSQL...`);
    
    // Fallback: Fetch leads directly from PostgreSQL
    const dbLeads = await db.select().from(leads).where(eq(leads.campaignId, campaignId));
    
    if (!dbLeads || dbLeads.length === 0) {
      return {
        allLeads: [],
        eligibleLeads: [],
        source: 'postgresql'
      };
    }
    
    // Convert database leads to the expected format
    allLeads = dbLeads.map(lead => ({
      id: lead.id,
      name: lead.name,
      url: lead.url,
      status: lead.status,
      inviteSent: lead.inviteSent || false,
      inviteStatus: lead.inviteStatus || 'pending',
      inviteRetryCount: lead.inviteRetryCount || 0,
      hasMessage: lead.hasMessage || false,
      ...lead
    }));
    
    console.log(`✅ Fetched ${allLeads.length} leads from PostgreSQL (Redis fallback)`);
    
    // Optionally populate Redis cache for future requests
    try {
      const leadsDataForRedis = {};
      allLeads.forEach(lead => {
        leadsDataForRedis[lead.id] = JSON.stringify(lead);
      });
      await redis.hset(`campaign:${campaignId}:leads`, leadsDataForRedis);
      console.log(`🔄 Populated Redis cache with ${allLeads.length} leads`);
    } catch (redisError) {
      console.log(`⚠️ Failed to populate Redis cache:`, redisError.message);
    }
    
  } else {
    // Redis cache has data, use it
    allLeads = Object.values(leadsData).map((s) => JSON.parse(s));
    console.log(`✅ Fetched ${allLeads.length} leads from Redis cache`);
  }
  
  // Filter leads that need invites (completed, not sent yet, pending or failed status)
  const eligibleLeads = allLeads.filter((lead) =>
    lead.status === "completed" && 
    lead.status !== "error" &&
    (!lead.inviteSent || lead.inviteSent === false) &&
    (lead.inviteStatus === 'pending' || lead.inviteStatus === 'failed' || !lead.inviteStatus)
  );

  return {
    allLeads,
    eligibleLeads,
    source: leadsData && Object.keys(leadsData).length > 0 ? 'redis' : 'postgresql'
  };
}

/**
 * Calculate lead analytics (invite status breakdown)
 * 
 * @param {Array} leads - Array of lead objects
 * @returns {Object} - Analytics object with status counts
 */
export function getLeadAnalytics(leads) {
  // Count invite statuses
  const inviteStats = leads.reduce((acc, lead) => {
    const status = lead.inviteStatus || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Count leads with invites sent
  const leadsWithInvites = leads.filter(lead => lead.inviteSent === true).length;
  
  return {
    total: leads.length,
    inviteStats,
    leadsWithInvites
  };
}

