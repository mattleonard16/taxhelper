/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');

async function testPriorityBadges() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Go to transactions page
    await page.goto('http://localhost:3000/transactions');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'priority-badges-full.png' });
    
    // Check if priority badges are visible
    const priorityBadges = await page.locator('[data-testid="transactions-list"] .badge').count();
    console.log(`Found ${priorityBadges} badges in transaction list`);
    
    // Check specific priority colors
    if (priorityBadges > 0) {
      // Look for HIGH priority badge (red)
      const highPriority = await page.locator('[data-testid="transactions-list"] .badge:has-text("HIGH")').count();
      console.log(`Found ${highPriority} HIGH priority badges`);
      
      // Look for MEDIUM priority badge (yellow)
      const mediumPriority = await page.locator('[data-testid="transactions-list"] .badge:has-text("MEDIUM")').count();
      console.log(`Found ${mediumPriority} MEDIUM priority badges`);
      
      // Look for LOW priority badge (gray)
      const lowPriority = await page.locator('[data-testid="transactions-list"] .badge:has-text("LOW")').count();
      console.log(`Found ${lowPriority} LOW priority badges`);
      
      // Check if the badges have the correct styling
      const highBadgeStyle = await page.locator('[data-testid="transactions-list"] .badge:has-text("HIGH")').first().getAttribute('class');
      const mediumBadgeStyle = await page.locator('[data-testid="transactions-list"] .badge:has-text("MEDIUM")').first().getAttribute('class');
      const lowBadgeStyle = await page.locator('[data-testid="transactions-list"] .badge:has-text("LOW")').first().getAttribute('class');
      
      console.log('HIGH badge classes:', highBadgeStyle);
      console.log('MEDIUM badge classes:', mediumBadgeStyle);
      console.log('LOW badge classes:', lowBadgeStyle);
      
      // Check if priority is visible without hovering
      const badgeVisibility = await page.locator('[data-testid="transactions-list"] .badge').first().isVisible();
      console.log('Priority badge is visible without hover:', badgeVisibility);
    }
    
    // Check table headers to see if Priority column exists
    const priorityHeader = await page.locator('th:has-text("Priority")').count();
    console.log(`Priority column header found: ${priorityHeader > 0}`);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    await browser.close();
  }
}

testPriorityBadges();
