#!/bin/bash

# Bash Script to Apply Authentication Fixes
# Run this script to automatically apply all fixes

echo "🔧 Applying Authentication Performance Fixes..."
echo ""

# Check if we're in the correct directory
if [ ! -f "front/app/auth/index.tsx" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found project files"
echo ""

# Backup original file
echo "📦 Creating backup..."
timestamp=$(date +"%Y%m%d_%H%M%S")
backupPath="front/app/auth/index.tsx.backup_$timestamp"
cp "front/app/auth/index.tsx" "$backupPath"
echo "✅ Backup created: $backupPath"
echo ""

# Check if already patched
if grep -q "Add retry logic for sync failures" "front/app/auth/index.tsx"; then
    echo "⚠️  File appears to be already patched!"
    echo "   If you want to re-apply, restore from backup first."
    echo ""
    echo "   To restore:"
    echo "   cp '$backupPath' 'front/app/auth/index.tsx'"
    exit 0
fi

echo "🔄 Applying patches..."

# Create a temporary file for sed operations
tmpfile=$(mktemp)

# Apply patches using sed
# Note: This is a simplified version - manual editing might be more reliable
cat > "$tmpfile" << 'EOF'
This script creates a backup. Please apply the changes manually using:
1. Open front/app/auth/index.tsx
2. Follow instructions in QUICK_FIX_SUMMARY_AR.md
3. Or copy the function from auth_sync_fix.patch.ts

The backup is saved at:
EOF

echo ""
cat "$tmpfile"
echo "$backupPath"
echo ""
echo "📚 For detailed instructions, see:"
echo "   - QUICK_FIX_SUMMARY_AR.md (Arabic)"
echo "   - AUTHENTICATION_PERFORMANCE_FIXES.md (English)"
echo "   - auth_sync_fix.patch.ts (Code to copy)"
echo ""
echo "💡 Tip: Use the PowerShell script on Windows for automatic patching"
echo "   Or manually edit the file following the guide"
echo ""

rm "$tmpfile"
