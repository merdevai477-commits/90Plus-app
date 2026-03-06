---
inclusion: always
---

# Development Conventions & Best Practices

## Decision Hierarchy

When making implementation decisions, follow this priority order:

1. **Security > Performance > Readability**
   - Never compromise security for speed or convenience
   - Optimize performance without sacrificing code clarity
   - Write readable code that others can maintain

2. **Correctness > Speed of Implementation**
   - Take time to implement features properly
   - Verify logic and edge cases before committing
   - Don't rush at the expense of quality

3. **Simplicity > Over-engineering**
   - Choose the simplest solution that meets requirements
   - Avoid premature optimization and abstraction
   - YAGNI (You Aren't Gonna Need It) principle applies

## Code Generation Rules

### Always Include
- DTOs with validation decorators (class-validator)
- Proper error handling in all controller methods
- Complete code snippets (no placeholders or TODOs)
- Type definitions for all function parameters and returns

### Never Generate
- Incomplete code that won't compile/run
- Code without error handling
- Unvalidated user inputs
- Hardcoded sensitive data

### When Uncertain
- **Missing context** → Ask for clarification before coding
- **Library version unknown** → Assume latest stable version
- **Database schema unclear** → Ask before generating queries
- **Business logic ambiguous** → Request specification details

## Refactor Protocol

### Preservation Rules
- Always preserve public API contracts when refactoring
- Maintain backward compatibility unless explicitly instructed otherwise
- Never remove functionality without explicit user instruction
- Document breaking changes clearly if unavoidable

### Safety Requirements
- Add tests when modifying business logic
- Run existing tests to verify no regressions
- Update related documentation and comments
- Consider impact on dependent code

## Failure Behavior

When encountering uncertainty:

1. **Implementation Details Unclear** → Ask for clarification, don't guess
2. **Multiple Valid Approaches** → Present options with trade-offs
3. **Potential Breaking Changes** → Warn user and request confirmation
4. **Missing Dependencies** → Identify and request installation approval
5. **Schema/Type Mismatches** → Request schema review before proceeding

## Architectural Awareness

### Architecture Alignment
- **Respect existing structure** - Follow established folder organization and naming conventions
- **Follow existing patterns** - Use patterns already present in the codebase before introducing new ones
- **Minimize dependencies** - Avoid adding new packages unless necessary; use existing libraries
- **Justify new patterns** - When introducing new architectural patterns, explain why and document the decision

### Pattern Consistency
- Check similar features for implementation patterns
- Maintain consistency in error handling approaches
- Use established service/controller/middleware patterns
- Follow existing state management strategies (Zustand for global, React Query for server state)

## Output Format Requirements

When providing solutions, always structure responses as:

1. **Brief Explanation** (2-3 sentences)
   - What the solution does
   - Why this approach was chosen

2. **Full Working Code**
   - Complete, runnable implementation
   - No placeholders or incomplete sections
   - Proper imports and exports

3. **Breaking Changes** (if any)
   - List any API changes
   - Migration steps required
   - Affected components/services

4. **Environment Variables** (if needed)
   - New variables to add to `.env`
   - Example values
   - Where to obtain values (API keys, etc.)

5. **New Dependencies** (if any)
   - Package names and versions
   - Installation command
   - Justification for addition

## Error Code Standards

All API errors must use standardized error codes for consistency:

| Code | Category | Meaning |
|------|----------|---------|
| E001 | Validation | Input validation failed |
| E002 | Authentication | Authentication failed or token expired |
| E003 | Authorization | Insufficient permissions (RBAC) |
| E004 | Not Found | Requested resource does not exist |
| E005 | Conflict | Resource already exists or state conflict |
| E006 | Rate Limit | Too many requests, rate limit exceeded |
| E007 | File Upload | Invalid file type, size, or content |
| E008 | External Service | Third-party API failure (Clerk, Supabase, etc.) |
| E009 | Database | Database operation failed |
| E010 | Internal | Unhandled internal server error |

### Error Code Usage
- Always use the appropriate error code in API responses
- Include descriptive messages alongside error codes
- Log the full eensive operations** - Search inputs, API calls, animations
- **Optimize images and videos** - Compress, use appropriate formats, lazy load

## Code Style & Quality

### TypeScript
- Use strict TypeScript with explicit types; avoid `any` unless absolutely necessary 
- Prefer interfaces for object shapes, types for unions/intersections
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer code
- Export types alongside implementations for better reusability

### Error Handling
- Always wrap async operations in try-catch blocks
- Return meaningful error messages with appropriate HTTP status codes
- Log errors with context (user ID, request ID, operation) for debugging
- Use custom error classes for domain-specific errors

### Performance
- Implement caching at multiple layers (Redis for backend, React Query for frontend)
- Use pagination for list endpoints (default: 20 items per page)
- Optimize database queries with proper indexes and select statements
- Lazy load components and data where appropriate
- Debounce search inputs and expensive operations

## Backend Development

### API Design
- Follow RESTful conventions: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
- Use plural nouns for resource endpoints: `/api/users`, `/api/reels`
- Version APIs when making breaking changes: `/api/v2/...`
- Return consistent response structures across all endpoints
- Include pagination metadata: `{ data: [], total, page, limit }`

### Security
- Always validate and sanitize user inputs using class-validator
- Apply rate limiting to prevent abuse (stricter on auth endpoints)
- Use Clerk middleware for authentication on protected routes
- Implement RBAC (Role-Based Access Control) for admin/developer features
- Never expose sensitive data (passwords, tokens, internal IDs) in responses
- Validate file uploads: type, size, dimensions, duration

### Database
- Use Prisma transactions for operations affecting multiple tables
- Create indexes for frequently queried fields (username, email, foreign keys)
- Use soft deletes for user-generated content (add `deletedAt` field)
- Implement cascading deletes carefully to maintain referential integrity
- Run migrations in development, never modify schema.prisma directly in production

### Caching Strategy
- Cache expensive operations (API calls, complex queries) in Redis
- Set appropriate TTL based on data volatility (matches: 1min, user profiles: 5min)
- Invalidate cache on data mutations (create, update, delete)
- Use cache keys with namespaces: `user:${userId}`, `match:${matchId}`

## Frontend Development

### Component Design
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Use composition over prop drilling (Context for global state)
- Implement loading states, error boundaries, and empty states
- Optimize re-renders with `React.memo`, `useMemo`, `useCallback`

### State Management
- Use Zustand for complex global state (user preferences, app settings)
- Use React Query for server state (API data, caching, refetching)
- Use local state (useState) for UI-only state (modals, form inputs)
- Avoid prop drilling beyond 2-3 levels; use Context or Zustand instead

### Navigation
- Use expo-router for all navigation (file-based routing)
- Implement deep linking for shareable content (reels, profiles, matches)
- Handle navigation guards for authentication (redirect to login if needed)
- Use typed navigation params for type safety

### Internationalization
- Always use translation keys, never hardcode text
- Support RTL (Right-to-Left) for Arabic language
- Format dates, numbers, and currencies based on locale
- Test UI with longest translations (German) to catch layout issues

### Performance Optimization
- Use FlatList/FlashList for long lists with proper keyExtractor
- Implement virtualization for large datasets
- Optimize images: compress, use appropriate formats (WebP), lazy load
- Preload critical data on app launch
- Use React Native Reanimated for smooth 60fps animations

## Testing

### Property-Based Testing
- Write property tests for critical business logic (coins, predictions, quiz scoring)
- Use fast-check to generate test cases automatically
- Define invariants that must always hold (e.g., coin balance never negative)
- Test edge cases: empty inputs, max values, concurrent operations

### Unit Testing
- Test pure functions and utilities thoroughly
- Mock external dependencies (API calls, database, Redis)
- Test error paths, not just happy paths
- Aim for high coverage on business logic, not boilerplate

### Integration Testing
- Test API endpoints end-to-end with real database (test environment)
- Verify authentication and authorization flows
- Test rate limiting and validation rules
- Clean up test data after each test run

## Git & Deployment

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Be descriptive: "fix: prevent crash when video duration is zero"
- Reference issues/tickets when applicable: "fix: #123 video upload timeout"

### Branch Strategy
- Main branch: production-ready code
- Feature branches: `feature/user-authentication`, `fix/video-upload-bug`
- Merge via pull requests with code review
- Run tests before merging

### Deployment
- Backend: Railway auto-deploys from main branch
- Frontend: Use EAS Build for production releases
- Test in staging environment before production
- Monitor error rates and performance metrics post-deployment

## Common Pitfalls to Avoid

- Don't fetch data in loops; batch requests or use joins
- Don't store large files in database; use Supabase/R2 storage
- Don't expose internal implementation details in API responses
- Don't skip input validation on backend (never trust client)
- Don't hardcode configuration; use environment variables
- Don't ignore TypeScript errors; fix them properly
- Don't block the main thread with heavy computations
- Don't forget to handle offline scenarios in mobile app

## Debugging Tips

- Use Prisma Studio to inspect database state
- Check Redis cache with `redis-cli` or GUI tools
- Monitor API logs with Winston for request/response details
- Use React Native Debugger for frontend state inspection
- Test WebSocket connections with socket.io client tools
- Use Expo Dev Tools for performance profiling

## Error Code Standards

All API errors must use standardized error codes for consistency:

| Code | Category | Meaning |
|------|----------|---------|
| E001 | Validation | Input validation failed |
| E002 | Authentication | Authentication failed or token expired |
| E003 | Authorization | Insufficient permissions (RBAC) |
| E004 | Not Found | Requested resource does not exist |
| E005 | Conflict | Resource already exists or state conflict |
| E006 | Rate Limit | Too many requests, rate limit exceeded |
| E007 | File Upload | Invalid file type, size, or content |
| E008 | External Service | Third-party API failure (Clerk, Supabase, etc.) |
| E009 | Database | Database operation failed |
| E010 | Internal | Unhandled internal server error |

### Error Response Format
```typescript
{
  error: string,           // Error code (E001-E010)
  message: string,         // User-friendly message
  details?: any,           // Additional context (validation errors, etc.)
  timestamp: string,       // ISO 8601 timestamp
  path: string            // Request path
}
```

### Error Handling Best Practices
- Always use the appropriate error code in API responses
- Include descriptive messages alongside error codes
- Log the full error stack trace server-side for debugging
- Never expose sensitive information in error messages
- Return appropriate HTTP status codes (400, 401, 403, 404, 409, 429, 500)

## Validation Standards

### Backend Validation (class-validator)
```typescript
import { IsString, IsEmail, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
```

### Common Validation Rules
- **Username**: 3-20 characters, alphanumeric + underscore
- **Email**: Valid email format, max 255 characters
- **Password**: Min 8 characters (handled by Clerk)
- **Bio**: Max 500 characters
- **Video duration**: 5-60 seconds
- **Video size**: Max 100MB
- **Image size**: Max 10MB
- **Hashtags**: Max 10 per reel, 2-30 characters each

## Security Checklist

Before deploying any feature, verify:

- [ ] All user inputs are validated and sanitized
- [ ] Authentication middleware applied to protected routes
- [ ] RBAC checks for admin/developer-only features
- [ ] Rate limiting configured appropriately
- [ ] Sensitive data not exposed in responses or logs
- [ ] File uploads validated (type, size, content)
- [ ] SQL injection prevented (using Prisma parameterized queries)
- [ ] XSS prevented (sanitize user-generated content)
- [ ] CORS configured correctly
- [ ] Environment variables used for secrets (never hardcoded)

## Monitoring & Observability

### What to Log
- **Info**: Successful operations, user actions, system events
- **Warn**: Recoverable errors, deprecated API usage, rate limit warnings
- **Error**: Failed operations, exceptions, external service failures
- **Debug**: Detailed execution flow (development only)

### What to Monitor
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Redis cache hit/miss rates
- WebSocket connection stability
- Video upload success/failure rates
- User authentication failures
- Rate limit violations

### Logging Best Practices
```typescript
logger.info('User created successfully', {
  userId: user.id,
  username: user.username,
  timestamp: new Date().toISOString()
});

logger.error('Failed to process video', {
  error: error.message,
  stack: error.stack,
  userId: req.userId,
  videoId: videoId,
  timestamp: new Date().toISOString()
});
```

## Mobile-Specific Considerations

### iOS & Android Compatibility
- Test on both platforms; behavior may differ
- Handle platform-specific permissions (camera, storage, notifications)
- Use Platform.OS checks for platform-specific code
- Test on different screen sizes and orientations

### Offline Support
- Implement offline detection with NetInfo
- Cache critical data locally (AsyncStorage, React Query)
- Queue actions when offline, sync when online
- Show appropriate UI for offline state

### Performance on Mobile
- Minimize bundle size (code splitting, tree shaking)
- Optimize images for mobile (WebP, appropriate resolutions)
- Reduce network requests (batch, cache, prefetch)
- Use native modules for performance-critical operations
- Profile with Flipper or React Native Performance Monitor

### Push Notifications
- Request permissions appropriately
- Handle notification taps (deep linking)
- Support both foreground and background notifications
- Test on real devices (simulators have limitations)

## Internationalization (i18n) Guidelines

### Translation Keys
- Use descriptive, hierarchical keys: `screens.home.welcome`
- Keep keys consistent across languages
- Never hardcode user-facing text

### RTL Support (Arabic)
- Use `I18nManager.isRTL` for layout adjustments
- Test all screens in RTL mode
- Use `start`/`end` instead of `left`/`right` in styles
- Mirror icons and images where appropriate

### Date & Number Formatting
```typescript
// Use locale-aware formatting
const formattedDate = new Date().toLocaleDateString(locale);
const formattedNumber = number.toLocaleString(locale);
```

## Code Review Checklist

Before submitting code for review:

- [ ] Code follows existing patterns and conventions
- [ ] All functions have proper TypeScript types
- [ ] Error handling implemented for all async operations
- [ ] Validation added for all user inputs
- [ ] Tests added/updated for new functionality
- [ ] No console.log statements (use logger instead)
- [ ] No commented-out code
- [ ] No hardcoded values (use constants or env variables)
- [ ] Performance considered (no N+1 queries, proper caching)
- [ ] Security reviewed (no vulnerabilities introduced)
- [ ] Documentation updated if needed
- [ ] Breaking changes documented and communicated
     