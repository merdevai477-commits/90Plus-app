# Utility Scripts

## Cloudflare R2 Management

Scripts للتعامل مع Cloudflare R2 storage.

### List Files
عرض الملفات في الـ bucket:
```bash
# List all files
npx tsx scripts/r2-list-files.ts

# List files with specific prefix
npx tsx scripts/r2-list-files.ts reels/
npx tsx scripts/r2-list-files.ts avatars/
```

### Upload File
رفع ملف للـ R2:
```bash
npx tsx scripts/r2-upload-file.ts <local-file-path> <r2-key>

# Example:
npx tsx scripts/r2-upload-file.ts ./test.jpg avatars/test-user/test.jpg
```

### Delete File
حذف ملف من R2:
```bash
npx tsx scripts/r2-delete-file.ts <r2-key>

# Example:
npx tsx scripts/r2-delete-file.ts avatars/test-user/test.jpg
```

## Redis Cache Management

### Clear Cache
مسح الـ cache:
```bash
npx tsx clear-redis-cache.ts
```

## Push Notifications Testing

### Test Push Notifications
اختبار الـ push notifications:
```bash
npx tsx scripts/test-push-notification.ts <expo-push-token>

# Example:
npx tsx scripts/test-push-notification.ts ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
```

الـ script بيختبر:
- Regular notification (عادية)
- Silent notification (صامتة)
- Goal notification (هدف)

## Notes

- كل الـ scripts بتستخدم الـ credentials من `.env` file
- R2 credentials: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- Redis URL: `REDIS_URL`
