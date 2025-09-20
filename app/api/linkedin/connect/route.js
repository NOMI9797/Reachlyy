import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import LinkedInSessionManager from '@/libs/linkedin-session';
import { withAuth } from "@/libs/auth-middleware";

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

// URL patterns for different LinkedIn pages
const LINKEDIN_PATTERNS = {
  SUCCESS: [
    'linkedin.com/feed',
    'linkedin.com/in/',
    'linkedin.com/mynetwork/',
    'linkedin.com/messaging/',
    'linkedin.com/notifications/'
  ],
  INTERMEDIATE: [
    'linkedin.com/checkpoint/',
    'linkedin.com/challenge/',
    'linkedin.com/uas/challenge/',
    'linkedin.com/checkpoint/challenge/',
    'linkedin.com/checkpoint/verify-',
    'linkedin.com/checkpoint/challenge/'
  ],
  LOGIN: [
    'linkedin.com/login',
    'linkedin.com/uas/login'
  ]
};

// Helper function to check if URL matches any pattern
function urlMatchesPatterns(url, patterns) {
  return patterns.some(pattern => url.includes(pattern));
}

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
    console.log('💡 Note: If LinkedIn asks for OTP/2FA verification, please complete it in the browser window.');
    console.log('⏰ The system will wait up to 10 minutes for you to complete the login process.');
    
    // Wait for user to complete login with better handling of OTP and intermediate pages
    try {
      let loginCompleted = false;
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes with 5-second intervals
      
      while (!loginCompleted && attempts < maxAttempts) {
        // Double-check if login is already completed
        if (loginCompleted) {
          console.log('🛑 Login already completed, exiting loop...');
          break;
        }
        
        const currentUrl = await page.url();
        console.log(`🔍 Checking login status... (${attempts + 1}/${maxAttempts}) - Current URL: ${currentUrl}`);
        
        // Check for successful login pages
        const isSuccessPage = urlMatchesPatterns(currentUrl, LINKEDIN_PATTERNS.SUCCESS);
        
        // Check for intermediate pages that we should wait for (OTP, 2FA, etc.)
        const isIntermediatePage = urlMatchesPatterns(currentUrl, LINKEDIN_PATTERNS.INTERMEDIATE);
        
        // Check if we're back on login page (user might have cancelled)
        const isLoginPage = urlMatchesPatterns(currentUrl, LINKEDIN_PATTERNS.LOGIN);
        
        if (isSuccessPage) {
          console.log('✅ LinkedIn login successful!');
          loginCompleted = true;
          console.log('🛑 Exiting login detection loop...');
          break; // Exit the loop immediately
        } else if (isIntermediatePage) {
          console.log('⏳ User is on intermediate page (OTP/verification), waiting...');
          console.log('📱 Please complete the verification process in the browser window.');
          // Wait 5 seconds before checking again
          await page.waitForTimeout(5000);
        } else if (isLoginPage && attempts > 10) {
          // If we're back on login page after some attempts, user might have cancelled
          console.log('⚠️ User appears to have cancelled login (back on login page)');
          throw new Error('USER_CANCELLED');
        } else {
          // Wait 5 seconds before checking again
          await page.waitForTimeout(5000);
        }
        
        attempts++;
      }
      
      if (!loginCompleted) {
        console.log('⚠️ Login timeout after 10 minutes');
        throw new Error('USER_CANCELLED');
      }
      
      console.log('🎉 Login process completed successfully!');
      
    } catch (error) {
      if (error.message === 'USER_CANCELLED') {
        throw error;
      }
      console.log('⚠️ Login error:', error.message);
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

export const POST = withAuth(async (request, { user }) => {
  try {
    console.log('🚀 Starting LinkedIn connection process...');
    
    // Generate unique session ID
    const sessionId = uuidv4();
    
    try {
      // Connect via browser
      const sessionData = await connectLinkedInViaBrowser(sessionId);

      // Save session data with extracted profile info
      const savedSession = await sessionManager.saveSession(
        sessionId, 
        sessionData.userName, // Using userName as email for now, you might want to extract actual email
        sessionData.cookies, 
        sessionData.localStorage, 
        sessionData.sessionStorage, 
        sessionData.profileImageUrl, 
        sessionData.userName,
        user.id // Pass user ID for database storage
      );
      
      console.log('💾 Session data saved successfully');

      return NextResponse.json({
        success: true,
        message: 'LinkedIn account connected successfully',
        sessionId,
        accountId: savedSession.id
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
});
