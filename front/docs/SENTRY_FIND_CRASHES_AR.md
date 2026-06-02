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

## ملاحظة عن نافذة Apple

رسالة **"90Plus Crashed — Share"** ترسل التقرير لـ **Apple**، ليس لـ Sentry.

Sentry يستقبل الكراش تلقائياً من الـ SDK داخل التطبيق (إن كان مُفعَّلاً في نفس الـ build).
