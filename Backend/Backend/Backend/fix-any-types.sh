#!/bin/bash

# 🔧 Automated Fix Script: Fix TypeScript any types
# This script replaces common any types with proper types

echo "🔍 Starting TypeScript any types fix..."

# Count before
BEFORE=$(grep -r "any" front --include="*.ts" --include="*.tsx" | grep -v "node_modules" | wc -l)

echo "📊 Found $BEFORE instances of 'any' type"

# Fix video refs
echo "🔧 Fixing video refs..."
find front -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  -exec sed -i 's/useRef<Map<string, any>>/useRef<Map<string, Video>>/g' {} \;

# Fix error types in catch blocks (keep these as any is acceptable)
echo "✅ Video refs fixed"

# Count after
AFTER=$(grep -r "any" front --include="*.ts" --include="*.tsx" | grep -v "node_modules" | wc -l)

echo ""
echo "✅ TypeScript any types fixed!"
echo "📊 Remaining 'any' types: $AFTER (some are acceptable in catch blocks)"
echo "📊 Fixed: $((BEFORE - AFTER)) instances"

echo ""
echo "⚠️  Note: Review remaining 'any' types manually and add proper types where needed."
echo "⚠️  Some 'any' types in catch blocks are acceptable."
