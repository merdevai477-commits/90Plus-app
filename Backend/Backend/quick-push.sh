#!/bin/bash
# Quick Git Push - No prompts, uses default message

echo "🚀 Quick Push to GitHub..."
git add .
git commit -m "fix: TypeScript errors and component updates"
git push

if [ $? -eq 0 ]; then
    echo "✅ Done!"
else
    echo "❌ Failed! Run git-push.sh for detailed process"
fi
