# Apple Copycat Content Removal Bugfix Design

## Overview

The 90Plus app was rejected by Apple for violating Guideline 4.1 - Design - Copycats due to unauthorized use of copyrighted sports content (team logos, league branding, official names). This design outlines a comprehensive approach to remove all copyrighted content and replace it with generic alternatives while preserving all app functionality. The fix involves database schema changes, API response transformations, frontend component updates, and asset cleanup across both backend and frontend codebases.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the app displays, stores, or transmits copyrighted team/league logos, names, or branding without authorization
- **Property (P)**: The desired behavior - all team/league content should be generic, non-copyrighted alternatives
- **Preservation**: All existing functionality (match tracking, predictions, quizzes, social features) must continue to work with generic content
- **Copyrighted Content**: Official team logos, league logos, trademarked team names, trademarked league names, official branding
- **Generic Content**: Text-based identifiers, placeholder images, non-trademarked alternative names
- **API-Football**: Third-party API that provides match data with copyrighted content that must be transformed
- **CachedFixture/CachedTeam/CachedLeague**: Database models storing cached API responses with copyrighted content
- **Transformation Layer**: Middleware/service that converts copyrighted content to generic alternatives before sending to frontend

## Bug Details

### Fault Condition

The bug manifests when the app displays, stores, or transmits any copyrighted sports content from third-party organizations. This occurs throughout the entire application stack - from database storage to API responses to frontend rendering.

**Formal Specification:**
```
FUNCTION isBugCondition(content)
  INPUT: content of type {teamLogo, leagueLogo, teamName, leagueName, any sports branding}
  OUTPUT: boolean
  
  RETURN (content.teamLogo IS NOT NULL AND content.teamLogo CONTAINS official_logo_url)
         OR (content.leagueLogo IS NOT NULL AND content.leagueLogo CONTAINS official_logo_url)
         OR (content.teamName IN official_trademarked_names)
         OR (content.leagueName IN official_trademarked_names)
         OR (content CONTAINS any_copyrighted_branding)
END FUNCTION
```

### Examples

- **Team Logos**: Match cards display "https://media.api-sports.io/football/teams/541.png" (Real Madrid logo) → Should display generic placeholder or text "Team A"
- **League Logos**: League sections show "https://media.api-sports.io/football/leagues/140.png" (La Liga logo) → Should display generic text "League 1"
- **Team Names**: Database stores "Real Madrid CF" → Should store "Team A" or "Madrid Team"
- **League Names**: API returns "Premier League" → Should transform to "English League 1"
- **User Profiles**: User's favoriteTeam shows official club logo → Should show generic placeholder
- **Predictions**: Prediction records store official team names and logos → Should store generic identifiers
- **Cached Data**: CachedFixture table contains homeTeamLogo/awayTeamLogo URLs → Should be NULL or generic placeholders

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Live match score tracking and real-time updates must continue to function
- Match predi