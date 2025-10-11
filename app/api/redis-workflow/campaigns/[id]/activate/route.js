import { NextResponse } from "next/server";
import getRedisClient, { RedisStreamManager } from "@/libs/redis";
import LinkedInSessionManager from "@/libs/linkedin-session";
import { withAuth } from "@/libs/auth-middleware";
import { db } from "@/libs/db";
import { campaigns, leads } from "@/libs/schema";
import { eq, and } from "drizzle-orm";

const sessionManager = new LinkedInSessionManager();

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

    // Step 3: Test session validity
    console.log(`🧪 STEP 3: Testing session validity...`);
    
    try {
      // Use the existing session test functionality
      const testResult = await testLinkedInSession(accountData);
      
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

      console.log(`✅ Session validated: ${testResult.reason}`);
      
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
    const leadsData = await redis.hgetall(`campaign:${campaignId}:leads`);
    
    if (!leadsData || Object.keys(leadsData).length === 0) {
      return NextResponse.json(
        { 
          error: "NO_LEADS_FOUND",
          message: "No leads found for this campaign. Please add leads first." 
        },
        { status: 400 }
      );
    }

    const allLeads = Object.values(leadsData).map((s) => JSON.parse(s));
    
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

    // Step 5: Trigger queue-invites API automatically
    console.log(`🚀 STEP 5: Triggering invite queue...`);
    
    try {
      // Call the existing queue-invites endpoint internally
      const queueResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:8085'}/api/redis-workflow/campaigns/${campaignId}/queue-invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('authorization') // Pass through auth
        },
        body: JSON.stringify({
          linkedinAccountId: activeAccountId,
          customMessage,
          batchSize
        })
      });

      const queueResult = await queueResponse.json();

      if (!queueResult.success) {
        return NextResponse.json(
          { 
            error: "QUEUE_FAILED",
            message: "Failed to queue invites for processing",
            details: queueResult.message
          },
          { status: 500 }
        );
      }

      console.log(`✅ Invite queue triggered successfully: ${queueResult.data.batchesQueued} batches queued`);

      // Step 6: Return comprehensive activation status
      return NextResponse.json({
        success: true,
        message: "Campaign activated successfully",
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
          queue: {
            batchesQueued: queueResult.data.batchesQueued,
            totalLeads: queueResult.data.totalLeads,
            batchSize: queueResult.data.batchSize,
            streamLength: queueResult.data.streamLength
          },
          activation: {
            activatedAt: new Date().toISOString(),
            customMessage,
            batchSize,
            workflow: "redis-first-batch"
          }
        }
      });

    } catch (error) {
      console.error(`❌ Queue trigger failed:`, error);
      return NextResponse.json(
        { 
          error: "QUEUE_TRIGGER_FAILED",
          message: "Failed to trigger invite queue",
          details: error.message
        },
        { status: 500 }
      );
    }

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
 */
async function testLinkedInSession(sessionData) {
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
        await context.close();
        return {
          isValid: true,
          reason: 'Successfully accessed LinkedIn authenticated page',
          currentUrl
        };
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
