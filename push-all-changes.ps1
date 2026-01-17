# Push All Changes to GitHub
# Script to commit and push all Backend and Frontend changes

Write-Host "🚀 Starting Git Push Process..." -ForegroundColor Cyan
Write-Host ""

# Function to check if git is installed
function Test-GitInstalled {
    try {
        git --version | Out-Null
        return $true
    }
    catch {
        Write-Host "❌ Git is not installed or not in PATH" -ForegroundColor Red
        return $false
    }
}

# Function to check if we're in a git repository
function Test-GitRepository {
    try {
        git rev-parse --git-dir 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

# Check prerequisites
if (-not (Test-GitInstalled)) {
    Write-Host "Please install Git first: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-GitRepository)) {
    Write-Host "❌ Not a git repository. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Git is installed and repository detected" -ForegroundColor Green
Write-Host ""

# Check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "📍 Current branch: $currentBranch" -ForegroundColor Cyan
Write-Host ""

# Check for uncommitted changes
Write-Host "🔍 Checking for changes..." -ForegroundColor Cyan
$status = git status --porcelain

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
    Write-Host ""
    
    # Ask if user wants to push anyway
    $pushAnyway = Read-Host "Do you want to push existing commits? (y/n)"
    if ($pushAnyway -ne 'y') {
        Write-Host "❌ Aborted by user" -ForegroundColor Yellow
        exit 0
    }
}
else {
    Write-Host "📝 Found changes:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    
    # Show detailed changes
    Write-Host "📊 Summary of changes:" -ForegroundColor Cyan
    $modified = (git diff --name-only).Count
    $staged = (git diff --cached --name-only).Count
    $untracked = (git ls-files --others --exclude-standard).Count
    
    Write-Host "  Modified: $modified files" -ForegroundColor Yellow
    Write-Host "  Staged: $staged files" -ForegroundColor Green
    Write-Host "  Untracked: $untracked files" -ForegroundColor Magenta
    Write-Host ""
    
    # Ask for commit message
    Write-Host "💬 Enter commit message (or press Enter for default):" -ForegroundColor Cyan
    $commitMessage = Read-Host
    
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "🔧 Fix predictions authentication and update UI

Changes:
- Fixed Backend predictions routes to use req.auth.userId
- Removed x-clerk-user-id header from Frontend service
- Changed terminology from تذاكر to كوبونات
- Fixed VirtualizedList nesting warning in PredictionsSection
- Updated API URL to use Railway production URL
- Added requireAuth middleware to predictions endpoints"
    }
    
    Write-Host ""
    Write-Host "📝 Commit message:" -ForegroundColor Cyan
    Write-Host $commitMessage -ForegroundColor White
    Write-Host ""
    
    # Confirm before committing
    $confirm = Read-Host "Proceed with commit? (y/n)"
    if ($confirm -ne 'y') {
        Write-Host "❌ Aborted by user" -ForegroundColor Yellow
        exit 0
    }
    
    # Stage all changes
    Write-Host ""
    Write-Host "📦 Staging all changes..." -ForegroundColor Cyan
    git add .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to stage changes" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Changes staged successfully" -ForegroundColor Green
    Write-Host ""
    
    # Commit changes
    Write-Host "💾 Committing changes..." -ForegroundColor Cyan
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to commit changes" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Changes committed successfully" -ForegroundColor Green
    Write-Host ""
}

# Check remote
Write-Host "🌐 Checking remote repository..." -ForegroundColor Cyan
$remote = git remote -v | Select-String "origin.*push"

if ([string]::IsNullOrWhiteSpace($remote)) {
    Write-Host "❌ No remote repository configured" -ForegroundColor Red
    Write-Host "Please add a remote first: git remote add origin <url>" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Remote repository: $remote" -ForegroundColor Green
Write-Host ""

# Push to remote
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan
Write-Host "Branch: $currentBranch" -ForegroundColor Yellow
Write-Host ""

git push origin $currentBranch

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  1. Authentication failed - check your credentials" -ForegroundColor White
    Write-Host "  2. Branch doesn't exist on remote - use: git push -u origin $currentBranch" -ForegroundColor White
    Write-Host "  3. Remote has changes - pull first: git pull origin $currentBranch" -ForegroundColor White
    Write-Host ""
    
    # Ask if user wants to force push
    $forcePush = Read-Host "Do you want to force push? (y/n) [DANGEROUS]"
    if ($forcePush -eq 'y') {
        Write-Host ""
        Write-Host "⚠️  FORCE PUSHING..." -ForegroundColor Red
        git push -f origin $currentBranch
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Force push failed" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✅ Force push successful" -ForegroundColor Green
    }
    else {
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host ""

# Show final status
Write-Host "📊 Final Status:" -ForegroundColor Cyan
Write-Host "  Branch: $currentBranch" -ForegroundColor White
Write-Host "  Remote: origin" -ForegroundColor White
Write-Host "  Status: Up to date" -ForegroundColor Green
Write-Host ""

# Show last commit
Write-Host "📝 Last commit:" -ForegroundColor Cyan
git log -1 --oneline
Write-Host ""

Write-Host "🎉 Done! Your changes are now on GitHub." -ForegroundColor Green
Write-Host ""

# Ask if user wants to see the GitHub URL
$showUrl = Read-Host "Show GitHub repository URL? (y/n)"
if ($showUrl -eq 'y') {
    $repoUrl = git config --get remote.origin.url
    if ($repoUrl -match "git@github.com:(.+)\.git") {
        $repoUrl = "https://github.com/$($Matches[1])"
    }
    elseif ($repoUrl -match "https://github.com/(.+)\.git") {
        $repoUrl = "https://github.com/$($Matches[1])"
    }
    
    Write-Host ""
    Write-Host "🔗 Repository URL: $repoUrl" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
