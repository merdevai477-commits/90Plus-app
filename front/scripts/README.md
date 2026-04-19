# 🔧 Development Scripts

## 🔑 Clerk Token Extractor

### Purpose
Extract your Clerk authentication token for API testing in Postman or other tools.

### Files
- `get-clerk-token.ts` - Token extraction utilities
- `../app/debug-token.tsx` - Debug screen UI

---

## 📱 Usage Methods

### Method 1: Debug Screen (Recommended)

1. **Navigate to the debug screen:**
   ```typescript
   // In your app
   router.push('/debug-token');
   ```

2. **Or add a button in Settings:**
   ```typescript
   import { router } from 'expo-router';
   
   <TouchableOpacity onPress={() => router.push('/debug-token')}>
     <Text>🔑 Get API Token</Text>
   </TouchableOpacity>
   ```

3. **Use the screen:**
   - Tap "Get & Copy Token"
   - Token is automatically copied to clipboard
   - Paste in Postman Environment

---

### Method 2: Console Logger Hook

Add this to any screen where you're signed in:

```typescript
import { useClerkTokenLogger } from '../scripts/get-clerk-token';

function MyScreen() {
  useClerkTokenLogger(); // Logs token to console
  
  return (
    // Your screen content
  );
}
```

Then check your console/debugger for the token.

---

### Method 3: Manual Component

Add the component directly to any screen:

```typescript
import { ClerkTokenExtractor } from '../scripts/get-clerk-token';

function MyScreen() {
  return (
    <View>
      {/* Your screen content */}
      
      {__DEV__ && <ClerkTokenExtractor />}
    </View>
  );
}
```

---

## 🎯 Using the Token in Postman

1. **Open Postman**
2. **Select Environment:** "90Plus Production"
3. **Find Variable:** `clerk_token`
4. **Paste Token** in "Current Value" field
5. **Save** the environment
6. **Start Testing!** All requests will use this token

---

## ⚠️ Security Notes

- **Never commit tokens** to version control
- **Tokens expire** after 1 hour (Clerk default)
- **Refresh token** when you get 401 errors
- **Use only in development** - never expose tokens in production
- **Keep debug screens** behind `__DEV__` checks

---

## 🔄 Token Lifecycle

```
User Signs In
    ↓
Clerk Issues Token (1 hour validity)
    ↓
Token Used in API Requests
    ↓
Token Expires (401 error)
    ↓
Get New Token (repeat process)
```

---

## 🐛 Troubleshooting

### Token Not Showing
- **Check:** User is signed in (`isSignedIn === true`)
- **Check:** Clerk is loaded (`isLoaded === true`)
- **Try:** Sign out and sign in again

### Token Expired (401 Error)
- **Solution:** Get a fresh token using the debug screen
- **Note:** Tokens expire after 1 hour

### Copy Not Working
- **Check:** Clipboard permissions
- **Try:** Manual copy from console logs

---

## 📝 Example: Adding to Settings Screen

```typescript
// front/app/(tabs)/settings.tsx

import { router } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <View>
      {/* Other settings */}
      
      {__DEV__ && (
        <TouchableOpacity
          onPress={() => router.push('/debug-token')}
          style={{
            padding: 15,
            backgroundColor: '#007AFF',
            borderRadius: 8,
            margin: 20,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            🔑 Get API Token for Testing
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

## 🚀 Quick Start

1. **Add debug screen to your app:**
   - File already created at `front/app/debug-token.tsx`
   - Navigate to `/debug-token` in your app

2. **Or use the hook:**
   ```typescript
   import { useClerkTokenLogger } from './scripts/get-clerk-token';
   useClerkTokenLogger(); // In any component
   ```

3. **Get token and test:**
   - Copy token from app
   - Paste in Postman
   - Test your API endpoints!

---

**Happy Testing! 🎉**
