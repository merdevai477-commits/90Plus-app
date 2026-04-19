#!/bin/bash

# Script to fix exposed error.message in backend routes
# Replace error.message with generic messages for security

echo "Fixing exposed error messages in backend routes..."

# Files to fix
files=(
  "src/routes/daily-spin.routes.ts"
  "src/routes/lucky-wheel.routes.ts"
  "src/routes/mux-webhook.routes.ts"
  "src/routes/profile.routes.ts"
  "src/routes/notification.routes.ts"
  "src/routes/matches.routes.ts"
  "src/routes/coins.routes.ts"
  "src/routes/clerk-user.routes.ts"
  "src/routes/app-version.routes.ts"
  "src/routes/admin.routes.ts"
  "src/controllers/storage.controller.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # This is a placeholder - actual fixes will be done via strReplace
  fi
done

echo "Done! Please review changes before committing."
