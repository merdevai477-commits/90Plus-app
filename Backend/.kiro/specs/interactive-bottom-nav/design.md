# Design Document: League Center Page

## Overview

إعادة تصميم صفحة المباريات (League Center) لتكون مطابقة للتصميم في الصورة المرجعية. الصفحة تتضمن:
- Header بسيط مع عنوان "League Center" وأيقونة الإشعارات
- Date Picker أفقي لاختيار التاريخ
- فلاتر الدوريات كـ chips أفقية
- كروت المباريات بتصميم gradient جذاب

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LeagueCenterScreen                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  LeagueCenterHeader                  │   │
│  │  [League Center]                            [🔔]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   DatePickerStrip                    │   │
│  │  [Sun] [Sat] [Mon] [Tue] [Wed] [Thu] [Fri]         │   │
│  │   12    13    14   [15]   16    17    18           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  LeagueFilterChips                   │   │
│  │  [⚽ Premier League] [◉ LA LIGA] [◉ Serie A] ...   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LiveGamesSection                        │   │
│  │  Live Games                              See All    │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │            GradientMatchCard                │   │   │
│  │  │  [Logo] West Ham  🔴Live  Newcastle [Logo] │   │   │
│  │  │         UTD      1:0      UTD              │   │   │
│  │  │                  40:32                      │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │            GradientMatchCard                │   │   │
│  │  │  [Logo] Chelsea  🔴Live  Man City  [Logo]  │   │   │
│  │  │                  1:0                        │   │   │
│  │  │                  40:32                      │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. LeagueCenterHeader

```typescript
interface LeagueCenterHeaderProps {
  onNotificationPress: () => void;
}
```

**المسؤوليات:**
- عرض عنوان "League Center" بخط أبيض عريض (24-28px)
- عرض أيقونة الإشعارات (bell outline) في دائرة على اليمين
- التعامل مع الضغط على أيقونة الإشعارات

### 2. DatePickerStrip

```typescript
interface DateItem {
  date: Date;
  dayAbbr: string;      // "Sun", "Mon", etc.
  dayNumber: number;    // 12, 13, 14, etc.
  isSelected: boolean;
  isToday: boolean;
}

interface DatePickerStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}
```

**المسؤوليات:**
- توليد 7 أيام (3 قبل اليوم، اليوم، 3 بعد اليوم)
- عرض اختصار اليوم فوق رقم التاريخ
- تمييز اليوم المحدد بخلفية بنفسجية (#8B5CF6)
- Haptic feedback عند الاختيار
- تمرير أفقي سلس

### 3. LeagueFilterChips

```typescript
interface LeagueChip {
  id: number;
  name: string;
  logo: string;
  isSelected: boolean;
}

interface LeagueFilterChipsProps {
  leagues: LeagueChip[];
  selectedLeagues: number[];
  onLeagueToggle: (leagueId: number) => void;
}
```

**المسؤوليات:**
- عرض chips أفقية قابلة للتمرير
- كل chip يحتوي على لوجو الدوري + الاسم
- تمييز الـ chips المحددة
- Haptic feedback عند الاختيار

### 4. LiveGamesSection

```typescript
interface LiveGamesSectionProps {
  matches: Match[];
  onSeeAllPress: () => void;
  onMatchPress: (matchId: string) => void;
}
```

**المسؤوليات:**
- عرض header "Live Games" مع "See All"
- عرض قائمة كروت المباريات

### 5. GradientMatchCard

```typescript
interface GradientMatchCardProps {
  match: Match;
  gradientIndex: number;  // لتنويع الألوان
  onPress: () => void;
}

interface Match {
  id: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score: {
    home: number;
    away: number;
  };
  status: 'live' | 'upcoming' | 'finished';
  minute?: string;        // "40:32" للمباريات الجارية
  league: LeagueInfo;
}

interface TeamInfo {
  name: string;
  logo: string;
}
```

**المسؤوليات:**
- عرض لوجوهات وأسماء الفريقين
- عرض النتيجة في المنتصف
- عرض شارة "Live" حمراء مع الوقت
- خلفية gradient متنوعة
- Haptic feedback عند الضغط

## Data Models

### Match Data Structure

```typescript
interface MatchData {
  id: string;
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;  // "1H", "2H", "HT", "FT", "NS"
      elapsed: number | null;
    };
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  league: {
    id: number;
    name: string;
    logo: string;
  };
}
```

### Gradient Color Schemes

```typescript
const GRADIENT_SCHEMES = [
  ['#1a1a3e', '#0d4f4f'],  // Dark blue to teal
  ['#2d1b4e', '#1a4a3a'],  // Dark purple to green
  ['#1a2a4a', '#2a4a3a'],  // Navy to forest
  ['#3a1a3a', '#1a3a4a'],  // Plum to ocean
  ['#1a3a2a', '#2a2a4a'],  // Forest to indigo
];
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Date Picker generates exactly 7 days centered on today
*For any* given "today" date, the DatePickerStrip SHALL generate exactly 7 DateItem objects where:
- 3 items have dates before today
- 1 item is today (marked as selected by default)
- 3 items have dates after today
- All items are consecutive days

**Validates: Requirements 2.1**

### Property 2: Date formatting consistency
*For any* Date object, the formatted output SHALL contain:
- A valid day abbreviation (one of: Sun, Sat, Mon, Tue, Wed, Thu, Fri)
- A valid day number (1-31)

**Validates: Requirements 2.2**

### Property 3: Date selection filters matches correctly
*For any* selected date and list of matches, all displayed matches SHALL have a fixture date matching the selected date.

**Validates: Requirements 2.6**

### Property 4: League chip rendering completeness
*For any* LeagueChip data object, the rendered chip SHALL contain both the league logo URL and the league name text.

**Validates: Requirements 3.2**

### Property 5: Match card team information display
*For any* Match object with valid team data, the GradientMatchCard SHALL display:
- Home team logo and name on the left
- Away team logo and name on the right
- Score in the center (if available)

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 6: Live match indicator consistency
*For any* Match with status === 'live', the GradientMatchCard SHALL display:
- A red "Live" badge
- The current match minute (if available)

**Validates: Requirements 5.4, 5.5**

### Property 7: Gradient variety across cards
*For any* list of N matches (N > 1), the gradient indices assigned to consecutive cards SHALL differ, ensuring visual variety.

**Validates: Requirements 6.3**

## Error Handling

### API Errors
- عرض رسالة خطأ واضحة مع زر "Retry"
- الاحتفاظ بالبيانات المخزنة مؤقتاً إن وجدت

### Empty States
- عرض رسالة "No matches available" مع أيقونة مناسبة
- اقتراح تغيير التاريخ أو الفلتر

### Loading States
- عرض skeleton placeholders أثناء التحميل
- الحفاظ على layout ثابت لتجنب القفز

## Testing Strategy

### Unit Testing Framework
- Jest for React Native
- React Native Testing Library for component testing

### Property-Based Testing Framework
- **fast-check** library for TypeScript/JavaScript
- Minimum 100 iterations per property test

### Test Categories

#### 1. Unit Tests
- DatePickerStrip date generation logic
- LeagueFilterChips selection state management
- GradientMatchCard rendering with different match states
- Navigation handlers

#### 2. Property-Based Tests
Each correctness property MUST be implemented as a property-based test using fast-check:

```typescript
// Example structure for Property 1
/**
 * **Feature: interactive-bottom-nav, Property 1: Date Picker generates exactly 7 days centered on today**
 * **Validates: Requirements 2.1**
 */
test('DatePickerStrip generates 7 consecutive days centered on today', () => {
  fc.assert(
    fc.property(fc.date(), (today) => {
      const dates = generateDateRange(today);
      expect(dates).toHaveLength(7);
      // ... additional assertions
    }),
    { numRuns: 100 }
  );
});
```

#### 3. Integration Tests
- Full page rendering with mock API data
- Date selection → match filtering flow
- League filter → match filtering flow
- Navigation to match details

### Test File Structure
```
front/components/league-center/
├── __tests__/
│   ├── DatePickerStrip.test.tsx
│   ├── DatePickerStrip.property.test.ts
│   ├── LeagueFilterChips.test.tsx
│   ├── GradientMatchCard.test.tsx
│   ├── GradientMatchCard.property.test.ts
│   └── LeagueCenterScreen.integration.test.tsx
```
