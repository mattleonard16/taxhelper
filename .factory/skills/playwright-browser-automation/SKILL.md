---
name: playwright-browser-automation
description: Browser automation with Playwright for testing and validation. Use when user asks to test a page, verify UI, take screenshots, check responsive design, fill forms, or validate web functionality. Writes and executes custom automation scripts.
---

# Playwright Browser Automation

Claude Code skill for browser automation with Playwright. Model-invoked - Claude autonomously writes and executes custom automation for testing and validation.

## Features

- **Any Automation Task**: Claude writes custom code for your specific request
- **Visible Browser by Default**: See automation in real-time with `headless: false`
- **Comprehensive Testing**: Visual, interaction, and validation testing

## When to Use

- Test a web page or feature
- Verify UI elements and layouts
- Take screenshots at different viewports
- Check responsive design
- Fill out and submit forms
- Test navigation flows
- Validate form inputs and errors
- Check for broken links or missing images

## Usage Examples

### Test Any Page
```
"Test the homepage"
"Check if the contact form works"
"Verify the signup flow"
```

### Visual Testing
```
"Take screenshots of the dashboard in mobile and desktop"
"Test responsive design across different viewports"
```

### Interaction Testing
```
"Fill out the registration form and submit it"
"Click through the main navigation"
"Test the search functionality"
```

### Validation
```
"Check for broken links"
"Verify all images load"
"Test form validation"
```

## Project Integration

This project uses Playwright for E2E testing:

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/specific.spec.ts

# Run with UI mode
npx playwright test --ui

# Run with headed browser (visible)
npx playwright test --headed

# Generate tests interactively
npx playwright codegen http://localhost:3000
```

## Writing Playwright Tests

```typescript
import { test, expect } from "@playwright/test";

test("example test", async ({ page }) => {
  await page.goto("/");
  
  // Click an element
  await page.click('button[type="submit"]');
  
  // Fill a form
  await page.fill('input[name="email"]', 'test@example.com');
  
  // Assert content
  await expect(page.locator("h1")).toContainText("Welcome");
  
  // Take screenshot
  await page.screenshot({ path: "screenshot.png" });
});
```

## Tips

- Use `data-testid` attributes for reliable selectors
- Use `waitForLoadState("networkidle")` for dynamic content
- Use `test.slow()` for tests that need more time
- Use `test.skip()` for flaky tests in CI
