/**
 * Background Workflow Worker
 * 
 * On-demand worker that processes LinkedIn invite workflows in the background.
 * Spawned by the API when a workflow is started, exits when done.
 * 
 * Usage: node workers/workflow-worker.js <jobId>
 */

import { testLinkedInSession, cleanupBrowserSession } from '../libs/linkedin-session-validator';
import { processInvitesDirectly } from '../libs/linkedin-invite-automation';
import { fetchEligibleLeads } from '../libs/lead-status-manager';
import { checkDailyLimit, incrementDailyCounter } from '../libs/rate-limit-manager';
import { db } from '../libs/db';
import { workflowJobs, linkedinAccounts } from '../libs/schema';
import { eq } from 'drizzle-orm';
import { createClient } from 'redis';

// Global control flags for event-driven job control
let shouldExit = false;
let exitReason = null;
let redisSubscriber = null;

const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ ERROR: Job ID required');
  console.error('Usage: node workers/workflow-worker.js <jobId>');
  process.exit(1);
}

console.log(`🚀 Worker Started | Job: ${jobId.substring(0, 8)}... | PID: ${process.pid}`);

/**
 * Setup Redis Pub/Sub listener for instant job control
 * Subscribes to job:{jobId}:control channel for pause/cancel signals
 */
async function setupControlListener(jobId) {
  try {
    // Create dedicated subscriber client
    redisSubscriber = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    // Handle connection errors
    redisSubscriber.on('error', (err) => {
      console.error('⚠️  Redis Subscriber Error:', err.message);
      // Don't crash - we have DB fallback
    });

    await redisSubscriber.connect();
    
    const channel = `job:${jobId}:control`;
    
    // Subscribe to control channel
    await redisSubscriber.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        const timestamp = new Date().toISOString();
        const latency = Date.now() - new Date(data.timestamp).getTime();
        
        console.log(`\n📡 [${timestamp}] Redis Signal Received`);
        console.log(`   Action: ${data.action.toUpperCase()}`);
        console.log(`   Job: ${jobId.substring(0, 8)}...`);
        console.log(`   Source: ${data.userId || 'unknown'}`);
        console.log(`   Latency: ~${latency}ms`);
        
        if (data.action === 'cancel') {
          console.log(`🛑 [CONTROL] Setting exit flag: CANCELLED`);
          shouldExit = true;
          exitReason = 'cancelled';
        } else if (data.action === 'pause') {
          console.log(`⏸️  [CONTROL] Setting exit flag: PAUSED`);
          shouldExit = true;
          exitReason = 'paused';
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Redis message:', parseError.message);
      }
    });
    
    console.log(`📡 Subscribed to control channel: ${channel}`);
    return true;
    
  } catch (error) {
    console.error('⚠️  Redis subscription failed:', error.message);
    console.log('⚠️  Falling back to DB polling for control signals');
    return false;
  }
}

/**
 * Cleanup Redis subscriber connection
 */
async function cleanupRedisSubscriber() {
  if (redisSubscriber) {
    try {
      await redisSubscriber.quit();
      console.log('🔌 Redis subscriber disconnected');
    } catch (error) {
      console.error('⚠️  Error disconnecting Redis subscriber:', error.message);
    }
  }
}

// Handle process termination signals
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received - shutting down gracefully...');
  await cleanupRedisSubscriber();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received - shutting down gracefully...');
  await cleanupRedisSubscriber();
  process.exit(0);
});

async function runJob() {
  let useRedisControl = false;
  try {
    // Fetch Job from Database
    const job = await db.query.workflowJobs.findFirst({
      where: eq(workflowJobs.id, jobId)
    });
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    console.log(`📋 Campaign: ${job.campaignId.substring(0, 8)}... | Status: processing`);
    
    // Update job status to processing
    await db.update(workflowJobs)
      .set({ status: 'processing', startedAt: new Date() })
      .where(eq(workflowJobs.id, jobId));
    
    // Setup Redis control listener for instant pause/cancel
    console.log('📡 Setting up real-time control listener...');
    useRedisControl = await setupControlListener(jobId);
    
    if (useRedisControl) {
      console.log('✅ Real-time control: ENABLED (Redis Pub/Sub)');
    } else {
      console.log('⚠️  Real-time control: DISABLED (using DB fallback)');
    }
    
    // Get LinkedIn Account Data
    const accountData = await db.query.linkedinAccounts.findFirst({
      where: eq(linkedinAccounts.id, job.accountId)
    });
    
    if (!accountData) {
      throw new Error('LinkedIn account not found');
    }
    
    // Check Daily Limit
    const quotas = await checkDailyLimit(job.accountId);
    console.log(`📊 Account: ${accountData.email} | Quota: ${quotas.sent}/${quotas.limit} (${quotas.remaining} left)`);
    
    if (!quotas.canSend) {
      const resetsIn = Math.ceil((quotas.resetsAt - new Date()) / (1000 * 60 * 60));
      throw new Error(`Daily limit reached (${quotas.limit}). Resets in ${resetsIn} hours.`);
    }
    
    // Fetch Eligible Leads
    const { eligibleLeads, source } = await fetchEligibleLeads(job.campaignId);
    console.log(`📥 Leads: ${eligibleLeads.length} eligible (from ${source})`);
    
    if (eligibleLeads.length === 0) {
      console.log(`ℹ️  No action needed - all leads already processed`);
      
      // Mark job as completed (not failed) - this is a successful no-op
      await db.update(workflowJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalLeads: 0,
          processedLeads: 0,
          progress: 100,
          results: {
            total: 0,
            sent: 0,
            alreadyConnected: 0,
            alreadyPending: 0,
            failed: 0,
            skipped: true,
            skipReason: 'all_leads_already_processed',
            message: '✅ All leads in this campaign already have pending or accepted invites.'
          }
        })
        .where(eq(workflowJobs.id, jobId));
      
      console.log(`✅ Job Completed (skipped) | Exit: 0`);
      process.exit(0);
    }
    
    // Limit to remaining quota
    const leadsToProcess = eligibleLeads.slice(0, Math.min(eligibleLeads.length, quotas.remaining));
    
    if (leadsToProcess.length < eligibleLeads.length) {
      console.log(`⚠️ Limited to ${leadsToProcess.length} leads (daily quota: ${quotas.remaining})`);
    }
    
    // Split into Batches
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < leadsToProcess.length; i += BATCH_SIZE) {
      batches.push(leadsToProcess.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 Batches: ${batches.length} × ${BATCH_SIZE} leads`);
    
    // Check if this is a resume (processedLeads > 0)
    const isResume = job.processedLeads > 0;
    if (isResume) {
      console.log(`🔄 Resuming from lead ${job.processedLeads + 1}/${leadsToProcess.length}`);
    }
    
    // Update total leads in job
    await db.update(workflowJobs)
      .set({ totalLeads: leadsToProcess.length })
      .where(eq(workflowJobs.id, jobId));
    
    // Process Each Batch Sequentially
    console.log(`🔄 Starting batch processing...`);
    
    let totalSent = 0;
    let totalFailed = 0;
    let totalAlreadyConnected = 0;
    let totalAlreadyPending = 0;
    let currentLeadIndex = isResume ? job.processedLeads : 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      let batchContext = null;
      
      // Skip batches that were already processed (for resume functionality)
      const batchStartIndex = batchIndex * BATCH_SIZE;
      if (isResume && batchStartIndex < job.processedLeads) {
        console.log(`⏭️  Skipping batch ${batchIndex + 1} (already processed)`);
        continue;
      }
      
      console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length} | ${batch.length} leads`);
      
      // Check exit flag (instant - no DB query!)
      if (shouldExit) {
        console.log(`\n🛑 [EXIT TRIGGERED] Reason: ${exitReason.toUpperCase()}`);
        console.log(`   Batch: ${batchIndex + 1}/${batches.length}`);
        console.log(`   Processed: ${currentLeadIndex}/${leadsToProcess.length}`);
        console.log(`   Source: ${useRedisControl ? 'Redis Pub/Sub (<100ms)' : 'DB Polling'}`);
        
        // Close browser if open
        if (batchContext) {
          console.log('🔒 Closing browser before exit...');
          await cleanupBrowserSession(batchContext);
        }
        
        console.log(`👋 Exit: 0 (${exitReason})`);
        process.exit(0);
      }
      
      // FALLBACK: DB check every 10 batches (in case Redis fails)
      if (!useRedisControl && batchIndex % 10 === 0) {
        console.log('🔍 [FALLBACK] Checking job status via DB...');
        const currentJob = await db.query.workflowJobs.findFirst({
          where: eq(workflowJobs.id, jobId)
        });
        
        if (currentJob.status === 'paused') {
          console.log(`⏸️  Job paused (detected via DB fallback)`);
          shouldExit = true;
          exitReason = 'paused';
          continue; // Will exit on next iteration
        }
        
        if (currentJob.status === 'cancelled') {
          console.log(`🛑 Job cancelled (detected via DB fallback)`);
          shouldExit = true;
          exitReason = 'cancelled';
          continue; // Will exit on next iteration
        }
      }
      
      try {
        // Validate Session (Open Browser)
        const sessionResult = await testLinkedInSession(accountData, true);
        
        if (!sessionResult.isValid) {
          throw new Error(`Session invalid: ${sessionResult.reason}`);
        }
        
        console.log(`  ✅ Session validated`);
        
        batchContext = sessionResult.context;
        const batchPage = sessionResult.page;
        
        // Process Invites with Progress Callback
        // Progress callback to update database in real-time
        const progressCallback = async (progressData) => {
          if (progressData.type === 'progress') {
            currentLeadIndex++;
            const progress = Math.round((currentLeadIndex / leadsToProcess.length) * 100);
            
            try {
              await db.update(workflowJobs)
                .set({ 
                  processedLeads: currentLeadIndex,
                  progress 
                })
                .where(eq(workflowJobs.id, jobId));
              
              console.log(`  📊 Progress: ${currentLeadIndex}/${leadsToProcess.length} (${progress}%)`);
            } catch (dbError) {
              console.error(`  ❌ DB update failed:`, dbError.message);
            }
          }
        };
        
        // Process invites (reuses existing automation logic)
        const batchResults = await processInvitesDirectly(
          batchContext,
          batchPage,
          batch,
          job.customMessage || "Hi! I'd like to connect with you.",
          job.campaignId,
          progressCallback
        );
        
        // Aggregate results
        totalSent += batchResults.sent;
        totalFailed += batchResults.failed;
        totalAlreadyConnected += batchResults.alreadyConnected;
        totalAlreadyPending += batchResults.alreadyPending;
        
        console.log(`  ✅ Sent: ${batchResults.sent} | Failed: ${batchResults.failed}`);
        
        // Increment daily counter for successfully sent invites
        if (batchResults.sent > 0) {
          await incrementDailyCounter(job.accountId, batchResults.sent);
        }
        
      } catch (batchError) {
        console.error(`  ❌ Batch error: ${batchError.message}`);
        totalFailed += batch.length;
        
      } finally {
        // Close Browser
        if (batchContext) {
          await cleanupBrowserSession(batchContext);
          console.log(`  🔒 Browser closed`);
        }
      }
      
      // ============================================================
      // BATCH STEP 4: Check Daily Limit
      // ============================================================
      const updatedQuotas = await checkDailyLimit(job.accountId);
      
      if (!updatedQuotas.canSend) {
        console.log(`⚠️  Limit reached after batch ${batchIndex + 1}/${batches.length}`);
        break;
      }
      
      // Delay Before Next Batch (if not last)
      if (batchIndex < batches.length - 1) {
        const delayMinutes = 5;
        const delayMs = delayMinutes * 60 * 1000;
        const nextTime = new Date(Date.now() + delayMs).toLocaleTimeString();
        
        console.log(`⏱️  Waiting ${delayMinutes}min (next at ${nextTime})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Update Job Status to Completed
    console.log(`\n✅ Workflow Complete | Sent: ${totalSent} | Failed: ${totalFailed} | Already: ${totalAlreadyConnected + totalAlreadyPending}`);
    
    await db.update(workflowJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        processedLeads: currentLeadIndex,
        results: {
          total: leadsToProcess.length,
          sent: totalSent,
          failed: totalFailed,
          alreadyConnected: totalAlreadyConnected,
          alreadyPending: totalAlreadyPending
        },
        progress: 100
      })
      .where(eq(workflowJobs.id, jobId));
    
    console.log(`👋 Exit: 0\n`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Job Failed | Error: ${error.message}`);
    
    // Update job status to failed
    await db.update(workflowJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
      })
      .where(eq(workflowJobs.id, jobId));
    
    console.log(`👋 Exit: 1\n`);
    process.exit(1);
    
  } finally {
    // Always cleanup Redis subscriber
    await cleanupRedisSubscriber();
  }
}

// Run the job
runJob();

