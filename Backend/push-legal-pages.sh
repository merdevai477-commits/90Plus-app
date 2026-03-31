#!/bin/bash

echo "🚀 Starting Git push process for legal pages..."

# Pull latest changes first
echo "📥 Pulling latest changes from GitHub..."
git pull origin main --no-edit

# Add the legal pages
echo "📄 Adding legal pages to git..."
git add Backend/public/privacy-policy.html
git add Backend/public/support.html  
git add Backend/public/terms-of-service.html

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "❌ No changes to commit"
    exit 0
fi

# Commit with descriptive message
echo "💾 Committing changes..."
git commit -m "feat: Add professional legal pages for App Store compliance

✅ Privacy Policy - Comprehensive data protection policy
✅ Terms of Service - Complete legal terms and conditions  
✅ Support Center - Professional help and FAQ system

Features:
- Apple App Store & Google Play compliant
- Responsive design with brand colors
- Detailed third-party service disclosures
- GDPR & CCPA compliance sections
- Professional contact information
- Emergency support channels
- Complete feature coverage (videos, blocking, predictions)

Ready for app store submission 🎯"

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed legal pages to GitHub!"
    echo "🎉 Legal pages are now live and ready for App Store submission"
else
    echo "❌ Failed to push to GitHub"
    echo "💡 Try running the script again or check your internet connection"
    exit 1
fi

echo "🏁 Done!"