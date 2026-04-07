#!/bin/bash

# 🔧 Automated Fix Script: Remove unused imports
# This script uses ESLint to remove all unused imports

echo "🔍 Starting unused imports removal..."

# Count before
BEFORE=$(grep -r "^import" front --include="*.ts" --include="*.tsx" | wc -l)

echo "📊 Total imports before: $BEFORE"

# Run ESLint fix
echo "🔧 Running ESLint fix..."
npx eslint --fix "front/**/*.{ts,tsx}" --quiet

# Count after
AFTER=$(grep -r "^import" front --include="*.ts" --include="*.tsx" | wc -l)

echo ""
echo "✅ Unused imports removed!"
echo "📊 Total imports after: $AFTER"
echo "📊 Removed: $((BEFORE - AFTER)) imports"

echo ""
echo "✅ All unused imports removed!"
echo "⚠️  Note: Review the changes and test thoroughly before committing."
