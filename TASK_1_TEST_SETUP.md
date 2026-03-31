# 🧪 TASK 1 - Test Setup Guide

## Problem
```
Cannot find module '@testing-library/react-native' or its corresponding type declarations.
```

## Solution

### Step 1: Install Testing Dependencies

Run this command in the `front` directory:

```bash
cd front
npm install --save-dev @testing-library/react-native@^12.4.3 @testing-library/jest-native@^5.4.3 react-test-renderer@18.3.1
```

Or if you prefer yarn:

```bash
cd front
yarn add -D @testing-library/react-native@^12.4.3 @testing-library/jest-native@^5.4.3 react-test-renderer@18.3.1
```

### Step 2: Verify Installation

Check that the dependencies are added to `package.json`:

```json
"devDependencies": {
  "@testing-library/react-native": "^12.4.3",
  "@testing-library/jest-native": "^5.4.3",
  "react-test-renderer": "18.3.1",
  // ... other deps
}
```

### Step 3: Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- useProfileCompletion.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

---

## Files Created

1. ✅ `front/jest.config.js` - Jest configuration
2. ✅ `front/jest.setup.js` - Test setup with mocks
3. ✅ `front/package.json` - Updated with test dependencies

---

## What Was Added

### jest.config.js
- Preset: `jest-expo`
- Setup file: `jest.setup.js`
- Transform ignore patterns for React Native modules
- Coverage collection settings
- Test match patterns

### jest.setup.js
- Mock for `expo-router`
- Mock for `expo-haptics`
- Mock for React Native Animated
- Console warning/error suppression in tests

### package.json
- `@testing-library/react-native`: React Native testing utilities
- `@testing-library/jest-native`: Custom matchers for Jest
- `react-test-renderer`: Required peer dependency

---

## Troubleshooting

### Issue: Tests still failing after installation

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules
rm package-lock.json
npm install
npm test
```

### Issue: Module not found errors

**Solution:**
```bash
# Clear Jest cache
npm test -- --clearCache

# Then run tests again
npm test
```

### Issue: Transform errors

**Solution:**
Make sure `jest.config.js` has the correct `transformIgnorePatterns` for all Expo and React Native modules.

---

## Expected Test Output

After running `npm test`, you should see:

```
PASS  hooks/__tests__/useProfileCompletion.test.ts
  useProfileCompletion Hook
    ✓ should not create infinite loop (XXms)
    ✓ should cleanup properly on unmount (XXms)
    ✓ should stop retrying after max retries (XXms)
    ✓ should abort pending requests on unmount (XXms)
    ✓ should debounce rapid refresh calls (XXms)
    ✓ should trigger loop safeguard after max iterations (XXms)
    ✓ should respect fetch cooldown (XXms)
    ✓ should mark step as completed successfully (XXms)
    ✓ should handle unauthenticated state gracefully (XXms)
    ✓ should timeout long-running requests (XXms)
  useProfileCompletion Helper Functions
    ✓ isStepCompleted should work correctly (XXms)
    ✓ getStep should return correct step (XXms)
    ✓ getMissingRequiredSteps should return correct steps (XXms)
    ✓ canUploadVideo should work correctly (XXms)

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

---

## Quick Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test
npm test -- useProfileCompletion

# Clear cache
npm test -- --clearCache
```

---

## Next Steps

After tests pass:
1. ✅ Verify all 14 tests pass
2. ✅ Check coverage report
3. ✅ Integrate hook into ProfileScreen
4. ✅ Test manually in app

---

**Created**: March 30, 2026  
**Author**: Kiro AI Assistant
