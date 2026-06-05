# تقرير جهاز Android — Local vs Remote Push

## الفرق الحاسم

| | Local (ريلز / تقدم الرفع) | Remote (LIKE / FOLLOW / MATCH) |
|---|---|---|
| API | `scheduleNotificationAsync` | `getExpoPushTokenAsync` + Expo Push API |
| يحتاج إذن OS | نعم | نعم |
| يحتاج FCM + EAS `projectId` | لا | **نعم (Android)** |
| يحتاج token في PostgreSQL | لا | **نعم** |
| يعمل في Expo Go | لا (الكود عندكم no-op في Go) | لا |

**إشعار تقدم الرفع = دليل على `expo-notifications` + إذن (أو طلب إذن عند الرفع)، وليس دليلاً على تسجيل Remote Push.**

مسار الرفع (`reelUploadNotification.ts`): عند `granted` يستدعي `capturePushTokenAfterPermission` — إذا فشل `getExpoPushTokenAsync` (FCM) يبقى الرفع المحلي يعمل والـ DB تبقى بدون token.

---

## ماذا يُطبع في اللوج (تقرير واحد)

من التطبيق (بعد التحديث):

```
[PUSH REPORT] context=app-cold-start
{ ... JSON ... }
[PUSH REPORT] verdict=...

[PUSH REPORT] context=signed-in-sync-start
...

[PUSH REPORT] context=signed-in-sync-end
...
```

الحقول:

- `platform` → `android`
- `isDevice` → `true` على موبايل حقيقي
- `appOwnership` → `standalone` في build المتجر (ليس `expo`)
- `projectId` → يجب أن يطابق `app.json` → `extra.eas.projectId`
- `permission.status` → **`granted` | `denied` | `undetermined`**
- `expoPushToken` → `ExponentPushToken[...]` أو `null`
- `expoPushTokenError` → رسالة FCM/Expo إن فشل التسجيل
- `verdict` → خلاصة واحدة

### تفعيل اللوج

1. **Metro (تطوير):** `__DEV__` يكفي — افتح التطبيق من `npx expo start` وابحث عن `[PUSH REPORT]`.
2. **Build متجر / EAS:** أضف في `eas.json` أو secrets:
   ```json
   "EXPO_PUBLIC_PUSH_TRACE": "1"
   ```
   ثم OTA أو build جديد، وعلى الجهاز:
   ```bash
   adb logcat | grep "PUSH REPORT"
   ```

### شاشة على الجهاز

افتح: **`/push-diagnostics`** → **Run Full Report** — يعرض نفس JSON على الشاشة (بدون adb).

---

## شجرة التشخيص

```
permission.status?
├── undetermined → لم يُمنح الإذن بعد؛ انتظر المودال أو ارفع ريلز واقبل الإذن
├── denied       → الإعدادات فقط؛ Remote لن يعمل حتى تفعّل الإشعارات للتطبيق
└── granted
    ├── expoPushToken = null + expoPushTokenError
    │       → FCM / Expo credentials / projectId (Android Registration)
    ├── expoPushToken = ExponentPushToken[...] + DB null
    │       → مشكلة Sync (تسجيل دخول / POST /push-token / شبكة)
    └── expoPushToken + DB MATCH
            → Remote infra OK؛ راجع أنواع الإشعارات في السيرفر
```

---

## اختبار سيرفر (بعد وجود token في DB)

```bash
npx tsx scripts/audit-push-tokens.ts --send-test --clerk-user-id YOUR_CLERK_ID
```
