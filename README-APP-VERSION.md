# نظام التحكم في إصدارات التطبيق

## كيفية إيقاف النسخة القديمة من APK

### الطريقة 1: استخدام Environment Variables (في Railway)

1. اذهب إلى Railway Dashboard → Project → Variables
2. أضف المتغيرات التالية:

```env
APP_MINIMUM_VERSION=1.0.1
APP_FORCE_UPDATE=true
APP_MAINTENANCE_MODE=false
APP_UPDATE_MESSAGE=يجب تحديث التطبيق لاستمرار الاستخدام
APP_UPDATE_URL_ANDROID=https://play.google.com/store/apps/details?id=com.mrdev187.ninetyplusapp
```

### الطريقة 2: استخدام Admin API

```bash
POST https://90plus-app-production.up.railway.app/api/app/admin/version
Headers: Authorization: Bearer <admin-token>
Body:
{
  "minimumVersion": "1.0.1",
  "forceUpdate": true,
  "updateMessage": "يجب تحديث التطبيق لاستمرار الاستخدام"
}
```

### الطريقة 3: وضع الصيانة (Maintenance Mode)

```bash
POST https://90plus-app-production.up.railway.app/api/app/admin/version
Headers: Authorization: Bearer <admin-token>
Body:
{
  "maintenanceMode": true,
  "maintenanceMessage": "التطبيق تحت الصيانة. يرجى المحاولة لاحقاً."
}
```

## Endpoints المتاحة

### Public Endpoints:
- `GET /api/app/version` - التحقق من إصدار التطبيق
- `GET /api/app/status` - الحصول على حالة التطبيق

### Admin Endpoints:
- `GET /api/app/admin/version` - الحصول على إعدادات الإصدار
- `POST /api/app/admin/version` - تحديث إعدادات الإصدار

## مثال على الاستخدام

### إيقاف جميع النسخ القديمة:
```json
{
  "minimumVersion": "1.0.1",
  "forceUpdate": true,
  "updateMessage": "يجب تحديث التطبيق لاستمرار الاستخدام"
}
```

### إيقاف التطبيق تماماً (وضع الصيانة):
```json
{
  "maintenanceMode": true,
  "maintenanceMessage": "التطبيق تحت الصيانة. يرجى المحاولة لاحقاً."
}
```

