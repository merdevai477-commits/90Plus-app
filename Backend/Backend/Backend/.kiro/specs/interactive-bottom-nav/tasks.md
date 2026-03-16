# Implementation Plan

- [x] 1. Create League Center component structure





  - [x] 1.1 Create LeagueCenterHeader component


    - Create `front/components/league-center/LeagueCenterHeader.tsx`
    - Display "League Center" title (white, bold, 24-28px)
    - Add notification bell icon with circular border on the right
    - Handle notification press navigation
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create DatePickerStrip component


    - Create `front/components/league-center/DatePickerStrip.tsx`
    - Implement `generateDateRange(today: Date)` function to generate 7 consecutive days
    - Display day abbreviation (Sun, Mon, etc.) above date number
    - Highlight selected date with purple pill background (#8B5CF6)
    - Add horizontal ScrollView for dates
    - Implement Haptic feedback on date selection
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 Write property test for DatePickerStrip date generation


    - **Property 1: Date Picker generates exactly 7 days centered on today**
    - **Validates: Requirements 2.1**

  - [x] 1.4 Write property test for date formatting


    - **Property 2: Date formatting consistency**
    - **Validates: Requirements 2.2**

- [x] 2. Create League Filter components






  - [x] 2.1 Create LeagueFilterChips component

    - Create `front/components/league-center/LeagueFilterChips.tsx`
    - Display horizontally scrollable pill-shaped chips
    - Each chip shows league logo (circular, 24px) and name
    - Highlight selected chips with border/background change
    - Implement Haptic feedback on selection
    - Include major leagues: Premier League, LA LIGA, Serie A, Bundesliga, Ligue 1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_


  - [x] 2.2 Write property test for league chip rendering

    - **Property 4: League chip rendering completeness**
    - **Validates: Requirements 3.2**

- [x] 3. Create Match Card components






  - [x] 3.1 Create GradientMatchCard component

    - Create `front/components/league-center/GradientMatchCard.tsx`
    - Display home team logo and name on left
    - Display away team logo and name on right
    - Display score prominently in center (large white bold text)
    - Show red "Live" badge with dot indicator for live matches
    - Display match time below score for live matches
    - Team logos as circular images (45-55px)
    - Apply gradient background with rounded corners (16-20px)
    - Implement gradient color variation based on index
    - Add Haptic feedback on press
    - Handle navigation to match details
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2_


  - [x] 3.2 Write property test for match card team display

    - **Property 5: Match card team information display**
    - **Validates: Requirements 5.1, 5.2, 5.3**



  - [x] 3.3 Write property test for live match indicator
    - **Property 6: Live match indicator consistency**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 3.4 Write property test for gradient variety

    - **Property 7: Gradient variety across cards**
    - **Validates: Requirements 6.3**

- [x] 4. Create Live Games Section






  - [x] 4.1 Create LiveGamesSection component

    - Create `front/components/league-center/LiveGamesSection.tsx`
    - Display "Live Games" section title (white, 18-20px)
    - Add "See All" link on the right (muted text)
    - Handle "See All" navigation
    - Render list of GradientMatchCard components
    - Apply consistent spacing (12-16px) between cards
    - _Requirements: 4.1, 4.2, 4.3, 6.5_

- [x] 5. Create main League Center Screen





  - [x] 5.1 Create LeagueCenterScreen component


    - Create `front/components/league-center/LeagueCenterScreen.tsx`
    - Compose all components: Header, DatePicker, Filters, LiveGames
    - Apply dark background (#0F0F1A)
    - Implement ScrollView for full page scrolling
    - Use white for primary text, muted gray for secondary
    - _Requirements: 8.1, 8.2_


  - [x] 5.2 Implement date selection filtering

    - Connect DatePickerStrip selection to match filtering
    - Filter matches based on selected date
    - _Requirements: 2.6_


  - [x] 5.3 Implement league filtering

    - Connect LeagueFilterChips selection to match filtering
    - Filter matches based on selected leagues
    - _Requirements: 3.5_


  - [x] 5.4 Write property test for date filtering

    - **Property 3: Date selection filters matches correctly**
    - **Validates: Requirements 2.6**

- [x] 6. Integrate with existing API and navigation





  - [x] 6.1 Connect to existing match API


    - Use existing `ApiFootballService` for fetching matches
    - Map API response to component data models
    - _Requirements: 9.1_

  - [x] 6.2 Implement loading states


    - Add skeleton placeholders during loading
    - Maintain layout stability
    - _Requirements: 9.2_

  - [x] 6.3 Implement error handling


    - Display error message with retry option
    - _Requirements: 9.3_

  - [x] 6.4 Implement empty state


    - Display "No matches available" message
    - _Requirements: 9.4_

- [x] 7. Update leagues.tsx to use new design






  - [x] 7.1 Replace current leagues page with LeagueCenterScreen

    - Update `front/app/(tabs)/leagues.tsx` to use new components
    - Maintain existing routing and navigation
    - Preserve existing functionality (predictions, etc.)



- [x] 8. Create component index and exports






  - [x] 8.1 Create index file for league-center components


    - Create `front/components/league-center/index.ts`
    - Export all components for easy importing

- [x] 9. Final Checkpoint





  - Ensure all tests pass, ask the user if questions arise.
