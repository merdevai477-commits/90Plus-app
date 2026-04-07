# 📦 Security Dependencies Installation Guide

## Required Dependencies

To use the new security features, you need to install the following dependencies:

### Backend Dependencies

```bash
cd Backend

# Install Zod for validation
npm install zod

# Install cookie-parser for CSRF protection
npm install cookie-parser
npm install --save-dev @types/cookie-parser

# Verify installation
npm list zod cookie-parser
```

### Frontend Dependencies

```bash
cd front

# Install Axios for API client
npm install axios

# Install NetInfo for offline detection
npm install @react-native-community/netinfo

# Verify installation
npm list axios @react-native-community/netinfo
```

## Update main.ts (Backend)

Add cookie-parser middleware to your main.ts:

```typescript
import cookieParser from 'cookie-parser';

// Add after other middleware
app.use(cookieParser());
```

## Usage Examples

### 1. Using Zod Validation

```typescript
// In your route file
import { validateZod, CommonSchemas } from '../middleware/zod-validation.middleware';
import { z } from 'zod';

const createReelSchema = {
  body: z.object({
    caption: CommonSchemas.caption,
    hashtags: CommonSchemas.hashtags.optional(),
  }),
};

router.post('/reels', requireAuth, validateZod(createReelSchema), createReel);
```

### 2. Using CSRF Protection

```typescript
// In your route file
import { csrfProtection } from '../middleware/csrf.middleware';

// Add CSRF protection to routes
router.post('/reels', requireAuth, csrfProtection, createReel);
router.put('/profile', requireAuth, csrfProtection, updateProfile);
router.delete('/reels/:id', requireAuth, csrfProtection, deleteReel);
```

### 3. Using API Client (Frontend)

```typescript
// Replace fetch calls with apiClient
import { apiClient } from '../services/api.client';

// Before (fetch):
const response = await fetch(`${API_URL}/reels`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});

// After (apiClient):
const response = await apiClient.post('/reels', data);
// Token is added automatically!
```

## Migration Guide

### Step 1: Install Dependencies

```bash
# Backend
cd Backend
npm install zod cookie-parser
npm install --save-dev @types/cookie-parser

# Frontend
cd ../front
npm install axios @react-native-community/netinfo
```

### Step 2: Update Backend main.ts

```typescript
import cookieParser from 'cookie-parser';

// Add after express.json()
app.use(cookieParser());
```

### Step 3: Add CSRF Route

```typescript
// In your routes/index.ts or main.ts
import { getCSRFTokenHandler } from './middleware/csrf.middleware';

app.get('/api/csrf-token', getCSRFTokenHandler);
```

### Step 4: Migrate Frontend Services

Replace fetch calls with apiClient:

```typescript
// Old way
import { getApiUrl } from '../config/api.config';
const API_URL = getApiUrl();

const response = await fetch(`${API_URL}/reels`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

// New way
import { apiClient } from '../services/api.client';

const response = await apiClient.get('/reels');
```

### Step 5: Test Everything

```bash
# Backend tests
cd Backend
npm test

# Frontend tests
cd ../front
npm test
```

## Verification

### 1. Check Backend Dependencies

```bash
cd Backend
npm list zod cookie-parser
```

Expected output:
```
├── zod@3.x.x
└── cookie-parser@1.x.x
```

### 2. Check Frontend Dependencies

```bash
cd front
npm list axios @react-native-community/netinfo
```

Expected output:
```
├── axios@1.x.x
└── @react-native-community/netinfo@11.x.x
```

### 3. Test CSRF Protection

```bash
# Get CSRF token
curl http://localhost:3000/api/csrf-token

# Should return:
# {"csrfToken":"..."}
```

### 4. Test API Client

```typescript
// In your React Native app
import { apiClient } from '../services/api.client';

// Test GET request
const response = await apiClient.get('/health');
console.log('Health check:', response.data);

// Test queue status
const status = apiClient.getQueueStatus();
console.log('Queue status:', status);
```

## Troubleshooting

### Issue: "Cannot find module 'zod'"

**Solution:**
```bash
cd Backend
npm install zod
```

### Issue: "Cannot find module 'cookie-parser'"

**Solution:**
```bash
cd Backend
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

### Issue: "Cannot find module 'axios'"

**Solution:**
```bash
cd front
npm install axios
```

### Issue: "Cannot find module '@react-native-community/netinfo'"

**Solution:**
```bash
cd front
npm install @react-native-community/netinfo
```

### Issue: CSRF token not working

**Solution:**
1. Make sure cookie-parser is installed and configured
2. Check that CSRF middleware is added to routes
3. Verify frontend is sending X-CSRF-Token header

### Issue: API client not adding token

**Solution:**
1. Check that token is stored in AsyncStorage with key '@session_token'
2. Verify apiClient is imported correctly
3. Check console logs for authentication errors

## Next Steps

1. ✅ Install dependencies
2. ✅ Update main.ts with cookie-parser
3. ✅ Add CSRF route
4. ✅ Migrate frontend services to use apiClient
5. ✅ Test everything
6. ✅ Deploy to Railway

## Support

For issues or questions:
- Check SECURITY.md for detailed documentation
- Check OWASP_SECURITY_CHECKLIST.md for compliance
- Contact: security@90plus.com

---

**Last Updated**: April 1, 2026
