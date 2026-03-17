#!/bin/bash

# 🚀 Quick Deploy to GitHub - No Prompts
# Fast deployment script for 90Plus updates

echo "🚀 Quick Deploy to GitHub..."
echo ""

# Add all changes
git add .

# Quick commit with timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "feat: profile system updates - brands & clubs optimization

- Complete profile translation to 8 languages
- Limited brands to: Nike, Adidas, Puma, New Balance  
- Limited clubs to top 10 European clubs
- Fixed all TypeScript errors
- Enhanced user experience

Deployed: $TIMESTAMP"

# Push to current branch
git push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully deployed to GitHub!"
    echo "🎉 All updates are now live!"
else
    echo ""
    echo "❌ Deployment failed!"
    echo "💡 Run ./deploy-to-github.sh for detailed process"
    exit 1
fi