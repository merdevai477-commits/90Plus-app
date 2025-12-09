# 90Plus API Documentation

## Base URL
- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-app.up.railway.app/api`

---

## Authentication

All protected endpoints require a **Bearer Token** from Clerk:

```
Authorization: Bearer <clerk_jwt_token>
```

---

## Endpoints

### Health Check

#### `GET /api/health`
Check API and database status.

**Response:**
```json
{
  "status": "OK",
  "database": "Connected",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### User Routes (Protected)

#### `GET /api/users/settings`
Get current user's settings.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "language": "ar",
    "biometricEnabled": true
  }
}
```

---

#### `PATCH /api/users/settings`
Update user settings.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "language": "en",
  "biometricEnabled": false
}
```

---

#### `DELETE /api/users/me`
Delete user account. **Rate Limited: 3 requests/minute**

**Headers:** `Authorization: Bearer <token>`

---

### Clerk Routes (Protected)

#### `GET /api/clerk/me`
Get current user profile from database.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "user": {
      "id": "uuid",
      "clerkUserId": "user_xxx",
      "email": "user@example.com",
      "username": "me8472",
      "displayName": "محمد أحمد",
      "coins": 50,
      "level": 1
    }
  }
}
```

---

#### `PUT /api/clerk/profile`
Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "username": "newusername",
  "displayName": "New Name",
  "bio": "About me"
}
```

---

#### `POST /api/clerk/sync`
Sync user data from Clerk.

**Headers:** `Authorization: Bearer <token>`

---

### Webhook Routes

#### `POST /api/webhooks/clerk`
Clerk webhook endpoint. **Do not call directly.**

**Headers:**
- `svix-id`
- `svix-timestamp`
- `svix-signature`

**Events Handled:**
- `user.created` - Creates user in database, generates username
- `user.updated` - Updates user data
- `user.deleted` - Removes user from database

---

## Error Responses

```json
{
  "status": "ERROR",
  "message": "Error description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `429` - Rate Limited
- `500` - Server Error

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| General API | 100 requests / 15 min |
| Authentication | 5 requests / 1 min |
| Webhooks | 50 requests / 1 min |
| Delete Account | 3 requests / 1 min |
