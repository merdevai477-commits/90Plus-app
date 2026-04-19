# 🧪 Testing Guide

## Overview

This document outlines the testing strategy, tools, and best practices for the 90Plus mobile application.

## Testing Stack

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing
- **fast-check**: Property-based testing
- **@testing-library/react-hooks**: Hook testing

## Test Structure

```
front/
├── __tests__/                    # Integration & E2E tests
│   ├── integration.*.test.ts
│   ├── *.property.test.ts
│   └── *.bugCondition.test.ts
│
├── services/__tests__/           # Service tests
│   └── *.test.ts
│
├── hooks/__tests__/              # Hook tests
│   └── *.test.ts
│
└── components/__tests__/         # Component tests
    └── *.test.tsx
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### Specific Test File

```bash
npm test -- authService.test.ts
```

## Test Types

### 1. Unit Tests

Test individual functions and utilities in isolation.

```typescript
// services/__tests__/authService.test.ts
import { AuthService } from '../authService';

describe('AuthService', () => {
  describe('login', () => {
    it('should return user on successful login', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const user = await AuthService.login(credentials);
      
      expect(user).toBeDefined();
      expect(user.email).toBe(credentials.email);
    });
    
    it('should throw error on invalid credentials', async () => {
      const credentials = {
        email: 'invalid@example.com',
        password: 'wrong'
      };
      
      await expect(AuthService.login(credentials))
        .rejects
        .toThrow('Invalid credentials');
    });
  });
});
```

### 2. Component Tests

Test React components with React Testing Library.

```typescript
// components/__tests__/VideoCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { VideoCard } from '../VideoCard';

describe('VideoCard', () => {
  const mockVideo = {
    id: '1',
    title: 'Test Video',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: 30
  };
  
  it('should render video information', () => {
    const { getByText } = render(<VideoCard video={mockVideo} />);
    
    expect(getByText('Test Video')).toBeTruthy();
  });
  
  it('should call onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <VideoCard video={mockVideo} onPress={onPress} />
    );
    
    fireEvent.press(getByTestId('video-card'));
    
    expect(onPress).toHaveBeenCalledWith(mockVideo.id);
  });
});
```

### 3. Hook Tests

Test custom hooks with @testing-library/react-hooks.

```typescript
// hooks/__tests__/useMatchesData.test.ts
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { useMatchesData } from '../useMatchesData';

describe('useMatchesData', () => {
  it('should fetch matches for given date', async () => {
    const { result } = renderHook(() => 
      useMatchesData('2024-01-15')
    );
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.matches).toBeDefined();
    expect(result.current.matches.length).toBeGreaterThan(0);
  });
  
  it('should handle errors gracefully', async () => {
    // Mock API to return error
    jest.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Network error')
    );
    
    const { result } = renderHook(() => 
      useMatchesData('2024-01-15')
    );
    
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    
    expect(result.current.error.message).toBe('Network error');
  });
});
```

### 4. Integration Tests

Test complete user flows and feature interactions.

```typescript
// __tests__/integration.authentication.test.ts
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { App } from '../App';

describe('Authentication Flow', () => {
  it('should complete full login flow', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    
    // Navigate to login
    fireEvent.press(getByText('Login'));
    
    // Fill in credentials
    fireEvent.changeText(
      getByPlaceholderText('Email'),
      'test@example.com'
    );
    fireEvent.changeText(
      getByPlaceholderText('Password'),
      'password123'
    );
    
    // Submit
    fireEvent.press(getByText('Sign In'));
    
    // Wait for navigation to home
    await waitFor(() => {
      expect(getByText('Welcome')).toBeTruthy();
    });
  });
});
```

### 5. Property-Based Tests

Test with randomly generated inputs using fast-check.

```typescript
// __tests__/videoOperations.property.test.ts
import fc from 'fast-check';
import { isValidDuration } from '../utils/video';

describe('Video Duration Validation', () => {
  it('should accept valid durations (5-60 seconds)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 60 }),
        (duration) => {
          expect(isValidDuration(duration)).toBe(true);
        }
      )
    );
  });
  
  it('should reject invalid durations', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: 4 }),
          fc.integer({ min: 61 })
        ),
        (duration) => {
          expect(isValidDuration(duration)).toBe(false);
        }
      )
    );
  });
});
```

## Mocking

### API Calls

```typescript
// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  })
) as jest.Mock;

// Reset after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

### Expo Modules

```typescript
// __mocks__/expo-constants.ts
export default {
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:3000/api',
      clerkPublishableKey: 'pk_test_mock',
    }
  }
};
```

### AsyncStorage

```typescript
// __mocks__/asyncStorage.ts
const storage: Record<string, string> = {};

export default {
  getItem: jest.fn((key) => Promise.resolve(storage[key])),
  setItem: jest.fn((key, value) => {
    storage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete storage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(storage).forEach(key => delete storage[key]);
    return Promise.resolve();
  }),
};
```

## Test Coverage Goals

| Category | Current | Target |
|----------|---------|--------|
| Services | 40% | 80% |
| Hooks | 30% | 70% |
| Components | 20% | 60% |
| Utils | 50% | 90% |
| Overall | 35% | 70% |

## Best Practices

### 1. Test Naming

```typescript
// ✅ Good: Descriptive test names
it('should display error message when login fails', () => {});

// ❌ Bad: Vague test names
it('test login', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should add coins to user balance', () => {
  // Arrange
  const initialBalance = 100;
  const coinsToAdd = 50;
  
  // Act
  const newBalance = addCoins(initialBalance, coinsToAdd);
  
  // Assert
  expect(newBalance).toBe(150);
});
```

### 3. Test Independence

```typescript
// ✅ Good: Each test is independent
describe('UserService', () => {
  beforeEach(() => {
    // Reset state before each test
    jest.clearAllMocks();
  });
  
  it('test 1', () => {});
  it('test 2', () => {});
});

// ❌ Bad: Tests depend on each other
describe('UserService', () => {
  let user;
  
  it('should create user', () => {
    user = createUser(); // Sets shared state
  });
  
  it('should update user', () => {
    updateUser(user); // Depends on previous test
  });
});
```

### 4. Avoid Testing Implementation Details

```typescript
// ✅ Good: Test behavior
it('should display user name', () => {
  const { getByText } = render(<UserProfile user={mockUser} />);
  expect(getByText('John Doe')).toBeTruthy();
});

// ❌ Bad: Test implementation
it('should call useState', () => {
  const spy = jest.spyOn(React, 'useState');
  render(<UserProfile user={mockUser} />);
  expect(spy).toHaveBeenCalled();
});
```

### 5. Use Test IDs Sparingly

```typescript
// ✅ Good: Query by text/role when possible
const button = getByText('Submit');
const heading = getByRole('heading');

// ⚠️ OK: Use testID when necessary
const complexElement = getByTestId('video-player');
```

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test -- --coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Debugging Tests

### Run Single Test

```bash
npm test -- -t "should login successfully"
```

### Debug in VS Code

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Output

```bash
npm test -- --verbose
```

## Common Issues

### 1. Async Tests Timing Out

```typescript
// ✅ Increase timeout for slow tests
it('should fetch large dataset', async () => {
  // ...
}, 10000); // 10 second timeout
```

### 2. Mock Not Working

```typescript
// ✅ Ensure mock is hoisted
jest.mock('../service', () => ({
  fetchData: jest.fn()
}));

// Then use in test
import { fetchData } from '../service';
```

### 3. State Not Updating

```typescript
// ✅ Use waitFor for async updates
await waitFor(() => {
  expect(result.current.data).toBeDefined();
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [fast-check Documentation](https://fast-check.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Next Steps

1. ✅ Set up test infrastructure
2. ⏳ Write component tests (Target: 60% coverage)
3. ⏳ Write hook tests (Target: 70% coverage)
4. ⏳ Add E2E tests with Detox/Maestro
5. ⏳ Set up CI/CD pipeline
6. ⏳ Add visual regression tests
