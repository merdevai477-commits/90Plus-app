---
inclusion: always
---

# Development Conventions

Rules an AI assistant must follow when writing or modifying code in this repository. For folder layout, naming, and where things live, see `structure.md` (this document assumes that structure).

## Decision Hierarchy

Apply in order when rules conflict:

1. **Security > Performance > Readability** — never trade security for speed or convenience.
2. **Correctness > Speed of delivery** — verify edge cases before shipping.
3. **Simplicity > Abstraction** — YAGNI. Use the simplest solution that meets the requirement.
4. **Existing patterns > New patterns** — match the codebase before introducing something new. If a new pattern is needed, justify it in the PR/commit message.

## When Uncertain — Ask, Don't Guess

Ask the user before proceeding when:

- Business logic or acceptance criteria are ambiguous.
- Database schema, API contract, or type is unclear.
- Multiple valid approaches exist with meaningful trade-offs — present options.
- Change would break a public API or existing behavior — warn and confirm.
- A new dependency is needed — request approval and justify.

If a library version is not specified, assume the latest stable version already in `package.json`.

## Code Generation Rules

**Always produce:**

- Complete, runnable code. No placeholders, no `TODO`, no elided sections.
- Explicit TypeScript types on all function parameters, returns, and exported values.
- Input validation (class-validator DTOs on backend, schema validation on frontend forms).
- `try/catch` around every async operation that can fail; propagate structured errors.
- Meaningful error messages with the appropriate error code (see below).

**Never produce:**

- Code with `any` unless there is no alternative (document why in a comment).
- Unvalidated user input reaching a controller, query, or storage call.
- Hardcoded secrets, URLs, or tokens. Use env vars.
- `console.log` in committed code. Use the Winston logger on backend and the app logger on frontend.
- Commented-out code or dead branches.

## Refactor Protocol

- Preserve public API contracts and observable behavior unless the user explicitly requests a breaking change.
- Never remove functionality without explicit instruction.
- Add or update tests for any business-logic change; run the existing suite to confirm no regressions.
- Document breaking changes in the response: list API changes, migration steps, and affected callers.

## TypeScript Style

- Strict mode. Explicit types on exports; inference is fine inside function bodies.
- `interface` for object shapes, `type` for unions, intersections, and mapped types.
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of truthy checks for null/undefined.
- Export types next to the implementation they describe.
- Do not suppress TypeScript errors with `@ts-ignore` or `as any` — fix the type.

## Backend Rules (`src/` at repo root)

- **Layering:** routes → controllers (thin) → services (business logic). Do not put business logic in controllers or middleware.
- **Shared singletons:** import Prisma from `src/lib/prisma.ts`, Redis from `src/lib/redis.ts`. Never instantiate new clients.
- **Routes:** compose middleware on the router (`router.post('/x', clerk, rbac, rateLimit, controller)`). Apply auth, RBAC (for admin/developer routes), and a rate limiter on every mutating or auth-adjacent endpoint.
- **Validation:** every request body, query, and param is validated via a class-validator DTO before reaching the service.
- **Database:**
  - Use Prisma transactions when a write touches multiple tables.
  - Add indexes for any frequently-queried column (username, email, foreign keys).
  - Use soft deletes (`deletedAt`) for user-generated content.
  - Never edit `schema.prisma` without creating a migration. Never edit an applied migration.
- **Caching:** expensive reads go through a `<domain>-cache.service.ts` using Redis with namespaced keys (`user:${userId}`, `match:${matchId}`). Invalidate on every mutation. TTL reflects volatility (live matches ~1min, profiles ~5min).
- **Responses:** success `{ data, message? }`; paginated `{ data, total, page, limit }` (default limit 20); error uses the standard shape below.
- Never expose internal IDs, password hashes, tokens, or stack traces in responses.

## Frontend Rules (`front/`)

- **Navigation:** expo-router only. Do not add another navigation library. Use typed params and implement auth guards where needed.
- **Exports:** screens in `app/` use `export default`; components in `components/` use named exports.
- **State placement:**
  - UI-only → `useState`.
  - Server state → React Query (includes cache + refetch policy).
  - Global app state → Zustand in `front/src/store/`.
  - Cross-cutting providers (language, coins, settings) → `front/contexts/`.
  - Avoid prop drilling beyond 2–3 levels.
- **Components:** single responsibility; extract reusable logic into `use*` hooks; always implement loading, error, and empty states; memoize with `React.memo` / `useMemo` / `useCallback` only where profiling or obvious re-render cost justifies it.
- **Lists:** `FlatList` / `FlashList` with a stable `keyExtractor` for anything long.
- **i18n:** never hardcode user-facing strings. Add the key to every file in `front/locales/` (minimum `en.ts` and `ar.ts`). Use hierarchical keys (`screens.home.welcome`).
- **RTL:** use `I18nManager.isRTL` and `start`/`end` instead of `left`/`right`. Test in Arabic.
- **Assets:** compress images, prefer WebP, lazy-load. Use Reanimated for animations that must stay on the UI thread.
- **Path alias:** `@/*` resolves to `front/`.

## Error Code Standards

Every API error response uses one of these codes:

| Code | Category         | Meaning                                           |
|------|------------------|---------------------------------------------------|
| E001 | Validation       | Input validation failed                           |
| E002 | Authentication   | Auth failed or token expired                      |
| E003 | Authorization    | Insufficient permissions (RBAC)                   |
| E004 | Not Found        | Requested resource does not exist                 |
| E005 | Conflict         | Resource already exists or state conflict         |
| E006 | Rate Limit       | Too many requests                                 |
| E007 | File Upload      | Invalid file type, size, or content               |
| E008 | External Service | Third-party failure (Clerk, Supabase, Mux, etc.)  |
| E009 | Database         | Database operation failed                         |
| E010 | Internal         | Unhandled internal server error                   |

**Response shape:**

```typescript
{
  error: string;        // E001–E010
  message: string;      // user-safe message
  details?: unknown;    // validation errors, etc.
  timestamp: string;    // ISO 8601
  path: string;         // request path
}
```

Rules:

- Pick the code that matches the cause; do not default everything to E010.
- Log the full stack server-side (Winston) with context (userId, requestId, operation). Never leak stack traces or internal messages to clients.
- HTTP status codes align with the category: 400, 401, 403, 404, 409, 429, 500.

## Validation Rules (Common Fields)

- **Username:** 3–20 chars, alphanumeric + underscore.
- **Email:** valid format, max 255 chars.
- **Password:** handled by Clerk (min 8 chars).
- **Bio:** max 500 chars.
- **Video:** 5–60 seconds, max 100MB.
- **Image:** max 10MB.
- **Hashtags:** max 10 per reel, each 2–30 chars.

Example DTO:

```typescript
import { IsString, IsEmail, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(3) @MaxLength(20)
  username!: string;

  @IsEmail() @MaxLength(255)
  email!: string;

  @IsString() @MaxLength(500) @IsOptional()
  bio?: string;
}
```

## Testing

- **Backend property-based tests** live in `src/__tests__/` using `fast-check`. Target invariants: coin balance never negative, quiz scoring monotonic, predictions idempotent, soft-deletes preserve referential integrity.
- **Frontend tests** colocate under `__tests__/` next to the code.
- Mock Clerk, Supabase, Redis, and third-party APIs in unit tests.
- Integration tests hit real endpoints against a test DB and clean up after themselves.
- Add a test whenever business logic changes; run the suite before declaring a change done.

## Logging

Use the logger, never `console.log`. Include context:

```typescript
logger.info('User created', { userId: user.id, username: user.username });
logger.error('Video processing failed', {
  error: err.message,
  stack: err.stack,
  userId: req.userId,
  videoId,
});
```

Levels:

- `info` — successful operations, significant user actions.
- `warn` — recoverable errors, deprecations, rate-limit warnings.
- `error` — failed operations, unhandled exceptions, external service failures.
- `debug` — development-only detail.

Monitor: API latency (p50/p95/p99), per-endpoint error rate, DB query time, Redis hit/miss, WebSocket stability, upload success rate, auth failures, rate-limit hits.

## Mobile Considerations

- Test iOS and Android; gate platform-specific code with `Platform.OS`.
- Request permissions (camera, storage, notifications) only when needed and explain why.
- Detect connectivity with NetInfo; cache critical data (AsyncStorage + React Query); queue mutations offline and replay on reconnect.
- Handle push-notification taps as deep links. Test notifications on real devices.
- Keep the JS thread unblocked: offload heavy work, use Reanimated for 60fps animations.

## Security Checklist (run before shipping)

- [ ] All inputs validated and sanitized.
- [ ] Auth middleware on protected routes.
- [ ] RBAC enforced on admin/developer routes.
- [ ] Rate limiting on mutating and auth endpoints.
- [ ] No sensitive data in responses or logs (passwords, tokens, internal IDs).
- [ ] File uploads validated (type, size, dimensions, duration).
- [ ] Prisma parameterized queries only (no raw string concatenation).
- [ ] User-generated content sanitized before render/storage (XSS).
- [ ] CORS allowlist reviewed.
- [ ] All secrets from env vars.

## Git & Deployment

- **Commits:** conventional format — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`. Be specific ("fix: prevent crash when video duration is zero"). Reference tickets when relevant.
- **Branches:** `feature/...`, `fix/...`. Merge to main via PR with review. Run tests before merging.
- **Deployment:** backend auto-deploys from main to Railway. Frontend releases via EAS Build. Verify in staging before production. Watch error rate and performance after each deploy.

## Common Pitfalls

- Fetching in loops instead of batching or joining.
- Storing large binaries in the DB instead of Supabase / R2.
- Leaking internal IDs or implementation details in API responses.
- Trusting the client (skipping backend validation).
- Hardcoded config instead of env vars.
- Suppressing TypeScript errors.
- Blocking the JS thread with heavy sync work on mobile.
- Forgetting offline behavior on mobile.

## Response Format (when answering code requests)

Structure answers as:

1. **Summary** — 2–3 sentences: what the change does and why this approach.
2. **Code** — complete, runnable, with imports and types.
3. **Breaking changes** — list API changes, migrations, and affected callers (only if any).
4. **Env vars** — new keys, placeholder values, and where to obtain real ones (only if any).
5. **Dependencies** — name, version, install command, and justification (only if any).

## Code Review Checklist

- [ ] Matches existing patterns and folder layout.
- [ ] Full TypeScript types, no suppressions.
- [ ] Error handling on every async path.
- [ ] All user inputs validated.
- [ ] Tests added or updated; full suite passes.
- [ ] No `console.log`, no commented-out code, no hardcoded values.
- [ ] Caching and pagination considered where relevant (no N+1 queries).
- [ ] Security checklist reviewed.
- [ ] Breaking changes documented.
