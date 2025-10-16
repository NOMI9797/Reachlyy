import { NextResponse } from "next/server";
import getRedisClient, { RedisStreamManager } from "@/libs/redis";
import LinkedInSessionManager from "@/libs/linkedin-session";
import { withAuth } from "@/libs/auth-middleware";
import { db } from "@/libs/db";
import { campaigns, leads } from "@/libs/schema";
import { eq, and } from "drizzle-orm";

const sessionManager = new LinkedInSessionManager();

/**
 * Update lead status in both PostgreSQL and Redis
 */
async function updateLeadStatus(campaignId, leadId, inviteStatus, inviteSent) {
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
 * Find Connect button using multiple strategies with improved timing
 */
async function findConnectButton(page) {
  console.log(`🔍 DEBUG: Starting Connect button search...`);
  
  // Strategy 1: Wait for profile to fully load first
  try {
    console.log(`⏳ Waiting for profile page to stabilize...`);
    
    // Wait for multiple possible containers
    await Promise.race([
      page.waitForSelector('.scaffold-layout__main', { timeout: 10000 }),
      page.waitForSelector('.ph5', { timeout: 10000 }),
      page.waitForSelector('main.scaffold-layout__main', { timeout: 10000 })
    ]).catch(() => console.log('⚠️ Main container timeout, continuing...'));
    
    // Wait for network to be idle (important for dynamic content)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.log('⚠️ Network idle timeout, continuing...');
    });
    
    // Extra wait for LinkedIn's React to render
    await page.waitForTimeout(2000);
    
  } catch (e) {
    console.log(`⚠️ Page stabilization warning:`, e.message);
  }

  // Strategy 2: Improved selectors with better specificity
  const connectSelectors = [
    // Primary selectors (most reliable)
    'button:has(span.artdeco-button__text:text-is("Connect"))',
    'button:has(span.artdeco-button__text)',
    
    // Aria-label based (very reliable)
    'button[aria-label*="Invite"][aria-label*="connect"]',
    'button[aria-label*="Connect with"]',
    
    // Text-based with flexibility
    'button.artdeco-button:has-text("Connect")',
    'button:text-is("Connect")',
    
    // Container-specific
    'div.pvs-profile-actions button:has-text("Connect")',
    'div[class*="profile-actions"] button:has-text("Connect")',
    
    // Fallback generic
    'button:has(span:text("Connect"))',
    'button span.artdeco-button__text'
  ];

  // Strategy 3: Try each selector with proper error handling
  for (let i = 0; i < connectSelectors.length; i++) {
    const selector = connectSelectors[i];
    console.log(`🔍 Attempt ${i + 1}/${connectSelectors.length}: ${selector}`);
    
    try {
      const buttons = await page.locator(selector).all();
      
      if (buttons.length > 0) {
        console.log(`📋 Found ${buttons.length} button(s) matching selector`);
        
        // Verify each button
        for (const button of buttons) {
          try {
            // Check if button is visible
            const isVisible = await button.isVisible();
            if (!isVisible) {
              console.log(`⚠️ Button found but not visible, skipping...`);
              continue;
            }
            
            // Get button text (handle multiple possible structures)
            const buttonHandle = await button.elementHandle();
            const buttonText = await buttonHandle.evaluate(el => {
              // Try span.artdeco-button__text first
              const span = el.querySelector('span.artdeco-button__text');
              if (span) return span.textContent?.trim();
              
              // Fallback to button text
              return el.textContent?.trim();
            });
            
            console.log(`🔍 Button text: "${buttonText}"`);
            
            // Flexible text matching (handles whitespace, case)
            if (buttonText && buttonText.toLowerCase().includes('connect')) {
              // Exclude unwanted buttons
              if (buttonText.toLowerCase().includes('message') || 
                  buttonText.toLowerCase().includes('pending') ||
                  buttonText.toLowerCase().includes('follow')) {
                console.log(`⚠️ SKIPPED: Button is "${buttonText}", not Connect`);
                continue;
              }
              
              console.log(`✅ SUCCESS: Verified Connect button with: ${selector}`);
              return button;
            }
          } catch (evalError) {
            console.log(`⚠️ Button evaluation error:`, evalError.message);
            continue;
          }
        }
      }
    } catch (e) {
      console.log(`❌ Selector ${i + 1} error:`, e.message);
      continue;
    }
  }
  
  console.log(`❌ No Connect button found after all strategies`);
  return null;
}

/**
 * Process invites directly using validated browser context
 * This replaces the Redis queue + worker pattern with immediate processing
 */
async function processInvitesDirectly(context, page, leads, customMessage, campaignId) {
  console.log(`🚀 STEP 5: Processing ${leads.length} invite(s) directly...`);
  
  const results = {
    total: leads.length,
    sent: 0,
    alreadyConnected: 0,
    alreadyPending: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    try {
      console.log(`📤 INVITE ${i + 1}/${leads.length}: Processing ${lead.name}`);
      console.log(`🔗 Navigating to: ${lead.url}`);
      
      // Navigate with better error handling
      try {
        await page.goto(lead.url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 45000 // Increased timeout
        });
      } catch (navError) {
        console.log(`❌ Navigation failed:`, navError.message);
        results.failed++;
        results.errors.push({ 
          leadId: lead.id, 
          name: lead.name, 
          error: `Navigation failed: ${navError.message}` 
        });
        continue;
      }
      
      // Wait for page to fully load
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(3000); // Allow React to render

      const currentUrl = page.url();
      console.log(`✅ Current URL: ${currentUrl}`);

      // Take debug screenshot
      const screenshotPath = `./debug-profile-${lead.id}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 Screenshot: ${screenshotPath}`);

      // Check connection status in correct order
      console.log(`🔍 Checking connection status...`);
      
      // 1. Check Pending first
      try {
        const pendingButton = page.locator('button:has-text("Pending")').first();
        if (await pendingButton.isVisible()) {
          console.log(`⏳ ALREADY PENDING: ${lead.name}`);
          results.alreadyPending++;
          await updateLeadStatus(campaignId, lead.id, 'pending', true);
          continue;
        }
      } catch (e) {
        // No pending button found, continue
      }
      
      // 2. Check Message button (already connected)
      try {
        const messageButton = page.locator('button:has-text("Message")').first();
        if (await messageButton.isVisible()) {
          console.log(`✅ ALREADY CONNECTED: ${lead.name}`);
          results.alreadyConnected++;
          await updateLeadStatus(campaignId, lead.id, 'accepted', true);
          continue;
        }
      } catch (e) {
        // No message button found, continue
      }
      
      // 3. Find Connect button
      const connectButton = await findConnectButton(page);
      
      if (!connectButton) {
        // DEBUG: Inspect all buttons on the page
        console.log(`🔍 DEBUG: Inspecting all buttons on page...`);
        
        try {
          const buttonInfo = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.slice(0, 15).map(btn => ({
              text: btn.textContent?.trim().substring(0, 50),
              ariaLabel: btn.getAttribute('aria-label'),
              className: btn.className,
              dataControl: btn.getAttribute('data-control-name'),
              id: btn.id
            }));
          });
          
          console.log(`📋 Found ${buttonInfo.length} buttons on page:`);
          buttonInfo.forEach((btn, idx) => {
            console.log(`  Button ${idx + 1}:`, JSON.stringify(btn));
          });
        } catch (evalError) {
          console.log(`⚠️ Failed to inspect buttons:`, evalError.message);
        }
        
        // No Connect button - check if already connected via Message button
        const messageButton = await page.$('button:has-text("Message")');
        if (messageButton) {
          console.log(`✅ ALREADY CONNECTED: ${lead.name} (only Message button found)`);
          results.alreadyConnected++;
          await updateLeadStatus(campaignId, lead.id, 'accepted', true);
          continue;
        }
        
        // No Connect, no Message = error
        console.log(`❌ NO CONNECT BUTTON: ${lead.name}`);
        results.failed++;
        results.errors.push({ leadId: lead.id, name: lead.name, error: 'Connect button not found' });
        await updateLeadStatus(campaignId, lead.id, 'failed', false);
        continue;
      }

      // Click Connect button with retry logic
      console.log(`🔘 Clicking Connect button...`);
      
      let clickSuccess = false;
      const clickStrategies = [
        async () => await connectButton.click({ timeout: 5000 }),
        async () => await connectButton.click({ force: true, timeout: 5000 }),
        async () => {
          const handle = await connectButton.elementHandle();
          return await handle.evaluate(btn => btn.click());
        }
      ];
      
      for (const clickFn of clickStrategies) {
        try {
          await clickFn();
          clickSuccess = true;
          console.log(`✅ Connect button clicked successfully`);
          break;
        } catch (clickError) {
          console.log(`⚠️ Click attempt failed:`, clickError.message);
        }
      }
      
      if (!clickSuccess) {
        console.log(`❌ All click attempts failed`);
        results.failed++;
        results.errors.push({ 
          leadId: lead.id, 
          name: lead.name, 
          error: 'Failed to click Connect button' 
        });
        continue;
      }
      
      // Wait for modal
      await page.waitForTimeout(3000);
      
      // Take screenshot AFTER clicking to see if modal appeared
      const modalScreenshotPath = `./debug-modal-${lead.id}.png`;
      await page.screenshot({ path: modalScreenshotPath, fullPage: true });
      console.log(`📸 Modal screenshot saved: ${modalScreenshotPath}`);
      
      // Handle invitation modal
      console.log(`🔍 Looking for invitation modal...`);
      
      let modalVisible = false;
      try {
        modalVisible = await page.locator('div[role="dialog"]').isVisible();
      } catch (e) {
        console.log(`⚠️ Modal check error:`, e.message);
      }
      
      if (!modalVisible) {
        console.log(`❌ Modal did not appear`);
        results.failed++;
        results.errors.push({ 
          leadId: lead.id, 
          name: lead.name, 
          error: 'Invitation modal did not appear' 
        });
        continue;
      }
      
      console.log(`✅ Modal visible`);
      
      // Send invite (with or without note)
      if (customMessage) {
        try {
          const addNoteBtn = page.locator('button:has-text("Add a note")').first();
          if (await addNoteBtn.isVisible()) {
            console.log(`📝 Adding custom message...`);
            await addNoteBtn.click();
            await page.waitForTimeout(1000);
            
            const textarea = page.locator('textarea[name="message"]').first();
            await textarea.fill(customMessage);
            await page.waitForTimeout(500);
            
            console.log(`📨 Sending invitation with note...`);
            const sendBtn = page.locator('button:has-text("Send")').first();
            await sendBtn.click();
            await page.waitForTimeout(2000);
            
            results.sent++;
            await updateLeadStatus(campaignId, lead.id, 'sent', true);
            console.log(`✅ INVITE SENT: ${lead.name} (with note)`);
          } else {
            console.log(`⚠️ Add note button not found, sending without note`);
            const sendWithoutNoteBtn = page.locator('button:has-text("Send without a note")').first();
            if (await sendWithoutNoteBtn.isVisible()) {
              await sendWithoutNoteBtn.click();
              await page.waitForTimeout(2000);
              
              results.sent++;
              await updateLeadStatus(campaignId, lead.id, 'sent', true);
              console.log(`✅ INVITE SENT: ${lead.name} (without note)`);
            } else {
              console.log(`❌ No send buttons found`);
              results.failed++;
              results.errors.push({ leadId: lead.id, name: lead.name, error: 'No send buttons found in modal' });
            }
          }
        } catch (e) {
          console.log(`❌ Error handling modal:`, e.message);
          results.failed++;
          results.errors.push({ leadId: lead.id, name: lead.name, error: `Modal error: ${e.message}` });
        }
      } else {
        try {
          const sendWithoutNoteBtn = page.locator('button:has-text("Send without a note")').first();
          if (await sendWithoutNoteBtn.isVisible()) {
            console.log(`📨 Sending invitation without note...`);
            await sendWithoutNoteBtn.click();
            await page.waitForTimeout(2000);
            
            results.sent++;
            await updateLeadStatus(campaignId, lead.id, 'sent', true);
            console.log(`✅ INVITE SENT: ${lead.name} (without note)`);
          } else {
            console.log(`❌ Send without note button not found`);
            results.failed++;
            results.errors.push({ leadId: lead.id, name: lead.name, error: 'Send without note button not found' });
          }
        } catch (e) {
          console.log(`❌ Error handling modal:`, e.message);
          results.failed++;
          results.errors.push({ leadId: lead.id, name: lead.name, error: `Modal error: ${e.message}` });
        }
      }

      // Rate limiting: 2 seconds between invites
      if (i < leads.length - 1) {
        console.log(`⏱️ Waiting 2 seconds before next invite...`);
        await page.waitForTimeout(2000);
      }

    } catch (error) {
      console.error(`❌ Failed to process ${lead.name}:`, error.message);
      results.failed++;
      results.errors.push({ leadId: lead.id, name: lead.name, error: error.message });
      await updateLeadStatus(campaignId, lead.id, 'failed', false);
    }
  }

  console.log(`🎉 INVITE PROCESSING COMPLETE`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Sent: ${results.sent}`);
  console.log(`   Already Connected: ${results.alreadyConnected}`);
  console.log(`   Already Pending: ${results.alreadyPending}`);
  console.log(`   Failed: ${results.failed}`);

  return results;
}

/**
 * POST /api/redis-workflow/campaigns/[id]/activate
 * 
 * Step 1: User Activates Campaign
 * 
 * This endpoint:
 * 1. Validates LinkedIn account is active and session is valid
 * 2. Fetches eligible leads for the campaign
 * 3. Triggers queue-invites API automatically
 * 4. Returns comprehensive activation status
 */
export const POST = withAuth(async (request, { params, user }) => {
  try {
    const { id: campaignId } = params;
    const { 
      linkedinAccountId, 
      customMessage = "Hi there! I'd like to connect with you.",
      batchSize = 5 
    } = await request.json();

    console.log(`🚀 CAMPAIGN ACTIVATION: Starting activation for campaign ${campaignId}`);
    console.log(`👤 User: ${user.id}`);

    // Validate required parameters
    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Step 1: Validate Campaign exists and belongs to user
    console.log(`📋 STEP 1: Validating campaign ownership...`);
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { 
          error: "CAMPAIGN_NOT_FOUND",
          message: "Campaign not found or does not belong to user" 
        },
        { status: 404 }
      );
    }

    console.log(`✅ Campaign validated: ${campaign.name} (${campaign.status})`);

    // Step 2: Find and validate active LinkedIn Account
    console.log(`🔐 STEP 2: Finding active LinkedIn account...`);
    
    let accountData = null;
    let activeAccountId = linkedinAccountId;

    // If no specific account provided, find the active one for this user
    if (!linkedinAccountId) {
      console.log(`🔍 No specific account provided, finding active account for user...`);
      
      // Get all accounts for this user
      const allAccounts = await sessionManager.getAllSessions(user.id);
      const activeAccount = allAccounts.find(account => account.isActive === true);
      
      if (!activeAccount) {
        return NextResponse.json(
          { 
            error: "NO_ACTIVE_ACCOUNT",
            message: "No active LinkedIn account found. Please activate a LinkedIn account first." 
          },
          { status: 400 }
        );
      }
      
      activeAccountId = activeAccount.sessionId;
      accountData = activeAccount;
      console.log(`✅ Found active account: ${accountData.email} (ID: ${activeAccountId})`);
    } else {
      // Validate the provided account
      accountData = await sessionManager.loadSession(linkedinAccountId);
      if (!accountData) {
        return NextResponse.json(
          { 
            error: "ACCOUNT_NOT_FOUND",
            message: "LinkedIn account not found" 
          },
          { status: 404 }
        );
      }

      if (accountData.userId !== user.id) {
        return NextResponse.json(
          { 
            error: "ACCOUNT_UNAUTHORIZED",
            message: "LinkedIn account does not belong to user" 
          },
          { status: 403 }
        );
      }

      if (!accountData.isActive) {
        return NextResponse.json(
          { 
            error: "ACCOUNT_INACTIVE",
            message: "LinkedIn account is not active. Please activate it first." 
          },
          { status: 400 }
        );
      }

      console.log(`✅ Account validated: ${accountData.email} (Active: ${accountData.isActive})`);
    }

    // Step 3: Test session validity and KEEP BROWSER OPEN
    console.log(`🧪 STEP 3: Testing session validity (keeping browser open)...`);
    
    let browserContext = null;
    let browserPage = null;
    
    try {
      // Use the existing session test functionality with keepOpen=true
      const testResult = await testLinkedInSession(accountData, true);
      
      if (!testResult.isValid) {
        // Mark account as inactive
        await sessionManager.updateSessionStatus(linkedinAccountId, { 
          isActive: false 
        });
        
        return NextResponse.json(
          { 
            error: "SESSION_INVALID",
            message: "LinkedIn session is invalid or expired. Please reconnect your account.",
            details: testResult.reason
          },
          { status: 401 }
        );
      }

      // Store browser context and page for invite processing
      browserContext = testResult.context;
      browserPage = testResult.page;
      
      console.log(`✅ Session validated: ${testResult.reason}`);
      console.log(`🔓 Browser kept open for direct invite processing`);
      
    } catch (error) {
      console.error(`❌ Session validation failed:`, error);
      return NextResponse.json(
        { 
          error: "SESSION_TEST_FAILED",
          message: "Failed to validate LinkedIn session. Please try again." 
        },
        { status: 500 }
      );
    }

    // Step 4: Fetch eligible leads for the campaign
    console.log(`📊 STEP 4: Fetching eligible leads...`);
    
    const redis = getRedisClient();
    let leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    let allLeads = [];
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      console.log(`⚠️ Redis cache empty, fetching from PostgreSQL...`);
      
      // Fallback: Fetch leads directly from PostgreSQL
      const dbLeads = await db.select().from(leads).where(eq(leads.campaignId, campaignId));
      
      if (!dbLeads || dbLeads.length === 0) {
        return NextResponse.json(
          { 
            error: "NO_LEADS_FOUND",
            message: "No leads found for this campaign. Please add leads first." 
          },
          { status: 400 }
        );
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
        // Add other fields as needed
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
        // Don't fail if Redis population fails
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

    // Count invite statuses for reporting
    const inviteStats = allLeads.reduce((acc, lead) => {
      const status = lead.inviteStatus || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const leadsWithInvites = allLeads.filter(lead => lead.inviteSent === true).length;
    
    console.log(`📊 Lead Analysis:`);
    console.log(`   Total leads: ${allLeads.length}`);
    console.log(`   Eligible for invites: ${eligibleLeads.length}`);
    console.log(`   Already sent invites: ${leadsWithInvites}`);
    console.log(`   Invite status breakdown: ${JSON.stringify(inviteStats)}`);

    if (eligibleLeads.length === 0) {
      return NextResponse.json(
        { 
          error: "NO_ELIGIBLE_LEADS",
          message: "No eligible leads found for invite sending. All leads either have invites sent or are not completed.",
          data: {
            campaignId,
            totalLeads: allLeads.length,
            eligibleLeads: 0,
            leadsWithInvites,
            inviteStats
          }
        },
        { status: 400 }
      );
    }

    // Step 5: Process invites directly using validated browser
    let inviteResults = null;
    
    try {
      inviteResults = await processInvitesDirectly(
        browserContext,
        browserPage,
        eligibleLeads,
        customMessage,
        campaignId
      );
    } catch (error) {
      console.error(`❌ Failed to process invites:`, error);
      
      // Close browser before returning error
      if (browserContext) {
        try {
          await browserContext.close();
          console.log(`🔒 Browser closed after error`);
        } catch (closeError) {
          console.error(`❌ Failed to close browser:`, closeError.message);
        }
      }
      
      return NextResponse.json(
        {
          error: "INVITE_PROCESSING_FAILED",
          message: "Failed to process invites. Please try again.",
          details: error.message
        },
        { status: 500 }
      );
    }

    // Step 6: Close browser
    console.log(`🔒 STEP 6: Closing browser...`);
    
    try {
      await browserContext.close();
      console.log(`✅ Browser closed successfully`);
    } catch (closeError) {
      console.error(`❌ Failed to close browser:`, closeError.message);
      // Don't fail if browser close fails
    }

    // Return comprehensive activation status with invite results
    return NextResponse.json({
      success: true,
      message: "Campaign activated and invites processed successfully",
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status
        },
        account: {
          id: activeAccountId,
          email: accountData.email,
          name: accountData.userName,
          isActive: accountData.isActive
        },
        leads: {
          total: allLeads.length,
          eligible: eligibleLeads.length,
          alreadySent: leadsWithInvites,
          inviteStats
        },
        inviteResults: {
          total: inviteResults.total,
          sent: inviteResults.sent,
          alreadyConnected: inviteResults.alreadyConnected,
          alreadyPending: inviteResults.alreadyPending,
          failed: inviteResults.failed,
          errors: inviteResults.errors
        },
        activation: {
          activatedAt: new Date().toISOString(),
          customMessage,
          workflow: "direct-processing"
        }
      }
    });

  } catch (error) {
    console.error("❌ Campaign Activation Error:", error);
    return NextResponse.json(
      { 
        error: "ACTIVATION_ERROR",
        message: "An error occurred during campaign activation",
        details: error.message
      },
      { status: 500 }
    );
  }
});

/**
 * Test LinkedIn session validity using browser automation
 * This is a simplified version of the test-session endpoint
 * @param {Object} sessionData - Session data with cookies, localStorage, sessionStorage
 * @param {boolean} keepOpen - If true, keeps browser open and returns context/page for reuse
 */
async function testLinkedInSession(sessionData, keepOpen = false) {
  console.log('🧪 Testing LinkedIn session validity...');
  
  try {
    // Import Playwright dynamically to avoid issues in serverless environments
    const { chromium } = await import('playwright');
    
    // Launch browser context
    const context = await chromium.launchPersistentContext(
      `/tmp/linkedin-test-${sessionData.sessionId}`,
      {
        headless: true,
        viewport: { width: 1280, height: 720 },
      }
    );

    const page = context.pages()[0] || await context.newPage();

    try {
      // Restore session data
      console.log('🔄 Restoring session data...');
      
      // Set cookies
      if (sessionData.cookies && sessionData.cookies.length > 0) {
        await context.addCookies(sessionData.cookies);
      }

      // Set localStorage
      if (sessionData.localStorage) {
        await page.addInitScript((localStorage) => {
          Object.keys(localStorage).forEach(key => {
            window.localStorage.setItem(key, localStorage[key]);
          });
        }, sessionData.localStorage);
      }

      // Set sessionStorage
      if (sessionData.sessionStorage) {
        await page.addInitScript((sessionStorage) => {
          Object.keys(sessionStorage).forEach(key => {
            window.sessionStorage.setItem(key, sessionStorage[key]);
          });
        }, sessionData.sessionStorage);
      }

      // Try to access LinkedIn feed page
      console.log('🌐 Accessing LinkedIn feed page...');
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for page to load
      await page.waitForTimeout(3000);

      // Check current URL
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Check if redirected to login page (session invalid)
      if (currentUrl.includes('linkedin.com/login') || 
          currentUrl.includes('linkedin.com/uas/login') ||
          currentUrl.includes('linkedin.com/checkpoint/')) {
        console.log('❌ Session is invalid - redirected to login page');
        await context.close();
        return {
          isValid: false,
          reason: 'Session expired or invalid - redirected to login page',
          currentUrl
        };
      }

      // Check if successfully reached authenticated pages
      if (currentUrl.includes('linkedin.com/feed') || 
          currentUrl.includes('linkedin.com/in/') ||
          currentUrl.includes('linkedin.com/mynetwork/') ||
          currentUrl.includes('linkedin.com/messaging/')) {
        
        console.log('✅ Session is valid - successfully accessed authenticated page');
        
        if (keepOpen) {
          // Return browser context and page for immediate invite processing
          console.log('🔓 Keeping browser open for invite processing...');
          return {
            isValid: true,
            reason: 'Successfully accessed LinkedIn authenticated page',
            currentUrl,
            context: context,
            page: page
          };
        } else {
          // Close browser and return validation result only
          await context.close();
          return {
            isValid: true,
            reason: 'Successfully accessed LinkedIn authenticated page',
            currentUrl
          };
        }
      }

      // Unexpected page
      console.log('⚠️ Unexpected page - session validity unclear');
      await context.close();
      return {
        isValid: false,
        reason: 'Unexpected page after navigation',
        currentUrl
      };

    } catch (error) {
      console.error('❌ Error testing session:', error.message);
      await context.close();
      return {
        isValid: false,
        reason: `Error testing session: ${error.message}`,
        currentUrl: null
      };
    }

  } catch (error) {
    console.error('❌ Browser launch failed:', error.message);
    return {
      isValid: false,
      reason: `Browser launch failed: ${error.message}`,
      currentUrl: null
    };
  }
}

