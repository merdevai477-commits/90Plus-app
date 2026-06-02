# كيف تعرف سبب كراش الريلز من Sentry (iOS)

## الرابط

- المنظمة: **mrdev-pk**
- المشروع: **90plus-app**
- لوحة التحكم: https://de.sentry.io/organizations/mrdev-pk/issues/?project=90plus-app

## فلترة build 107

في صفحة **Issues** استخدم البحث:

```
dist:107
```

أو:

```
release:*1.0.1*107*
```

بعد الإصلاح الأخير، الـ release يظهر بالشكل:

`com.mhmdsh1892.ninetyplusapp@1.0.1+107`

## ماذا تتوقع؟

| نوع الكراش | في Sentry |
|------------|-----------|
| خطأ JavaScript (شاشة حمراء / Error Boundary) | Stack واضح + breadcrumbs `reels` |
| كراش native (AVPlayer) — التطبيق يقفل فجأة | Issue من نوع **Fatal** / **SIGABRT** / **EXC_BAD_ACCESS** |
| لا يوجد أي Issue | الـ build لم يُضمَّن فيه Sentry مبكراً، أو الـ DSN غير مفعّل في وقت البناء |

## build 107 تحديداً

إذا كان build **107** اتبنى **قبل** commit `b570449c5` (إعداد Sentry + metro)، قد **لا** يظهر الكراش في Sentry.

اعمل build جديد (**108+**) بعد آخر push وتأكد في EAS:

- `EXPO_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` (Sensitive)
- `SENTRY_ORG=mrdev-pk`
- `SENTRY_PROJECT=90plus-app`

## رفع الـ dSYM (مهم لـ iOS native)

بدون رفع رموز iOS، الـ stack يظهر `0x...` بدون أسماء دوال.

في EAS production يجب أن يكون:

- `SENTRY_DISABLE_AUTO_UPLOAD=false`
- `SENTRY_AUTH_TOKEN` موجود

بعد البناء: Sentry → **Settings → Projects → 90plus-app → Debug Files** وتأكد وجود ملفات للـ build.

## Breadcrumbs الريلز

قبل الكراش ابحث في الـ Issue عن breadcrumbs:

- `reel_active` مع `reelId` و `index`

## اختبار أن Sentry شغال

```bash
cd front
node scripts/test-sentry-ingest.mjs
```

ثم افتح Issues وابحث عن: `90Plus Sentry connectivity test`

## Issue مثال (من التطبيق)

إذا ظهر Issue مثل: `124506505` على https://mrdev-pk.sentry.io

افتح الحدث وانسخ لنا:

1. **Title** (أول سطر — مثلاً `EXC_BAD_ACCESS` أو `objc_exception_throw`)
2. **Stack trace** — أول 15 سطر
3. **Breadcrumbs** — هل يوجد `reel_active` قبل الكراش؟
4. **release** و **dist** (هل 107 أم 108؟)

### تفسير شائع لكراش الريلز على iOS

| ما يظهر في Sentry | المعنى |
|-------------------|--------|
| `AVPlayer` / `AVFoundation` / `CoreMedia` | كراش native في مشغّل الفيديو (الريلز) |
| `ExpoVideo` / `expo-video` / `VideoView` | نفس المنطقة عبر Expo |
| `player.replace` أو `useVideoPlayer` | تغيير مصدر الفيديو بسرعة بين ريلز |
| `EXC_BAD_ACCESS` / `SIGSEGV` | استخدام مشغّل بعد تحريره (سبب شائع عند السحب السريع) |

تم إصلاح: عدم استدعاء `player.replace()` مباشرة بعد إنشاء المشغّل (تحميل مزدوج لـ HLS).

---

## ملاحظة عن نافذة Apple

رسالة **"90Plus Crashed — Share"** ترسل التقرير لـ **Apple**، ليس لـ Sentry.

Sentry يستقبل الكراش تلقائياً من الـ SDK داخل التطبيق (إن كان مُفعَّلاً في نفس الـ build).
