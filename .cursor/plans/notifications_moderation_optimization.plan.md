# Notifications & Moderation System Plan

## Current State Analysis

### Issues Identified:

1. **Notification Structure**: Actor info (name, avatar) not consistently included in notification data
2. **Real-time Delivery**: WebSocket exists but notifications may not always include complete actor data
3. **No Strike System**: warningsCount exists but no logic to apply strikes based on reports
4. **No Auto-Delete**: Content not automatically deleted when report thresholds are reached
5. **No Admin Alerts**: Admins not notified when reports require attention
6. **Incomplete Audit Trail**: Moderation actions not fully logged

## Implementation Plan

### Phase 1: Fix Notification Structure & Delivery

**Files to modify:**
- `Backend/src/routes/reels.routes.ts` - Ensure all notifications include actor info
- `Backend/src/services/notification.service.ts` - Standardize notification creation
- `Backend/src/services/websocket.service.ts` - Verify real-time delivery

**Changes:**
- Always include actor `id`, `username`, `displayName`, and `avatar` in notification data
- Standardize notification payload structure
- Ensure WebSocket delivery includes complete actor information

### Phase 2: Implement Strike System

**Files to create:**
- `Backend/src/services/moderation.service.ts` - Strike system logic
- `Backend/src/models/strike.model.ts` - Strike tracking (if needed in DB)

**Files to modify:**
- `Backend/prisma/schema.prisma` - Add strike tracking fields if needed
- `Backend/src/routes/reels.routes.ts` - Apply strikes on report review

**Strike Logic:**
- 3 reports = 1 strike
- 3 strikes = warning
- 5 strikes = temporary suspension (7 days)
- 7 strikes = permanent ban
- Strikes expire after 90 days of good behavior

### Phase 3: Auto-Delete at Report Thresholds

**Files to modify:**
- `Backend/src/services/moderation.service.ts` - Auto-delete logic
- `Backend/src/routes/reels.routes.ts` - Check thresholds after report creation

**Thresholds:**
- Comment: 5 reports = auto-delete
- Reel: 10 reports = auto-delete
- User: 15 total reports = auto-review required

### Phase 4: Admin Alert System

**Files to create:**
- `Backend/src/services/admin-alert.service.ts` - Admin notification service

**Files to modify:**
- `Backend/src/routes/reels.routes.ts` - Send admin alerts on critical reports
- `Backend/src/routes/notification.routes.ts` - Admin notification endpoint

**Alert Triggers:**
- High-priority report types (HARASSMENT, INAPPROPRIATE)
- Report threshold reached (auto-delete triggered)
- User strike threshold reached
- Multiple reports from different users in short time

### Phase 5: Prevent Report Abuse

**Files to modify:**
- `Backend/src/routes/reels.routes.ts` - Enhanced duplicate detection
- `Backend/src/services/moderation.service.ts` - Reporter reputation tracking

**Abuse Prevention:**
- Rate limit reports per user (5 per hour)
- Track false reports (reports that were rejected)
- Suspend users who submit too many false reports
- Cooldown period after reporting (prevents spam)

### Phase 6: Audit Trail & Moderation Logs

**Files to create:**
- `Backend/src/models/moderation-log.model.ts` - Audit log model
- `Backend/src/services/audit.service.ts` - Audit logging service

**Files to modify:**
- `Backend/prisma/schema.prisma` - Add ModerationLog model
- All moderation endpoints - Log all actions

**Audit Fields:**
- Action type (DELETE, SUSPEND, BAN, WARNING)
- Actor (admin/user who performed action)
- Target (content/user affected)
- Reason
- Timestamp
- Report IDs that triggered action

## Success Metrics

### Notification Delivery:
- 100% of notifications include complete actor info
- Real-time delivery < 1 second
- Zero missing actor data

### Strike System:
- Strikes applied correctly based on report count
- Strike expiration working
- Escalation (warning → suspend → ban) functioning

### Auto-Delete:
- Content auto-deleted at correct thresholds
- Users notified of content removal
- Audit log created for each deletion

### Admin Alerts:
- Admins notified within 5 minutes of critical reports
- Alert includes all relevant context
- Admin can take action directly from alert

### Abuse Prevention:
- < 1% false positive rate
- Report spam prevented
- Reporter reputation tracked

## Implementation Order

1. **Fix Notification Structure** (Phase 1) - Foundation for all notifications
2. **Implement Strike System** (Phase 2) - Core moderation logic
3. **Auto-Delete at Thresholds** (Phase 3) - Automated content removal
4. **Admin Alert System** (Phase 4) - Human oversight
5. **Prevent Report Abuse** (Phase 5) - Security and fairness
6. **Audit Trail** (Phase 6) - Compliance and transparency

## Security & Safety

- **No false positives**: Multiple reports required before action
- **Appeal process**: Users can contest strikes/bans
- **Admin oversight**: All auto-actions logged and reviewable
- **Rate limiting**: Prevents report spam
- **Audit trail**: All moderation actions permanently logged

