import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import LinkedInSessionManager from '@/libs/linkedin-session';

// ---------- Anti-Detection Utilities ----------
function randomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanLikeDelay(page, min = 1500, max = 4000) {
  const delay = randomDelay(min, max);
  await page.waitForTimeout(delay);
}

async function simulateHumanBehavior(page) {
  // Random mouse movement
  const x = Math.random() * 800 + 200;
  const y = Math.random() * 400 + 200;
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
  
  // Random scroll
  if (Math.random() > 0.5) {
    await page.mouse.wheel(0, Math.random() * 200 - 100);
  }
  
  await page.waitForTimeout(randomDelay(500, 1500));
}

// Initialize session manager
const sessionManager = new LinkedInSessionManager();

// Browser-based LinkedIn connection
async function connectLinkedInViaBrowser(sessionId) {
  console.log('🚀 Starting browser-based LinkedIn connection...');
  
  // Launch visible browser for user interaction
  const context = await chromium.launchPersistentContext(
    path.join(process.cwd(), 'linkedin-browser-profiles', sessionId),
    {
      headless: false, // Show browser window for user interaction
      slowMo: 1000,
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  );

  const page = context.pages()[0] || await context.newPage();

  try {
    console.log('🌐 Opening LinkedIn login page...');
    await page.goto('https://www.linkedin.com/login');
    await page.waitForLoadState('domcontentloaded');
    await humanLikeDelay(page, 2000, 4000);
    await simulateHumanBehavior(page);

    console.log('👤 Waiting for user to complete LinkedIn login...');
    console.log('📝 Please log in to your LinkedIn account in the browser window...');
    
    // Wait for user to complete login - check for successful navigation
    try {
      await page.waitForFunction(() => {
        const currentUrl = window.location.href;
        return currentUrl.includes('linkedin.com/feed') || 
               currentUrl.includes('linkedin.com/in/') ||
               currentUrl.includes('linkedin.com/mynetwork/');
      }, { timeout: 600000 }); // 10 minutes timeout for user to complete login
      
      console.log('✅ LinkedIn login successful!');
      
    } catch (error) {
      console.log('⚠️ Login timeout or user cancelled');
      throw new Error('USER_CANCELLED');
    }

    // Wait a bit for the page to fully load
    await humanLikeDelay(page, 2000, 4000);

    // Extract user profile information
    let userName = 'browser-login'; // Default fallback
    let profileImageUrl = null;

    try {
      console.log('👤 Extracting user profile information...');
      
      // Try to open the Me dropdown to get profile info
      const meButton = page.locator('#global-nav button[aria-label*="Me" i], #global-nav button:has-text("Me")').first();
      await meButton.waitFor({ state: 'visible', timeout: 10000 });
      await meButton.click();

      // Wait for profile card to appear
      await page.waitForTimeout(2000);

      // Extract name
      const nameLocator = page.locator('.profile-card-name').first();
      if (await nameLocator.isVisible().catch(() => false)) {
        userName = (await nameLocator.innerText()).trim();
      } else {
        // Try alternative selectors
        const altName = page.locator('#global-nav :is(h3.profile-card-name, .profile-card-name)').first();
        if (await altName.isVisible().catch(() => false)) {
          userName = (await altName.innerText()).trim();
        }
      }

      // Extract profile image
      const imgLocator = page.locator('img.profile-card-profile-picture').first();
      if (await imgLocator.isVisible().catch(() => false)) {
        const src = await imgLocator.getAttribute('src');
        if (src && /^https?:\/\//.test(src)) {
          profileImageUrl = src;
        }
      } else {
        // Try alternative image selectors
        const altImg = page.locator('#global-nav img[alt^="Photo of "]').first();
        if (await altImg.isVisible().catch(() => false)) {
          const src = await altImg.getAttribute('src');
          if (src && /^https?:\/\//.test(src)) {
            profileImageUrl = src;
          }
        }
      }

      console.log(`👤 Extracted name: ${userName}`);
      console.log(`🖼️ Profile image: ${profileImageUrl || 'Not found'}`);

    } catch (error) {
      console.log('⚠️ Could not extract profile info, using defaults');
    }

    // Get session data
    const cookies = await context.cookies();
    const localStorage = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        storage[key] = window.localStorage.getItem(key);
      }
      return storage;
    });

    const sessionStorage = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        storage[key] = window.sessionStorage.getItem(key);
      }
      return storage;
    });

    // Close browser context
    await context.close();
    
    return { 
      cookies, 
      localStorage, 
      sessionStorage, 
      userName, 
      profileImageUrl 
    };

  } catch (error) {
    // Clean up on error
    await context.close();
    throw error;
  }
}

export async function POST() {
  try {
    console.log('🚀 Starting LinkedIn connection process...');
    
    // Generate unique session ID
    const sessionId = uuidv4();
    
    try {
      // Connect via browser
      const sessionData = await connectLinkedInViaBrowser(sessionId);

      // Save session data with extracted profile info
      const sessionFile = sessionManager.saveSession(sessionId, sessionData.userName, sessionData.cookies, sessionData.localStorage, sessionData.sessionStorage, sessionData.profileImageUrl, sessionData.userName);
      
      console.log('💾 Session data saved successfully');

      return NextResponse.json({
        success: true,
        message: 'LinkedIn account connected successfully',
        sessionId,
        sessionFile: path.basename(sessionFile)
      });

    } catch (error) {
      console.error('❌ Error during LinkedIn connection:', error.message);
      
      // Handle specific error types
      if (error.message === 'USER_CANCELLED') {
        return NextResponse.json(
          { 
            error: 'USER_CANCELLED',
            message: 'LinkedIn login was cancelled or timed out. Please try again.'
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { 
          error: 'CONNECTION_ERROR',
          message: error.message || 'Failed to connect to LinkedIn'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
      },
      { status: 500 }
    );
  }
}
