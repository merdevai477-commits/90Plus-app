# 🔐 Security Guidelines

## Environment Variables

### ⚠️ CRITICAL: Never Commit Secrets

**DO NOT** commit the following to version control:
- `.env` file
- API keys
- Authentication tokens
- Private keys
- Passwords

### ✅ Proper Setup

1. **Copy the template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your values:**
   ```bash
   # Edit .env with your actual keys
   nano .env
   ```

3. **Verify .gitignore:**
   ```bash
   # Ensure .env is in .gitignore
   grep ".env" .gitignore
   ```

## API Key Management

### Current Issues Fixed

❌ **Before (INSECURE):**
```json
// app.json
"extra": {
  "sportmonksToken": "mDAf5ClZwcEKXgFCkQoSpUtoumBDl4hT5FYzF8LtAYSNsZ0i19AdekwZQcSy"
}
```

✅ **After (SECURE):**
```json
// app.json
"extra": {
  "sportmonksToken": process.env.EXPO_PUBLIC_SPORTMONKS_TOKEN
}
```

### Environment Variable Access

```typescript
// ✅ Correct way to access env vars
import Constants from 'expo-constants';

const apiKey = Constants.expoConfig?.extra?.sportmonksToken;
// or
const apiKey = process.env.EXPO_PUBLIC_SPORTMONKS_TOKEN;
```

## Sensitive Data Handling

### 1. User Tokens

```typescript
// ✅ Use SecureStore for sensitive data
import * as SecureStore from 'expo-secure-store';

// Store
await SecureStore.setItemAsync('userToken', token);

// Retrieve
const token = await SecureStore.getItemAsync('userToken');

// Delete
await SecureStore.deleteItemAsync('userToken');
```

### 2. API Requests

```typescript
// ✅ Always use HTTPS in production
const API_URL = __DEV__ 
  ? 'http://localhost:3000/api'
  : 'https://api.90plus.app/api';

// ✅ Include auth headers
const response = await fetch(`${API_URL}/endpoint`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. Logging

```typescript
// ❌ NEVER log sensitive data
console.log('User token:', token); // BAD!
console.log('Password:', password); // BAD!

// ✅ Use logger with sanitization
import { logger } from './services/logger';

logger.debug('User authenticated', { 
  userId: user.id, // OK
  // token: user.token // NEVER!
});
```

## Code Security Checklist

### Before Committing

- [ ] No hardcoded API keys
- [ ] No passwords in code
- [ ] No tokens in logs
- [ ] `.env` in `.gitignore`
- [ ] Sensitive data in SecureStore
- [ ] HTTPS in production
- [ ] Input validation on all forms
- [ ] XSS prevention (sanitize user input)

### Before Deploying

- [ ] Environment variables set in EAS
- [ ] Production API URLs configured
- [ ] Debug logs disabled
- [ ] Error messages sanitized
- [ ] Certificate pinning enabled (if applicable)
- [ ] Jailbreak detection enabled (if applicable)

## EAS Build Configuration

### Setting Environment Variables

```bash
# Set secrets in EAS
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.90plus.app/api"
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "pk_live_..."
eas secret:create --scope project --name EXPO_PUBLIC_SPORTMONKS_TOKEN --value "your_token"
```

### Build Profiles

```json
// eas.json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.90plus.app/api",
        "EXPO_PUBLIC_ENABLE_DEBUG_LOGS": "false"
      }
    },
    "development": {
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3000/api",
        "EXPO_PUBLIC_ENABLE_DEBUG_LOGS": "true"
      }
    }
  }
}
```

## Security Best Practices

### 1. Certificate Pinning (Advanced)

```typescript
// For production apps handling sensitive data
import { Platform } from 'react-native';

const certificatePinning = {
  '90plus.app': {
    includeSubdomains: true,
    pins: [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    ]
  }
};
```

### 2. Jailbreak/Root Detection

```typescript
// Detect compromised devices
import * as Device from 'expo-device';

const isDeviceSecure = async () => {
  // Check if device is rooted/jailbroken
  // Implement based on your security requirements
};
```

### 3. Biometric Authentication

```typescript
// Already implemented in app
import * as LocalAuthentication from 'expo-local-authentication';

const authenticate = async () => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to continue',
    fallbackLabel: 'Use passcode',
  });
  return result.success;
};
```

## Incident Response

### If API Key is Compromised

1. **Immediately revoke** the compromised key
2. **Generate new key** from provider dashboard
3. **Update** `.env` and EAS secrets
4. **Rebuild** and redeploy app
5. **Monitor** for unauthorized usage
6. **Notify** users if data was accessed

### If User Data is Exposed

1. **Assess** scope of exposure
2. **Notify** affected users
3. **Reset** compromised credentials
4. **Implement** additional security measures
5. **Document** incident and response
6. **Review** security practices

## Resources

- [Expo Security Best Practices](https://docs.expo.dev/guides/security/)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [React Native Security](https://reactnative.dev/docs/security)

## Contact

For security concerns, contact: security@90plus.app
