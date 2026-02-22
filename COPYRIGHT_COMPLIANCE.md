# Copyright Compliance Guide
## Apple Guideline 4.1 - Design - Copycats

This document outlines how this app complies with Apple's copyright guidelines.

---

## ✅ COMPLIANT: Production Data Sources

### 1. Sports Data (Matches, Players, Teams)
- **Source**: Licensed APIs only (API-Football, SportMonks)
- **Implementation**: All real-time data fetched from licensed APIs
- **Files**: 
  - `Backend/src/controllers/football.controller.ts`
  - `front/data/clubs.ts` (uses `apiId` to fetch from API-Football)

### 2. Quiz Questions
- **Production File**: `Backend/src/data/quiz-questions/legends-complete.ts`
- **Content**: Generic descriptions only (e.g., "لاعب ألماني" instead of real names)
- **Compliance**: ✅ No copyrighted player names

### 3. Team Logos & Player Images
- **Source**: API-Football CDN (licensed)
- **URL Pattern**: `https://media.api-sports.io/football/...`
- **Compliance**: ✅ Authorized use through API subscription

---

## ⚠️ DEVELOPMENT ONLY: Mock Data Files

These files contain copyrighted content but are NEVER used in production:

### 1. Quiz Seed File (Development Only)
- **File**: `Backend/prisma/quiz-questions-seed.ts`
- **Status**: ⚠️ Contains real player names
- **Usage**: Database seeding for local development ONLY
- **Production**: Uses `legends-complete.ts` instead (generic names)

### 2. Mock Data Files (Development Only)
- **Files**:
  - `front/components/Home/mockData.tsx` ✅ Fixed (generic names)
  - `front/components/profile/MockProfiles.ts` ✅ Fixed (generic names)
  - `front/components/Home/HeroSection.tsx` ✅ Fixed (generic names)
  - `front/components/reels/mockData.ts` ✅ Fixed (generic names)
- **Status**: ✅ All copyrighted content removed
- **Usage**: UI development and testing only

### 3. Test Files (Development Only)
- **Files**:
  - `front/components/leagues/__tests__/LeaguesComponents.test.tsx`
  - `front/components/leagues/example.tsx`
- **Status**: ⚠️ Contains mock team names
- **Usage**: Unit tests only - NOT included in production build

---

## 🔒 Production Deployment Checklist

Before deploying to App Store / Google Play:

- [ ] Verify all sports data comes from licensed APIs
- [ ] Confirm quiz questions use generic descriptions only
- [ ] Check no hardcoded team logos or player images
- [ ] Ensure seed files are not run in production
- [ ] Verify mock data files are not imported in production code
- [ ] Test that all team/player data is fetched from API-Football

---

## 📝 API Licenses Required

1. **API-Football** (https://api-football.com)
   - Team logos, player images, match data
   - Subscription required for production use

2. **SportMonks** (https://www.sportmonks.com)
   - Alternative/additional sports data source
   - Subscription required for production use

---

## 🚫 What NOT to Do

❌ DO NOT hardcode real player names in production code
❌ DO NOT use Wikipedia images or unauthorized logos
❌ DO NOT run seed files in production environment
❌ DO NOT reference specific players without API authorization

---

## ✅ What TO Do

✅ USE licensed API data for all sports content
✅ USE generic descriptions in quiz questions
✅ USE API-provided images and logos only
✅ VERIFY all data sources before production deployment

---

## 📞 Contact

For questions about copyright compliance, contact the development team.

Last Updated: 2026-02-22
