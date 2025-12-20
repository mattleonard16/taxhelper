---
name: test-fixing
description: Run tests and systematically fix all failing tests using smart error grouping. Use when user asks to fix failing tests, mentions test failures, runs test suite and failures occur, or requests to make tests pass.
---

# Test Fixing

Systematically identify and fix all failing tests using smart grouping strategies.

## When to Use

- Explicitly asks to fix tests ("fix these tests", "make tests pass")
- Reports test failures ("tests are failing", "test suite is broken")
- Completes implementation and wants tests passing
- Mentions CI/CD failures due to tests

## Systematic Approach

### 1. Initial Test Run

Run the project's test command to identify all failing tests.

For this project:
```bash
npm test        # Unit tests (Vitest)
npm run test:e2e # E2E tests (Playwright)
```

Analyze output for:
- Total number of failures
- Error types and patterns
- Affected modules/files

### 2. Smart Error Grouping

Group similar failures by:
- **Error type**: ImportError, TypeError, AssertionError, etc.
- **Module/file**: Same file causing multiple test failures
- **Root cause**: Missing dependencies, API changes, refactoring impacts

Prioritize groups by:
- Number of affected tests (highest impact first)
- Dependency order (fix infrastructure before functionality)

### 3. Systematic Fixing Process

For each group (starting with highest impact):

1. **Identify root cause**
   - Read relevant code
   - Check recent changes with `git diff`
   - Understand the error pattern

2. **Implement fix**
   - Use Edit tool for code changes
   - Follow project conventions
   - Make minimal, focused changes

3. **Verify fix**
   - Run subset of tests for this group
   - Use test file patterns:
     ```bash
     npm test -- src/path/to/test.test.ts
     npx playwright test e2e/specific.spec.ts
     ```
   - Ensure group passes before moving on

4. **Move to next group**

### 4. Fix Order Strategy

**Infrastructure first:**
- Import errors
- Missing dependencies
- Configuration issues

**Then API changes:**
- Function signature changes
- Module reorganization
- Renamed variables/functions

**Finally, logic issues:**
- Assertion failures
- Business logic bugs
- Edge case handling

### 5. Final Verification

After all groups fixed:
- Run complete test suite: `npm test && npm run test:e2e`
- Verify no regressions
- Check test coverage remains intact

## Best Practices

- Fix one group at a time
- Run focused tests after each fix
- Use `git diff` to understand recent changes
- Look for patterns in failures
- Don't move to next group until current passes
- Keep changes minimal and focused
