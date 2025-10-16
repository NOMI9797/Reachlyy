/**
 * LinkedIn Invite Automation Module
 * 
 * Handles all Playwright-based LinkedIn invite sending automation.
 * Separated from API logic for better maintainability and testability.
 */

import { updateLeadStatus } from './lead-status-manager';

/**
 * Wait for LinkedIn profile page to stabilize
 * @param {Page} page - Playwright page object
 */
async function waitForPageStabilization(page) {
  console.log(`⏳ Waiting for profile page to stabilize...`);
  
  try {
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
}

/**
 * Find Connect button using multiple strategies
 * @param {Page} page - Playwright page object
 * @returns {Promise<Locator|null>} - Connect button locator or null
 */
export async function findConnectButton(page) {
  console.log(`🔍 DEBUG: Starting Connect button search...`);
  
  // Wait for page to stabilize first
  await waitForPageStabilization(page);

  // Multiple selectors ordered by reliability
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

  // Try each selector with proper error handling
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
 * Check connection status (Pending or Already Connected)
 * @param {Page} page - Playwright page object
 * @param {string} campaignId - Campaign ID
 * @param {Object} lead - Lead object
 * @param {Object} results - Results object to update
 * @returns {Promise<boolean>} - True if already connected/pending, false otherwise
 */
export async function checkConnectionStatus(page, campaignId, lead, results) {
  console.log(`🔍 Checking connection status...`);
  
  // 1. Check Pending first
  try {
    const pendingButton = page.locator('button:has-text("Pending")').first();
    if (await pendingButton.isVisible()) {
      console.log(`⏳ ALREADY PENDING: ${lead.name}`);
      results.alreadyPending++;
      await updateLeadStatus(campaignId, lead.id, 'pending', true);
      return true;
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
      return true;
    }
  } catch (e) {
    // No message button found, continue
  }
  
  return false;
}

/**
 * Click Connect button with retry strategies
 * @param {Locator} connectButton - Playwright locator for Connect button
 * @returns {Promise<boolean>} - True if click succeeded, false otherwise
 */
export async function clickConnectButton(connectButton) {
  console.log(`🔘 Clicking Connect button...`);
  
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
      console.log(`✅ Connect button clicked successfully`);
      return true;
    } catch (clickError) {
      console.log(`⚠️ Click attempt failed:`, clickError.message);
    }
  }
  
  console.log(`❌ All click attempts failed`);
  return false;
}

/**
 * Handle invitation modal (click "Send without a note")
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if invite sent, false otherwise
 */
export async function handleInviteModal(page) {
  console.log(`🔍 Looking for invitation modal...`);
  
  // Check if modal is visible
  let modalVisible = false;
  try {
    modalVisible = await page.locator('div[role="dialog"]').isVisible();
  } catch (e) {
    console.log(`⚠️ Modal check error:`, e.message);
  }
  
  if (!modalVisible) {
    console.log(`❌ Modal did not appear`);
    return false;
  }
  
  console.log(`✅ Modal visible`);
  
  // Always send without a note
  try {
    const sendWithoutNoteBtn = page.locator('button:has-text("Send without a note")').first();
    if (await sendWithoutNoteBtn.isVisible()) {
      console.log(`📨 Sending invitation without note...`);
      await sendWithoutNoteBtn.click();
      await page.waitForTimeout(2000);
      return true;
    } else {
      console.log(`❌ Send without note button not found`);
      return false;
    }
  } catch (e) {
    console.log(`❌ Error handling modal:`, e.message);
    return false;
  }
}

/**
 * Debug helper: Inspect all buttons on page
 * @param {Page} page - Playwright page object
 */
async function inspectPageButtons(page) {
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
}

/**
 * Process invites directly using validated browser context
 * Main orchestration function for invite sending automation
 * 
 * @param {BrowserContext} context - Playwright browser context
 * @param {Page} page - Playwright page object
 * @param {Array} leads - Array of lead objects
 * @param {string} customMessage - Custom message (not used, always send without note)
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} - Results object with counts
 */
export async function processInvitesDirectly(context, page, leads, customMessage, campaignId) {
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
          timeout: 45000
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
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      console.log(`✅ Current URL: ${currentUrl}`);

      // Take debug screenshot
      const screenshotPath = `./debug-profile-${lead.id}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 Screenshot: ${screenshotPath}`);

      // Check if already connected or pending
      const isAlreadyProcessed = await checkConnectionStatus(page, campaignId, lead, results);
      if (isAlreadyProcessed) {
        continue;
      }
      
      // Find Connect button
      const connectButton = await findConnectButton(page);
      
      if (!connectButton) {
        // Debug: Inspect all buttons
        await inspectPageButtons(page);
        
        // No Connect, no Message = error
        console.log(`❌ NO CONNECT BUTTON: ${lead.name}`);
        results.failed++;
        results.errors.push({ leadId: lead.id, name: lead.name, error: 'Connect button not found' });
        await updateLeadStatus(campaignId, lead.id, 'failed', false);
        continue;
      }

      // Click Connect button
      const clickSuccess = await clickConnectButton(connectButton);
      
      if (!clickSuccess) {
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
      const inviteSent = await handleInviteModal(page);
      
      if (inviteSent) {
        results.sent++;
        await updateLeadStatus(campaignId, lead.id, 'sent', true);
        console.log(`✅ INVITE SENT: ${lead.name} (without note)`);
      } else {
        results.failed++;
        results.errors.push({ leadId: lead.id, name: lead.name, error: 'Failed to send invite via modal' });
        await updateLeadStatus(campaignId, lead.id, 'failed', false);
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

