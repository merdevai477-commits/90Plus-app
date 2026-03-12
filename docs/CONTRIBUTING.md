# 🤝 Contributing Guide

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/90plus.git
cd 90plus/front

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm start
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Write code following our style guide
- Add tests for new features
- Update documentation

### 3. Test Your Changes

```bash
# Run tests
npm test

# Run linter
npm run lint

# Type check
npx tsc --noEmit
```

### 4. Commit Changes

```bash
# Use conventional commits
git commit -m "feat: add video upload feature"
git commit -m "fix: resolve login issue"
git commit -m "docs: update API documentation"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

## Code Style

### TypeScript

```typescript
// ✅ Use explicit types
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Avoid any
function process(data: any) { }
```

### Components

```typescript
/**
 * VideoCard displays video thumbnail and metadata
 */
export const VideoCard = React.memo(({ video, onPress }: Props) => {
  // Hooks first
  const { t } = useTranslation();
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  
  // Callbacks
  const handlePress = useCallback(() => {
    onPress(video.id);
  }, [video.id, onPress]);
  
  // Render
  return <TouchableOpacity onPress={handlePress}>...</TouchableOpacity>;
});
```

### Naming Conventions

- Components: PascalCase (`VideoCard.tsx`)
- Hooks: camelCase with `use` prefix (`useMatchesData.ts`)
- Services: camelCase with `.service` suffix (`auth.service.ts`)
- Types: PascalCase (`UserProfile`, `MatchData`)
- Constants: UPPER_SNAKE_CASE (`API_URL`, `MAX_FILE_SIZE`)

## Testing

### Write Tests For

- New features
- Bug fixes
- Critical paths
- Edge cases

### Test Structure

```typescript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = doSomething(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Documentation

### Code Comments

```typescript
/**
 * Fetches user profile data
 * 
 * @param userId - User ID to fetch
 * @returns User profile object
 * @throws {Error} If user not found
 */
async function fetchUserProfile(userId: string): Promise<UserProfile> {
  // Implementation
}
```

### README Updates

- Update README.md for new features
- Add examples for new APIs
- Document breaking changes

## Pull Request Guidelines

### PR Title

Use conventional commit format:
- `feat: add video upload`
- `fix: resolve login issue`
- `docs: update API docs`
- `refactor: simplify auth flow`
- `test: add video tests`

### PR Description

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] No regressions found

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code follows style guide
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No console.log statements
```

## Review Process

1. Automated checks run (tests, linting)
2. Code review by maintainer
3. Address feedback
4. Approval and merge

## Resources

- [Architecture](./ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
- [Security Guidelines](./SECURITY.md)
- [Monitoring Guide](./MONITORING.md)

## Questions?

Open an issue or contact the team!
