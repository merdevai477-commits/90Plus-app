#!/bin/bash

# 🔧 Automated Fix Script: Replace console.log with logger
# This script replaces all console statements with the logger service

echo "🔍 Starting console.log replacement..."

# Count before
BEFORE_LOG=$(grep -r "console\.log(" front/contexts front/services front/utils --include="*.ts" --include="*.tsx" | wc -l)
BEFORE_ERROR=$(grep -r "console\.error(" front/contexts front/services front/utils --include="*.ts" --include="*.tsx" | wc -l)
BEFORE_WARN=$(grep -r "console\.warn(" front/contexts front/services front/utils --include="*.ts" --include="*.tsx" | wc -l)

echo "📊 Found:"
echo "  - console.log: $BEFORE_LOG instances"
echo "  - console.error: $BEFORE_ERROR instances"
echo "  - console.warn: $BEFORE_WARN instances"

# Replace console.log with logger.info
find front/contexts front/services front/utils -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/__tests__/*" \
  ! -path "*/utils/logger.ts" \
  -exec sed -i 's/console\.log(/logger.info(/g' {} \;

# Replace console.error with logger.error
find front/contexts front/services front/utils -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/__tests__/*" \
  ! -path "*/utils/logger.ts" \
  -exec sed -i 's/console\.error(/logger.error(/g' {} \;

# Replace console.warn with logger.warn
find front/contexts front/services front/utils -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/__tests__/*" \
  ! -path "*/utils/logger.ts" \
  -exec sed -i 's/console\.warn(/logger.warn(/g' {} \;

# Count after
AFTER_LOG=$(grep -r "console\.log(" front/contexts front/services front/utils --include="*.ts" --include="*.tsx" | wc -l)
AFTER_ERROR=$(grep -r "console\.error(" front/contexts front/services front/utils --include="*.ts" --include="*.tsx" | wc -l)
AFTER_WARN=$(grep -r "console\.warn(" front/contexts front/services front/utils --include="*.ts" --include="*.tsx" | wc -l)

echo ""
echo "✅ Replacement complete!"
echo "📊 After:"
echo "  - console.log: $AFTER_LOG instances (removed: $((BEFORE_LOG - AFTER_LOG)))"
echo "  - console.error: $AFTER_ERROR instances (removed: $((BEFORE_ERROR - AFTER_ERROR)))"
echo "  - console.warn: $AFTER_WARN instances (removed: $((BEFORE_WARN - AFTER_WARN)))"

# Add logger import if missing
echo ""
echo "🔍 Adding logger imports where missing..."

find front/contexts front/services front/utils -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/__tests__/*" \
  ! -path "*/utils/logger.ts" \
  -exec sh -c '
    if grep -q "logger\." "$1" && ! grep -q "import.*logger.*from" "$1"; then
      echo "Adding logger import to $1"
      sed -i "1i import { logger } from \"@/utils/logger\";\n" "$1"
    fi
  ' sh {} \;

echo ""
echo "✅ All console statements replaced with logger!"
echo "⚠️  Note: Review the changes and test thoroughly before committing."
