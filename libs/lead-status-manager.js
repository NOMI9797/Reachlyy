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
 * Update lead status in Redis FIRST, then PostgreSQL
 * This ensures cache consistency and faster status checks
 * 
 * @param {string} campaignId - Campaign ID
 * @param {string} leadId - Lead ID
 * @param {string} inviteStatus - Invite status (sent, pending, accepted, rejected, failed)
 * @param {boolean} inviteSent - Whether invite was sent
 */
export async function updateLeadStatus(campaignId, leadId, inviteStatus, inviteSent) {
  try {
    const redis = getRedisClient();
    const leadKey = `campaign:${campaignId}:leads`;
    
    // STEP 1: Update Redis cache FIRST (source of truth for real-time checks)
    const leadData = await redis.hget(leadKey, leadId);
    
    if (leadData) {
      const lead = JSON.parse(leadData);
      lead.inviteSent = inviteSent;
      lead.inviteStatus = inviteStatus;
      lead.inviteSentAt = new Date().toISOString();
      await redis.hset(leadKey, leadId, JSON.stringify(lead));
    } else {
      console.log(`⚠️ Lead ${leadId} not found in Redis cache, skipping cache update`);
    }
    
    // STEP 2: Update PostgreSQL (persistent storage)
    await db.update(leads)
      .set({
        inviteSent: inviteSent,
        inviteStatus: inviteStatus,
        inviteSentAt: new Date()
      })
      .where(eq(leads.id, leadId));
    
  } catch (error) {
    console.error(`❌ Failed to update lead ${leadId}:`, error.message);
    throw error; // Re-throw to allow caller to handle
  }
}

/**
 * Update lead status GLOBALLY across all campaigns (by URL)
 * Use this when LinkedIn shows definitive status (Pending/Message buttons)
 * 
 * @param {string} leadUrl - LinkedIn profile URL
 * @param {string} inviteStatus - Invite status (sent, accepted)
 * @param {boolean} inviteSent - Whether invite was sent
 */
export async function updateLeadStatusGlobally(leadUrl, inviteStatus, inviteSent) {
  try {
    console.log(`🌍 GLOBAL UPDATE: Syncing ${inviteStatus} for all campaigns with ${leadUrl}`);
    
    const redis = getRedisClient();
    
    // Update ALL leads with this URL in PostgreSQL
    const result = await db.update(leads)
      .set({
        inviteSent: inviteSent,
        inviteStatus: inviteStatus,
        inviteSentAt: new Date()
      })
      .where(eq(leads.url, leadUrl))
      .returning();

    const updatedCount = result.length;
    console.log(`✅ Updated ${updatedCount} lead(s) globally in database`);

    // Update Redis cache for all campaigns
    const allCampaignKeys = await redis.keys('campaign:*:leads');
    
    let redisUpdated = 0;
    for (const key of allCampaignKeys) {
      const allLeadsInCampaign = await redis.hgetall(key);
      
      for (const [leadId, leadDataStr] of Object.entries(allLeadsInCampaign)) {
        const leadData = JSON.parse(leadDataStr);
        
        if (leadData.url === leadUrl) {
          leadData.inviteSent = inviteSent;
          leadData.inviteStatus = inviteStatus;
          leadData.inviteSentAt = new Date().toISOString();
          await redis.hset(key, leadId, JSON.stringify(leadData));
          redisUpdated++;
        }
      }
    }
    
    console.log(`✅ Updated ${redisUpdated} lead(s) globally in Redis cache`);
    return updatedCount;
    
  } catch (error) {
    console.error(`❌ Failed to update lead globally for ${leadUrl}:`, error.message);
    return 0;
  }
}

/**
 * Update lead connection accepted status globally (by URL)
 * Marks connection as accepted with timestamp
 * 
 * @param {string} leadUrl - LinkedIn profile URL
 * @param {Date} acceptedAt - When connection was accepted (defaults to now)
 * @returns {Promise<number>} - Number of leads updated
 */
export async function updateLeadConnectionAccepted(leadUrl, acceptedAt = new Date()) {
  try {
    console.log(`🌍 CONNECTION ACCEPTED: Updating all campaigns with ${leadUrl}`);
    
    const redis = getRedisClient();
    
    // Update ALL leads with this URL in PostgreSQL
    const result = await db.update(leads)
      .set({
        inviteSent: true,
        inviteStatus: 'accepted',
        inviteAcceptedAt: acceptedAt,
        updatedAt: new Date()
      })
      .where(eq(leads.url, leadUrl))
      .returning();

    const updatedCount = result.length;
    console.log(`✅ Marked ${updatedCount} lead(s) as accepted in database`);

    // Update Redis cache for all campaigns
    const allCampaignKeys = await redis.keys('campaign:*:leads');
    
    let redisUpdated = 0;
    for (const key of allCampaignKeys) {
      const allLeadsInCampaign = await redis.hgetall(key);
      
      for (const [leadId, leadDataStr] of Object.entries(allLeadsInCampaign)) {
        const leadData = JSON.parse(leadDataStr);
        
        if (leadData.url === leadUrl) {
          leadData.inviteSent = true;
          leadData.inviteStatus = 'accepted';
          leadData.inviteAcceptedAt = acceptedAt.toISOString();
          await redis.hset(key, leadId, JSON.stringify(leadData));
          redisUpdated++;
        }
      }
    }
    
    console.log(`✅ Marked ${redisUpdated} lead(s) as accepted in Redis cache`);
    return updatedCount;
    
  } catch (error) {
    console.error(`❌ Failed to mark connection accepted for ${leadUrl}:`, error.message);
    return 0;
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
  
  // Filter leads that need invites (independent of post scraping)
  // Only check: has URL, invite not sent, status is eligible
  // Note: Name is optional - we only need the LinkedIn URL to send invites
  console.log(`🔍 Filtering ${allLeads.length} leads for eligibility...`);
  
  const eligibleLeads = allLeads.filter((lead) => {
    const hasUrl = !!lead.url;
    const hasName = !!lead.name;
    const notSent = !lead.inviteSent || lead.inviteSent === false;
    const eligibleStatus = lead.inviteStatus === 'pending' || lead.inviteStatus === 'failed' || !lead.inviteStatus;
    
    // Only require URL, not name (name is optional for display purposes)
    const isEligible = hasUrl && notSent && eligibleStatus;
    
    // Debug logging for each lead
    console.log(`🔍 Lead: ${lead.name || lead.id}`);
    console.log(`   - Has URL: ${hasUrl} (${lead.url || 'MISSING'})`);
    console.log(`   - Has Name: ${hasName} (${lead.name || 'MISSING'}) - OPTIONAL`);
    console.log(`   - Not Sent: ${notSent} (inviteSent: ${lead.inviteSent})`);
    console.log(`   - Eligible Status: ${eligibleStatus} (inviteStatus: ${lead.inviteStatus})`);
    console.log(`   - ✅ ELIGIBLE: ${isEligible}`);
    
    return isEligible;
  });

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

/**
 * Update lead message sent status globally (by URL)
 * Marks message as sent with timestamp
 * 
 * @param {string} leadUrl - LinkedIn profile URL
 * @param {Date} sentAt - When message was sent (defaults to now)
 * @returns {Promise<number>} - Number of leads updated
 */
export async function updateLeadMessageSent(leadUrl, sentAt = new Date()) {
  try {
    console.log(`🌍 MESSAGE SENT: Updating all campaigns with ${leadUrl}`);
    
    const redis = getRedisClient();
    
    // Update ALL leads with this URL in PostgreSQL
    const result = await db.update(leads)
      .set({
        messageSent: true,
        messageSentAt: sentAt,
        messageError: null, // Clear any previous error
        updatedAt: new Date()
      })
      .where(eq(leads.url, leadUrl))
      .returning();

    const updatedCount = result.length;
    console.log(`✅ Marked ${updatedCount} lead(s) as message sent in database`);

    // Update Redis cache for all campaigns
    const allCampaignKeys = await redis.keys('campaign:*:leads');
    
    let redisUpdated = 0;
    for (const key of allCampaignKeys) {
      const allLeadsInCampaign = await redis.hgetall(key);
      
      for (const [leadId, leadDataStr] of Object.entries(allLeadsInCampaign)) {
        const leadData = JSON.parse(leadDataStr);
        
        if (leadData.url === leadUrl) {
          leadData.messageSent = true;
          leadData.messageSentAt = sentAt.toISOString();
          leadData.messageError = null;
          await redis.hset(key, leadId, JSON.stringify(leadData));
          redisUpdated++;
        }
      }
    }
    
    console.log(`✅ Marked ${redisUpdated} lead(s) as message sent in Redis cache`);
    return updatedCount;
    
  } catch (error) {
    console.error(`❌ Failed to mark message sent for ${leadUrl}:`, error.message);
    return 0;
  }
}

/**
 * Update lead message error status globally (by URL)
 * Records error when message sending fails
 * 
 * @param {string} leadUrl - LinkedIn profile URL
 * @param {string} errorMessage - Error message describing the failure
 * @returns {Promise<number>} - Number of leads updated
 */
export async function updateLeadMessageError(leadUrl, errorMessage) {
  try {
    console.log(`🌍 MESSAGE ERROR: Recording error for ${leadUrl}`);
    
    const redis = getRedisClient();
    
    // Update ALL leads with this URL in PostgreSQL
    const result = await db.update(leads)
      .set({
        messageSent: false,
        messageError: errorMessage,
        updatedAt: new Date()
      })
      .where(eq(leads.url, leadUrl))
      .returning();

    const updatedCount = result.length;
    console.log(`✅ Recorded error for ${updatedCount} lead(s) in database`);

    // Update Redis cache for all campaigns
    const allCampaignKeys = await redis.keys('campaign:*:leads');
    
    let redisUpdated = 0;
    for (const key of allCampaignKeys) {
      const allLeadsInCampaign = await redis.hgetall(key);
      
      for (const [leadId, leadDataStr] of Object.entries(allLeadsInCampaign)) {
        const leadData = JSON.parse(leadDataStr);
        
        if (leadData.url === leadUrl) {
          leadData.messageSent = false;
          leadData.messageError = errorMessage;
          await redis.hset(key, leadId, JSON.stringify(leadData));
          redisUpdated++;
        }
      }
    }
    
    console.log(`✅ Recorded error for ${redisUpdated} lead(s) in Redis cache`);
    return updatedCount;
    
  } catch (error) {
    console.error(`❌ Failed to record message error for ${leadUrl}:`, error.message);
    return 0;
  }
}

