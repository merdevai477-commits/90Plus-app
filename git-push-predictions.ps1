# ================================================================
# Git Push Script - Predictions System (PowerShell)
# نظام التوقعات - رفع التغييرات إلى GitHub
# ================================================================

Write-Host "🚀 Starting Git Push for Predictions System..." -ForegroundColor Cyan
Write-Host ""

# ================================================================
# 1. Frontend Repository (Submodule)
# ================================================================
Write-Host "📦 Step 1: Committing Frontend changes..." -ForegroundColor Yellow
Set-Location -Path "front"

# Add all modified and new files
git add "app/(tabs)/matches.tsx"
git add "components/Matches/MatchTabs.tsx"
git add "components/Matches/PredictionsSection.tsx"
git add "services/predictions.service.ts"
git add "locales/ar.ts"
git add "locales/de.ts"
git add "locales/en.ts"
git add "locales/es.ts"
git add "locales/fr.ts"
git add "locales/it.ts"
git add "locales/pt.ts"
git add "locales/tr.ts"

# Commit with descriptive message
$frontendCommitMessage = @"
✨ feat: Add Predictions System to Matches Screen

🎯 Features Added:
- New 'Predictions' tab in matches screen
- PredictionsSection component for upcoming matches
- Prediction buttons (Home Win/Draw/Away Win)
- Integration with coins system (5 coins per prediction, +10 for correct)
- Daily limit: 10 predictions per day
- Display only 10 random matches (prioritizing major leagues)
- Prediction results display after match completion
- Full i18n support for 8 languages

📝 Files Modified:
- app/(tabs)/matches.tsx - Added predictions tab handling
- components/Matches/MatchTabs.tsx - Added predictions tab
- components/Matches/PredictionsSection.tsx - NEW prediction component
- services/predictions.service.ts - NEW API service
- locales/*.ts - Added translations for all languages

🔧 Technical Details:
- Smart match selection: Major leagues first, then alphabetical
- Random selection algorithm (Fisher-Yates)
- Optimized with useMemo for performance
- Seamless integration with CoinsContext
- Real-time prediction tracking

✅ Backend Integration:
- Uses existing /api/predictions endpoints
- Automatic prediction resolution via PredictionWatcherService
- Coin rewards handled by PredictionResolverService
"@

git commit -m $frontendCommitMessage

# Push to remote
Write-Host "📤 Pushing frontend changes..." -ForegroundColor Yellow
git push origin master

Write-Host "✅ Frontend changes pushed successfully!" -ForegroundColor Green
Write-Host ""

# Return to root
Set-Location -Path ".."

# ================================================================
# 2. Backend Repository
# ================================================================
Write-Host "📦 Step 2: Committing Backend changes..." -ForegroundColor Yellow

# Add backend files
git add "Backend/src/routes/predictions.routes.ts"

# Add documentation
git add "PREDICTIONS_SYSTEM.md"

# Commit backend changes
$backendCommitMessage = @"
⚙️ backend: Update Predictions System - Increase Daily Limit

🔧 Changes:
- Increased DAILY_PREDICTION_LIMIT from 5 to 10
- Updated comments with Arabic explanations
- Added comprehensive system documentation

📄 Files Modified:
- Backend/src/routes/predictions.routes.ts
- PREDICTIONS_SYSTEM.md (NEW)

📊 Constants Updated:
- DAILY_PREDICTION_LIMIT: 5 → 10
- PREDICTION_COST: 5 coins (unchanged)
- CORRECT_PREDICTION_REWARD: 10 coins (unchanged)

📚 Documentation:
- Complete system overview in Arabic/English
- Usage scenarios and examples
- Technical architecture details
- Future improvement suggestions

✅ Backend Services Already Running:
- PredictionWatcherService (checks every 5 minutes)
- PredictionResolverService (auto-resolves predictions)
- Full integration with existing match tracking
"@

git commit -m $backendCommitMessage

# Push to remote
Write-Host "📤 Pushing backend changes..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Backend changes pushed successfully!" -ForegroundColor Green
Write-Host ""

# ================================================================
# 3. Summary
# ================================================================
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ All changes pushed successfully to GitHub!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Summary of Changes:" -ForegroundColor Yellow
Write-Host "  ✅ Frontend: 12 files modified/added" -ForegroundColor White
Write-Host "  ✅ Backend: 1 file modified" -ForegroundColor White
Write-Host "  ✅ Documentation: 1 file added" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Predictions System is now live on GitHub!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
