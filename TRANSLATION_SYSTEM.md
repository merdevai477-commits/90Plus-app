# 🌍 Translation System Documentation

## Overview

نظام ترجمة شامل يدعم 8 لغات مع RTL/LTR support كامل.

## Supported Languages

| اللغة | Code | Direction | Status |
|-------|------|-----------|--------|
| العربية | `ar` | RTL | ✅ Complete |
| English | `en` | LTR | ✅ Complete |
| Français | `fr` | LTR | ⚠️ Partial |
| Español | `es` | LTR | ⚠️ Partial |
| Deutsch | `de` | LTR | ⚠️ Partial |
| Italiano | `it` | LTR | ⚠️ Partial |
| Türkçe | `tr` | LTR | ⚠️ Partial |
| Português | `pt` | LTR | ⚠️ Partial |

## Implementation

### 1. Translation Files Structure

```
locales/
├── ar.ts    (Arabic - Complete)
├── en.ts    (English - Complete)
├── fr.ts    (French - Partial)
├── es.ts    (Spanish - Partial)
├── de.ts    (German - Partial)
├── it.ts    (Italian - Partial)
├── tr.ts    (Turkish - Partial)
└── pt.ts    (Portuguese - Partial)
```

### 2. Translation Keys Structure

```typescript
{
  common: {
    loading, error, retry, cancel, confirm, save, delete, done, close
  },
  
  leagues: {
    // Page Info
    title, subtitle, searchPlaceholder,
    
    // Tabs & Filters
    results, predictions, live, today, upcoming, topLeagues,
    
    // Stats
    accuracy, points, streak, bestStreak, totalPredictions,
    
    // States
    loadingMatches, noMatches, noMatchesAvailable, noMatchesFound,
    usingCache, refreshing,
    
    // Empty States
    emptyTitle, emptySubtitle, emptySearch, emptyPredictions
  },
  
  matchDetails: {
    // Status
    statusLive, statusFinished, statusUpcoming,
    
    // Tabs
    lineups, statistics, events, form,
    
    // Content
    startingXI, substitutes, coach, formation,
    noLineups, noStats, noEvents, beforeMatch
  },
  
  predictions: {
    // Actions
    predict, makePrediction, choosePrediction, submitPrediction,
    
    // Labels
    yourPrediction, homeWin, awayWin, draw,
    
    // States
    submitting, canPredictOnly, noPredictableMatches,
    
    // Alerts
    alertTitle, cannotPredictLive,
    successTitle, successMessage,
    errorTitle, errorMessage,
    
    // Results
    correctPrediction, wrongPrediction
  },
  
  // ... other sections
}
```

## Usage

### Basic Usage

```typescript
import { useLanguage } from '../contexts/LanguageContext';

const MyComponent = () => {
  const { t, language, isRTL } = useLanguage();
  
  return (
    <View>
      <Text>{t.leagues.title}</Text>
      <Text>{t.predictions.predict}</Text>
    </View>
  );
};
```

### Change Language

```typescript
const { setLanguage } = useLanguage();

// Change to English
await setLanguage('en');

// Change to Arabic
await setLanguage('ar');
```

### RTL Support

```typescript
const { isRTL, direction } = useLanguage();

<View style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
  <Text>{t.common.save}</Text>
</View>
```

## Leagues Page Translation Coverage

### ✅ Fully Translated Components

1. **Header Section**
   - Title: `t.leagues.title`
   - Subtitle: `t.leagues.subtitle`
   - Live count badge
   - Coins badge

2. **Stats Cards**
   - Today's matches: `t.leagues.todayMatchesCount`
   - Prediction accuracy: `t.leagues.predictionAccuracy`
   - Best streak: `t.leagues.bestStreakCount`
   - Current streak: `t.leagues.currentStreak`

3. **Search Bar**
   - Placeholder: `t.leagues.searchPlaceholder`

4. **Quick Filters**
   - Today: `t.leagues.today`
   - Live: `t.leagues.live`
   - Upcoming: `t.leagues.upcoming`
   - Top 5: `t.leagues.topLeagues`

5. **Tab Selector**
   - Results: `t.leagues.results`
   - Predictions: `t.leagues.predictions`

6. **Match Card**
   - Status (Live/Finished/Upcoming): `t.matchDetails.status*`
   - Predict button: `t.predictions.predict`
   - Your prediction: `t.predictions.yourPrediction`
   - Win/Draw labels: `t.predictions.homeWin`, `t.predictions.draw`
   - Correct/Wrong: `t.predictions.correctPrediction`

7. **Prediction Modal**
   - Title: `t.predictions.choosePrediction`
   - Submit button: `t.predictions.submitPrediction`
   - Submitting state: `t.predictions.submitting`
   - Draw button: `t.predictions.draw`

8. **Alerts**
   - Cannot predict: `t.predictions.cannotPredictLive`
   - Success: `t.predictions.successMessage`
   - Error: `t.predictions.errorMessage`

9. **Loading & Empty States**
   - Loading: `t.leagues.loadingMatches`
   - Cache indicator: `t.leagues.usingCache`
   - No matches: `t.leagues.noMatchesAvailable`
   - Empty search: `t.leagues.noMatchesFound`
   - Empty predictions: `t.predictions.noPredictableMatches`

10. **Error Messages**
    - Loading error: `t.common.errorLoadingMatches`

## Translation Checklist

### ✅ Completed
- [x] Page title and subtitle
- [x] Stats cards labels
- [x] Search placeholder
- [x] Filter labels
- [x] Tab labels
- [x] Match status labels
- [x] Prediction buttons and labels
- [x] Modal content
- [x] Alert messages
- [x] Loading states
- [x] Empty states
- [x] Error messages
- [x] Cache indicator

### ❌ Not Applicable
- [ ] API responses (handled by backend)
- [ ] Console logs (for debugging)
- [ ] Comments in code (for developers)

## Best Practices

### ✅ Do's
1. **Always use translation keys**
   ```typescript
   // ✅ Good
   <Text>{t.leagues.title}</Text>
   
   // ❌ Bad
   <Text>المباريات</Text>
   ```

2. **Use dynamic content properly**
   ```typescript
   // ✅ Good
   `${t.predictions.homeWin} ${match.homeTeam}`
   
   // ❌ Bad
   `فوز ${match.homeTeam}`
   ```

3. **Handle plurals**
   ```typescript
   // ✅ Good
   const matchesText = count === 1 ? t.leagues.match : t.leagues.matches;
   ```

4. **Consider RTL layout**
   ```typescript
   // ✅ Good
   flexDirection: isRTL ? 'row-reverse' : 'row'
   ```

### ❌ Don'ts
1. **Never hardcode text**
   ```typescript
   // ❌ Never do this
   <Text>مباريات اليوم</Text>
   <Text>Today's Matches</Text>
   ```

2. **Don't mix languages**
   ```typescript
   // ❌ Bad
   <Text>{t.leagues.title} - Today</Text>
   
   // ✅ Good
   <Text>{t.leagues.title} - {t.leagues.today}</Text>
   ```

3. **Don't forget to add to all language files**
   ```typescript
   // When adding new key to ar.ts, also add to:
   // - en.ts
   // - fr.ts
   // - es.ts
   // - de.ts
   // - it.ts
   // - tr.ts
   // - pt.ts
   ```

## Adding New Translations

### Step 1: Add to Arabic (ar.ts)
```typescript
export const ar = {
  // ... existing translations
  newSection: {
    newKey: 'النص بالعربي',
  },
};
```

### Step 2: Add to English (en.ts)
```typescript
export const en = {
  // ... existing translations
  newSection: {
    newKey: 'Text in English',
  },
};
```

### Step 3: Add to other languages
Repeat for fr.ts, es.ts, de.ts, it.ts, tr.ts, pt.ts

### Step 4: Use in component
```typescript
const { t } = useLanguage();
<Text>{t.newSection.newKey}</Text>
```

## Testing Translations

### Manual Testing
1. Open Settings
2. Change language
3. Navigate to Leagues page
4. Verify all text is translated
5. Test RTL layout (Arabic)
6. Test LTR layout (English)

### Automated Testing
```typescript
// Test all keys exist
describe('Translations', () => {
  it('should have all required keys', () => {
    expect(ar.leagues.title).toBeDefined();
    expect(en.leagues.title).toBeDefined();
  });
  
  it('should match structure', () => {
    expect(Object.keys(ar)).toEqual(Object.keys(en));
  });
});
```

## Common Issues & Solutions

### Issue 1: Text not translating
**Solution:** Check if key exists in translation file
```typescript
// Debug
console.log(t.leagues.title); // Should show translated text
```

### Issue 2: RTL layout broken
**Solution:** Use isRTL for layout
```typescript
const { isRTL } = useLanguage();
<View style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }} />
```

### Issue 3: Missing translation key
**Solution:** Add to all language files
```typescript
// Add to ar.ts, en.ts, fr.ts, etc.
```

## Statistics

### Leagues Page Coverage
- **Total text elements:** ~50
- **Translated:** 50 (100%)
- **Hardcoded:** 0 (0%)
- **Status:** ✅ Complete

### Overall App Coverage
- **Arabic (ar):** 100%
- **English (en):** 100%
- **Other languages:** ~60% (need completion)

## Future Improvements

1. **Complete other languages**
   - Finish fr, es, de, it, tr, pt translations
   - Get native speakers to review

2. **Add more languages**
   - Chinese (zh)
   - Japanese (ja)
   - Russian (ru)
   - Hindi (hi)

3. **Pluralization support**
   - Add plural rules for each language
   - Handle singular/plural forms

4. **Date/Time formatting**
   - Locale-specific date formats
   - Locale-specific time formats

5. **Number formatting**
   - Locale-specific number formats
   - Currency formatting

## Resources

- [React Native i18n](https://reactnative.dev/docs/i18nmanager)
- [RTL Support Guide](https://reactnative.dev/docs/i18nmanager)
- [Translation Best Practices](https://phrase.com/blog/posts/react-native-internationalization/)

## Conclusion

The Leagues page is now **100% translated** with full support for:
- ✅ Arabic (RTL)
- ✅ English (LTR)
- ✅ Dynamic content
- ✅ All UI elements
- ✅ Error messages
- ✅ Loading states
- ✅ Empty states

**No hardcoded text remains!** 🎉
