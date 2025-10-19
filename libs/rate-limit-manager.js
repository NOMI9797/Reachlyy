/**
 * Rate Limit Manager
 * 
 * Manages daily invite limits for LinkedIn accounts to comply with platform restrictions.
 * Prevents account bans by enforcing configurable daily quotas.
 */

import { db } from './db';
import { linkedinAccounts } from './schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Check if account can send more invites today
 * Automatically resets counter if 24 hours have passed since last reset
 * 
 * @param {string} accountId - LinkedIn account ID
 * @returns {Promise<Object>} { canSend: boolean, remaining: number, limit: number, resetsAt: Date, sent: number }
 */
export async function checkDailyLimit(accountId) {
  const [account] = await db
    .select()
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  // Check if we need to reset (new day)
  const now = new Date();
  const lastReset = new Date(account.lastDailyReset);
  const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    // Reset counter for new day
    await db.update(linkedinAccounts)
      .set({
        dailyInvitesSent: 0,
        lastDailyReset: now
      })
      .where(eq(linkedinAccounts.id, accountId));

    console.log(`🔄 Daily counter reset for account ${accountId}`);

    return {
      canSend: true,
      remaining: account.dailyLimit,
      limit: account.dailyLimit,
      resetsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      sent: 0
    };
  }

  const remaining = account.dailyLimit - account.dailyInvitesSent;
  const canSend = remaining > 0;

  return {
    canSend,
    remaining: Math.max(0, remaining),
    limit: account.dailyLimit,
    resetsAt: new Date(lastReset.getTime() + 24 * 60 * 60 * 1000),
    sent: account.dailyInvitesSent
  };
}

/**
 * Increment daily invite counter after successful invite
 * 
 * @param {string} accountId - LinkedIn account ID
 * @param {number} count - Number of invites to increment (default: 1)
 */
export async function incrementDailyCounter(accountId, count = 1) {
  await db.update(linkedinAccounts)
    .set({
      dailyInvitesSent: sql`${linkedinAccounts.dailyInvitesSent} + ${count}`,
      lastUsed: new Date()
    })
    .where(eq(linkedinAccounts.id, accountId));

  console.log(`📊 Daily counter incremented: +${count} for account ${accountId}`);
}

/**
 * Get account quotas (alias for checkDailyLimit for consistency)
 * 
 * @param {string} accountId - LinkedIn account ID
 * @returns {Promise<Object>} Quota information
 */
export async function getAccountQuotas(accountId) {
  return await checkDailyLimit(accountId);
}

/**
 * Manually reset daily counter (for admin/testing purposes)
 * 
 * @param {string} accountId - LinkedIn account ID
 */
export async function resetDailyCounter(accountId) {
  await db.update(linkedinAccounts)
    .set({
      dailyInvitesSent: 0,
      lastDailyReset: new Date()
    })
    .where(eq(linkedinAccounts.id, accountId));

  console.log(`🔄 Daily counter manually reset for account ${accountId}`);
}

