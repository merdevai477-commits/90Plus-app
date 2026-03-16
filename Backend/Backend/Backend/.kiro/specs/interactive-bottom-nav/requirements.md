# Requirements Document

## Introduction

هذا المستند يحدد متطلبات إعادة تصميم صفحة المباريات (League Center) بشكل مطابق للتصميم في الصورة المرجعية. التصميم يشمل:

- Header مع عنوان "League Center" وأيقونة الإشعارات
- Date Picker أفقي قابل للتمرير (أيام الأسبوع مع التواريخ)
- فلاتر الدوريات (Premier League, LA LIGA, etc.)
- كروت المباريات الـ Live بتصميم gradient جذاب
- قسم "Live Games" مع خيار "See All"

## Glossary

- **League_Center_Page**: صفحة عرض المباريات الرئيسية
- **Date_Picker**: شريط اختيار التاريخ الأفقي
- **League_Filter**: فلتر/شريحة لتصفية المباريات حسب الدوري
- **Match_Card**: بطاقة عرض معلومات المباراة
- **Live_Badge**: شارة تدل على أن المباراة جارية حالياً
- **Gradient_Background**: خلفية متدرجة الألوان
- **Team_Logo**: شعار الفريق الدائري
- **Score_Display**: عرض النتيجة في منتصف البطاقة
- **Haptic_Feedback**: الاهتزاز اللمسي عند التفاعل

## Requirements

### Requirement 1

**User Story:** As a user, I want a League Center page header, so that I can see the page title and access notifications.

#### Acceptance Criteria

1. WHEN the League_Center_Page loads THEN the system SHALL display "League Center" as the page title in white bold text (font-size: 24-28px)
2. WHEN the header renders THEN the system SHALL display a notification bell icon (outline style) on the right side with a circular border
3. WHEN the notification icon is pressed THEN the system SHALL navigate to the notifications screen
4. WHEN the header renders THEN the system SHALL have adequate top padding respecting safe area insets

### Requirement 2

**User Story:** As a user, I want a horizontal date picker, so that I can quickly select a date to view matches.

#### Acceptance Criteria

1. WHEN the Date_Picker renders THEN the system SHALL display 7 days horizontally (3 days before today, today highlighted, 3 days after)
2. WHEN a date item renders THEN the system SHALL show the day abbreviation (Sun, Sat, Mon, Tue, Wed, Thu, Fri) above the date number
3. WHEN the selected date renders THEN the system SHALL highlight it with a purple/violet pill background (#8B5CF6) and white text
4. WHEN an unselected date renders THEN the system SHALL display it with muted gray text (rgba(255, 255, 255, 0.6))
5. WHEN a user taps a date THEN the system SHALL update the selected state and trigger Haptic_Feedback
6. WHEN a user taps a date THEN the system SHALL filter matches to show only matches for that date

### Requirement 3

**User Story:** As a user, I want league filter chips, so that I can filter matches by specific leagues.

#### Acceptance Criteria

1. WHEN the League_Filter section renders THEN the system SHALL display horizontally scrollable pill-shaped chips
2. WHEN a league chip renders THEN the system SHALL show the league logo (circular, ~24px) and league name text
3. WHEN a league chip is selected THEN the system SHALL highlight it with a filled background or border
4. WHEN a league chip is unselected THEN the system SHALL display it with a dark transparent background and border
5. WHEN a user taps a league chip THEN the system SHALL filter the matches list and trigger Haptic_Feedback
6. WHEN the filters render THEN the system SHALL include common leagues: Premier League, LA LIGA, Serie A, Bundesliga, Ligue 1

### Requirement 4

**User Story:** As a user, I want a "Live Games" section header, so that I can identify the matches section and see all matches.

#### Acceptance Criteria

1. WHEN the Live Games section renders THEN the system SHALL display "Live Games" as the section title in white text (font-size: 18-20px)
2. WHEN the section header renders THEN the system SHALL display a "See All" link on the right side in muted text
3. WHEN a user taps "See All" THEN the system SHALL navigate to a full matches list screen
4. WHEN the section renders THEN the system SHALL have vertical spacing (16-20px) from the filters above

### Requirement 5

**User Story:** As a user, I want beautiful match cards showing live games, so that I can see match information at a glance.

#### Acceptance Criteria

1. WHEN a Match_Card renders THEN the system SHALL display the home team logo and name on the left side
2. WHEN a Match_Card renders THEN the system SHALL display the away team logo and name on the right side
3. WHEN a Match_Card renders THEN the system SHALL display the score prominently in the center (large white bold text, e.g., "1:0")
4. WHEN a match is live THEN the system SHALL display a red "Live" badge with red dot indicator above the score
5. WHEN a match is live THEN the system SHALL display the current match time below the score (e.g., "40:32")
6. WHEN Team_Logo renders THEN the system SHALL display it as a circular image (45-55px diameter)

### Requirement 6

**User Story:** As a user, I want match cards with gradient backgrounds, so that the interface feels dynamic and premium.

#### Acceptance Criteria

1. WHEN a Match_Card renders THEN the system SHALL have a Gradient_Background with rounded corners (16-20px border-radius)
2. WHEN gradients are applied THEN the system SHALL use dark-to-color gradients (e.g., dark blue to teal, dark purple to green)
3. WHEN multiple cards render THEN the system SHALL vary the gradient colors for visual interest
4. WHEN a card renders THEN the system SHALL have consistent padding (16px) inside the card
5. WHEN cards are listed THEN the system SHALL have consistent vertical spacing (12-16px) between cards

### Requirement 7

**User Story:** As a user, I want to tap on a match card to see details, so that I can get more information about the match.

#### Acceptance Criteria

1. WHEN a user taps a Match_Card THEN the system SHALL navigate to the match details page with the match ID
2. WHEN a user taps a Match_Card THEN the system SHALL trigger Haptic_Feedback (selection)
3. WHEN a user presses and holds a Match_Card THEN the system SHALL show a subtle scale-down animation (0.98)

### Requirement 8

**User Story:** As a user, I want the page to have a consistent dark theme, so that it matches the app's overall design.

#### Acceptance Criteria

1. WHEN the League_Center_Page renders THEN the system SHALL have a dark background color (#0F0F1A or similar dark purple-black)
2. WHEN text renders THEN the system SHALL use white (#FFFFFF) for primary text and muted gray for secondary text
3. WHEN the page scrolls THEN the system SHALL maintain smooth 60fps scrolling performance
4. WHEN the page renders THEN the system SHALL use the app's existing color constants where applicable

### Requirement 9

**User Story:** As a user, I want the page to load match data from the backend, so that I see real match information.

#### Acceptance Criteria

1. WHEN the League_Center_Page loads THEN the system SHALL fetch matches from the existing backend API
2. WHEN matches are loading THEN the system SHALL display skeleton loading placeholders
3. WHEN matches fail to load THEN the system SHALL display an error message with retry option
4. WHEN no matches are available THEN the system SHALL display an empty state message
