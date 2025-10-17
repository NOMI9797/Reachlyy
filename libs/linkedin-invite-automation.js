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
 * Get the profile header container (where action buttons are)
 * This ensures we only search for Connect button in the profile header, not sidebar
 * @param {Page} page - Playwright page object
 * @returns {Promise<Locator|null>} - Profile header container or null
 */
async function getProfileHeaderContainer(page) {
  console.log(`🔍 Finding profile header container...`);
  
  // Multiple possible selectors for the profile header/actions area
  const headerSelectors = [
    '.pv-top-card', // Most common - profile top card
    '.scaffold-layout__main .pv-top-card',
    'section.artdeco-card.pv-top-card',
    '.profile-background-image ~ div', // Container after background image
    'main .ph5', // Main content area
    '.scaffold-layout__main section:first-of-type' // First section in main layout
  ];
  
  for (const selector of headerSelectors) {
    try {
      const container = page.locator(selector).first();
      if (await container.isVisible({ timeout: 3000 })) {
        console.log(`✅ Found profile header with: ${selector}`);
        return container;
      }
    } catch (e) {
      continue;
    }
  }
  
  console.log(`⚠️ Profile header not found, will search entire page (less accurate)`);
  return null;
}

/**
 * Find Connect button in "More" dropdown
 * @param {Page} page - Playwright page object
 * @param {Locator|null} profileHeader - Profile header container (optional)
 * @returns {Promise<Locator|null>} - Connect button locator or null
 */
async function findConnectButtonInDropdown(page, profileHeader = null) {
  try {
    // Define search context (profile header or entire page)
    const searchContext = profileHeader || page;
    
    // Find the "More" button using multiple selectors
    const moreButtonSelectors = [
      'button[aria-label*="More actions"]',
      'button.artdeco-dropdown__trigger:has-text("More")',
      'button:has-text("More")',
      'button[id*="profile-overflow"]'
    ];
    
    let moreButton = null;
    
    for (const selector of moreButtonSelectors) {
      try {
        const btn = searchContext.locator(selector).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          moreButton = btn;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!moreButton) {
      return null;
    }
    
    // Click the "More" button to open dropdown
    try {
      await moreButton.click();
      await page.waitForTimeout(2000);
    } catch (clickError) {
      return null;
    }
    
    // Wait for dropdown content to render
    await page.waitForTimeout(1000);
    
    const dropdownConnectSelectors = [
      // Very simple - just text (most reliable)
      'span:text-is("Connect")',
      'div:has-text("Connect")',
      
      // Dropdown specific
      '.artdeco-dropdown__item:has-text("Connect")',
      '.artdeco-dropdown__item span:text-is("Connect")',
      
      // Role-based
      '[role="menuitem"]:has-text("Connect")',
      'div[role="button"]:has-text("Connect")',
      
      // From user's HTML
      'span.display-flex:text-is("Connect")',
      'span[aria-hidden="true"]:text-is("Connect")',
      
      // Aria-label based (best for verification)
      'div[aria-label*="Invite"]',
      'div[aria-label*="Invite"][aria-label*="connect"]'
    ];
    
    for (const selector of dropdownConnectSelectors) {
      try {
        const elements = await page.locator(selector).all();
        
        for (const element of elements) {
          try {
            if (await element.isVisible({ timeout: 1000 })) {
              const text = await element.textContent().catch(() => '');
              const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
              
              // Check if this is Connect
              if (text.trim().toLowerCase() === 'connect' || 
                  (ariaLabel && ariaLabel.toLowerCase().includes('invite') && ariaLabel.toLowerCase().includes('connect'))) {
                
                // Try to find clickable parent
                try {
                  const parent = element.locator('xpath=ancestor::div[@role="button" or contains(@class, "dropdown__item")]').first();
                  if (await parent.isVisible()) {
                    console.log(`✅ Found Connect option in dropdown`);
                    return parent;
                  }
                } catch (e) {
                  // If no parent, return element itself
                  console.log(`✅ Found Connect option in dropdown`);
                  return element;
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

/**
 * Find Connect button using multiple strategies
 * Strategy 1: Direct Connect button on profile
 * Strategy 2: Connect button hidden in "More" dropdown
 * 
 * IMPORTANT: Only searches within profile header to avoid sidebar Connect buttons
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Locator|null>} - Connect button locator or null
 */
export async function findConnectButton(page) {
  console.log(`🔍 Searching for Connect button...`);
  
  // Wait for page to stabilize first
  await waitForPageStabilization(page);

  // Get profile header container to limit search scope
  const profileHeader = await getProfileHeaderContainer(page);
  const searchContext = profileHeader || page;

  // STRATEGY 1: Look for direct Connect button first
  const directConnectSelectors = [
    'button:has(span.artdeco-button__text:text-is("Connect"))',
    'button[aria-label*="Invite"][aria-label*="connect"]',
    'button.artdeco-button:has-text("Connect")',
    'button:text-is("Connect")',
    'button:has(span:text("Connect"))'
  ];

  // Try direct connect button first
  for (let i = 0; i < directConnectSelectors.length; i++) {
    const selector = directConnectSelectors[i];
    
    try {
      const buttons = await searchContext.locator(selector).all();
      
      if (buttons.length > 0) {
        // Verify each button
        for (const button of buttons) {
          try {
            // Check if button is visible
            const isVisible = await button.isVisible();
            if (!isVisible) continue;
            
            // Get button text
            const buttonHandle = await button.elementHandle();
            const buttonText = await buttonHandle.evaluate(el => {
              const span = el.querySelector('span.artdeco-button__text');
              if (span) return span.textContent?.trim();
              return el.textContent?.trim();
            });
            
            // Check if this is Connect button
            if (buttonText && buttonText.toLowerCase().includes('connect')) {
              // Exclude unwanted buttons
              if (buttonText.toLowerCase().includes('message') || 
                  buttonText.toLowerCase().includes('pending') ||
                  buttonText.toLowerCase().includes('follow') ||
                  buttonText.toLowerCase() === 'connected') {
                continue;
              }
              
              console.log(`✅ Found direct Connect button`);
              return button;
            }
          } catch (evalError) {
            continue;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  // STRATEGY 2: Look for Connect button in "More" dropdown
  console.log(`🔍 Checking "More" dropdown...`);
  
  const connectInDropdown = await findConnectButtonInDropdown(page, profileHeader);
  
  if (connectInDropdown) {
    console.log(`✅ Found Connect button in dropdown`);
    return connectInDropdown;
  }
  
  console.log(`❌ Connect button not found`);
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
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if click succeeded, false otherwise
 */
export async function clickConnectButton(connectButton, page) {
  console.log(`🔘 Clicking Connect button...`);
  
  const clickStrategies = [
    async () => await connectButton.click({ timeout: 5000 }),
    async () => await connectButton.click({ force: true, timeout: 5000 }),
    async () => {
      const handle = await connectButton.elementHandle();
      return await handle.evaluate(btn => btn.click());
    }
  ];
  
  for (let i = 0; i < clickStrategies.length; i++) {
    try {
      await clickStrategies[i]();
      console.log(`✅ Connect button clicked successfully (strategy ${i + 1})`);
      
      // If we clicked from dropdown, wait a bit longer for modal
      await page.waitForTimeout(2000);
      
      return true;
    } catch (clickError) {
      console.log(`⚠️ Click attempt ${i + 1} failed:`, clickError.message);
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
      return buttons.slice(0, 20).map(btn => ({
        text: btn.textContent?.trim().substring(0, 50),
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className.substring(0, 100),
        dataControl: btn.getAttribute('data-control-name'),
        id: btn.id,
        visible: btn.offsetParent !== null
      }));
    });
    
    console.log(`📋 Found ${buttonInfo.length} buttons on page:`);
    buttonInfo.forEach((btn, idx) => {
      if (btn.text?.toLowerCase().includes('connect') || 
          btn.text?.toLowerCase().includes('more') ||
          btn.ariaLabel?.toLowerCase().includes('connect') ||
          btn.ariaLabel?.toLowerCase().includes('more')) {
        console.log(`  🎯 POTENTIAL: Button ${idx + 1}:`, JSON.stringify(btn));
      }
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
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📤 INVITE ${i + 1}/${leads.length}: Processing ${lead.name}`);
      console.log(`🔗 Navigating to: ${lead.url}`);
      console.log(`${'='.repeat(60)}`);
      
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
      
      // Find Connect button (tries direct button first, then dropdown)
      const connectButton = await findConnectButton(page);
      
      if (!connectButton) {
        // Debug: Inspect all buttons
        await inspectPageButtons(page);
        
        // No Connect button found anywhere
        console.log(`❌ NO CONNECT BUTTON: ${lead.name}`);
        results.failed++;
        results.errors.push({ leadId: lead.id, name: lead.name, error: 'Connect button not found (direct or dropdown)' });
        await updateLeadStatus(campaignId, lead.id, 'failed', false);
        continue;
      }

      // Take screenshot before clicking
      const beforeClickPath = `./debug-before-click-${lead.id}-${Date.now()}.png`;
      await page.screenshot({ path: beforeClickPath, fullPage: false });
      console.log(`📸 Before-click screenshot: ${beforeClickPath}`);

      // Click Connect button
      const clickSuccess = await clickConnectButton(connectButton, page);
      
      if (!clickSuccess) {
        results.failed++;
        results.errors.push({ 
          leadId: lead.id, 
          name: lead.name, 
          error: 'Failed to click Connect button' 
        });
        continue;
      }
      
      // Wait for modal to appear
      await page.waitForTimeout(3000);
      
      // Take screenshot AFTER clicking to see if modal appeared
      const modalScreenshotPath = `./debug-modal-${lead.id}-${Date.now()}.png`;
      await page.screenshot({ path: modalScreenshotPath, fullPage: true });
      console.log(`📸 Modal screenshot: ${modalScreenshotPath}`);
      
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

      // Rate limiting: 3 seconds between invites
      if (i < leads.length - 1) {
        console.log(`⏱️ Waiting 3 seconds before next invite...`);
        await page.waitForTimeout(3000);
      }

    } catch (error) {
      console.error(`❌ Failed to process ${lead.name}:`, error.message);
      results.failed++;
      results.errors.push({ leadId: lead.id, name: lead.name, error: error.message });
      await updateLeadStatus(campaignId, lead.id, 'failed', false);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 INVITE PROCESSING COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Sent: ${results.sent}`);
  console.log(`   Already Connected: ${results.alreadyConnected}`);
  console.log(`   Already Pending: ${results.alreadyPending}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`${'='.repeat(60)}\n`);

  return results;
}