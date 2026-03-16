# Apple Compliance Requirements - Spec Overview

## 📋 Quick Summary

This spec addresses two critical compliance issues identified by Apple App Review that are blocking the app's approval:

1. **Guideline 5.1.1(v)**: Missing account deletion functionality
2. **Guideline 1.2**: Incomplete user-generated content moderation system

## 🎯 Goals

- ✅ Implement complete account deletion flow
- ✅ Add Terms of Service (EULA) acceptance during signup
- ✅ Enhance content reporting system
- ✅ Implement user blocking functionality
- ✅ Get Apple App Store approval

## 📁 Spec Files

- **requirements.md**: Detailed user stories and acceptance criteria
- **design.md**: Technical design and implementation details
- **tasks.md**: Step-by-step implementation tasks
- **terms-of-service-content.md**: Complete terms of service text
- **apple-response-template.md**: Template for responding to Apple

## ⏱️ Timeline

- **Backend**: 3-4 days
- **Frontend**: 4-5 days
- **Testing**: 2-3 days
- **Deployment**: 1-2 days
- **Total**: 10-14 days

## 🚀 Quick Start

### 1. Review the Spec
```bash
# Read requirements
cat .kiro/specs/apple-compliance-requirements/requirements.md

# Read design
cat .kiro/specs/apple-compliance-requirements/design.md

# Read tasks
cat .kiro/specs/apple-compliance-requirements/tasks.md
```

### 2. Start Implementation
Follow the tasks in order:
1. Phase 1: Database & Backend Foundation
2. Phase 2: Frontend Components
3. Phase 3: Admin Dashboard (Optional)
4. Phase 4: Testing & QA
5. Phase 5: Deployment & Submission

### 3. Test Features
- Test account deletion from Settings
- Test terms acceptance during signup
- Test content reporting on reels/comments
- Test user blocking from profiles

### 4. Deploy
- Deploy backend to Railway
- Build and upload to TestFlight
- Submit to Apple for review

## 📝 Key Features

### Account Deletion
- In-app deletion from Settings
- Two-step confirmation process
- Password/biometric verification
- Email confirmation
- 30-day grace period before permanent deletion

### Terms of Service
- Displayed during signup
- Must be accepted before account creation
- Zero tolerance policy clearly stated
- Accessible from Settings

### Content Reporting
- Report button on all content (reels, comments, profiles)
- Quick 2-tap reporting process
- Multiple report reasons
- Confirmation message
- 24-hour review time

### User Blocking
- Block users from profile or content
- Instant effect (content hidden, follows removed)
- Manage blocked users in Settings
- Unblock at any time

## 🔧 Technical Stack

### Frontend
- React Native (Expo)
- TypeScript
- React Navigation
- Clerk Authentication

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- Railway hosting

### Services
- Clerk (Authentication)
- Supabase (Storage)
- Email service (Confirmations)

## 📊 Success Metrics

- Account deletion completion rate > 95%
- Report submission success rate > 98%
- Admin moderation response time < 24 hours
- Apple App Store approval ✅

## 🔗 Related Files

### Backend
- `Backend/src/services/moderation.service.ts` - Existing moderation logic
- `Backend/src/routes/user.routes.ts` - User API routes
- `Backend/prisma/schema.prisma` - Database schema

### Frontend
- `front/app/(tabs)/settings.tsx` - Settings screen
- `front/contexts/SettingsContext.tsx` - Settings context

## 📞 Support

For questions or issues:
- Email: merdevai477@gmail.com
- GitHub Issues: [Create an issue]

## 📄 License

This spec is part of the 90Plus project.

---

**Status**: 🟡 Ready for Implementation  
**Priority**: 🔴 Critical (Blocking Apple approval)  
**Estimated Effort**: 10-14 days

