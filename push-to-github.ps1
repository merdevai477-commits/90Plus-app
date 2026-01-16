# Script to push all changes to GitHub
# استخدم هذا السكريبت لرفع كل التحديثات على GitHub

Write-Host "🚀 Starting Git Push Process..." -ForegroundColor Green
Write-Host ""

# 1. Check current status
Write-Host "📊 Checking current status..." -ForegroundColor Cyan
git status
Write-Host ""

# 2. Show current remote
Write-Host "🔗 Current remote repository:" -ForegroundColor Cyan
git remote -v
Write-Host ""

# 3. Ask user if they want to change remote
$changeRemote = Read-Host "Do you want to change the remote repository? (y/n)"
if ($changeRemote -eq "y" -or $changeRemote -eq "Y") {
    $newRemote = Read-Host "Enter your new GitHub repository URL (e.g., https://github.com/username/repo.git)"
    
    Write-Host "🔄 Removing old remote..." -ForegroundColor Yellow
    git remote remove origin
    
    Write-Host "➕ Adding new remote..." -ForegroundColor Yellow
    git remote add origin $newRemote
    
    Write-Host "✅ Remote updated successfully!" -ForegroundColor Green
    git remote -v
    Write-Host ""
}

# 4. Add all changes
Write-Host "📦 Adding all changes..." -ForegroundColor Cyan
git add .
Write-Host ""

# 5. Ask for commit message
$commitMessage = Read-Host "Enter commit message (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "🔧 Fix: Updated predictions service to use centralized API config + CommentsModal cleanup"
}

# 6. Commit changes
Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git commit -m "$commitMessage"
Write-Host ""

# 7. Push to GitHub
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan
$branch = git branch --show-current
Write-Host "Pushing to branch: $branch" -ForegroundColor Yellow

git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "🎉 Railway will automatically deploy your changes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Check Railway dashboard for deployment status" -ForegroundColor White
    Write-Host "   2. Wait for deployment to complete (usually 2-5 minutes)" -ForegroundColor White
    Write-Host "   3. Test your app with the new changes" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Failed to push to GitHub!" -ForegroundColor Red
    Write-Host "Please check the error message above and try again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
