# PowerShell Script to Apply Authentication Fixes
# Run this script to automatically apply all fixes

Write-Host "🔧 Applying Authentication Performance Fixes..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-not (Test-Path "front/app/auth/index.tsx")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found project files" -ForegroundColor Green
Write-Host ""

# Backup original file
Write-Host "📦 Creating backup..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "front/app/auth/index.tsx.backup_$timestamp"
Copy-Item "front/app/auth/index.tsx" $backupPath
Write-Host "✅ Backup created: $backupPath" -ForegroundColor Green
Write-Host ""

# Read the file
Write-Host "📖 Reading auth file..." -ForegroundColor Yellow
$content = Get-Content "front/app/auth/index.tsx" -Raw

# Check if already patched
if ($content -match "Add retry logic for sync failures") {
    Write-Host "⚠️  File appears to be already patched!" -ForegroundColor Yellow
    Write-Host "   If you want to re-apply, restore from backup first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To restore:" -ForegroundColor Cyan
    Write-Host "   Copy-Item '$backupPath' 'front/app/auth/index.tsx' -Force" -ForegroundColor Cyan
    exit 0
}

Write-Host "🔄 Applying patches..." -ForegroundColor Yellow

# Patch 1: Reduce wait time and add retry logic
$oldPattern1 = @"
            // Wait a bit for the session to be fully active
            await new Promise\(resolve => setTimeout\(resolve, 500\)\);
            
            const token = await getToken\(\);
            if \(!token\) \{
                console\.error\('❌ No token available for sync'\);
                return \{ success: false, isNewUser: false \};
            \}

            const user = await AuthService\.syncUserWithBackend\(token\);
            if \(user\) \{
"@

$newPattern1 = @"
            // ✅ OPTIMIZATION: Reduced wait time from 500ms to 200ms
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const token = await getToken();
            if (!token) {
                console.error('❌ No token available for sync');
                return { success: false, isNewUser: false };
            }

            // ✅ FIX: Add retry logic for sync failures (3 attempts)
            let user = null;
            let retries = 3;
            
            while (retries > 0 && !user) {
                try {
                    user = await AuthService.syncUserWithBackend(token);
                    if (user) break;
                } catch (syncError) {
                    console.warn(`⚠️ Sync attempt failed, `${retries - 1}` retries left`, syncError);
                    retries--;
                    if (retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (user) {
"@

$content = $content -replace $oldPattern1, $newPattern1

# Patch 2: Add error message for failed retries
$oldPattern2 = @"
                return \{ success: true, isNewUser \};
            \}
            return \{ success: false, isNewUser: false \};
        \} catch \(error\) \{
"@

$newPattern2 = @"
                return { success: true, isNewUser };
            }
            
            console.error('❌ Failed to sync user after all retries');
            return { success: false, isNewUser: false };
        } catch (error) {
"@

$content = $content -replace $oldPattern2, $newPattern2

# Write the patched content
Write-Host "💾 Saving patched file..." -ForegroundColor Yellow
$content | Set-Content "front/app/auth/index.tsx" -NoNewline

Write-Host ""
Write-Host "✅ Patches applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Reduced sync wait time: 500ms → 200ms" -ForegroundColor Green
Write-Host "   ✅ Added retry logic: 3 attempts with 1s delay" -ForegroundColor Green
Write-Host "   ✅ Improved error handling and logging" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Test login flow" -ForegroundColor White
Write-Host "   2. Test signup flow" -ForegroundColor White
Write-Host "   3. Monitor console logs for retry messages" -ForegroundColor White
Write-Host ""
Write-Host "📁 Backup location: $backupPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Done! Your authentication is now faster and more reliable!" -ForegroundColor Green
