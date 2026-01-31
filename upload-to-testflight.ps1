# Upload to TestFlight Script
# سكريبت رفع التطبيق على TestFlight

Write-Host "🚀 بدء رفع التطبيق على TestFlight..." -ForegroundColor Green
Write-Host ""

# التأكد من وجود EAS CLI
Write-Host "📋 فحص EAS CLI..." -ForegroundColor Yellow
try {
    $easVersion = eas --version
    Write-Host "✅ EAS CLI موجود: $easVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ EAS CLI غير موجود. يرجى تثبيته أولاً:" -ForegroundColor Red
    Write-Host "npm install -g @expo/eas-cli" -ForegroundColor White
    exit 1
}

# الانتقال لمجلد front
Write-Host ""
Write-Host "📁 الانتقال لمجلد front..." -ForegroundColor Yellow
Set-Location front

# فحص تسجيل الدخول
Write-Host ""
Write-Host "🔐 فحص تسجيل الدخول..." -ForegroundColor Yellow
try {
    $whoami = eas whoami
    Write-Host "✅ مسجل دخول كـ: $whoami" -ForegroundColor Green
} catch {
    Write-Host "❌ غير مسجل دخول. يرجى تسجيل الدخول:" -ForegroundColor Red
    Write-Host "eas login" -ForegroundColor White
    Write-Host ""
    Write-Host "استخدم هذه البيانات:" -ForegroundColor Cyan
    Write-Host "Username: mrdev_10" -ForegroundColor White
    Write-Host "Password: iw5!T?JaJN%+Q93" -ForegroundColor White
    exit 1
}

# عرض الخيارات
Write-Host ""
Write-Host "اختر العملية المطلوبة:" -ForegroundColor Cyan
Write-Host "1. بناء التطبيق فقط (Build)" -ForegroundColor White
Write-Host "2. رفع على TestFlight فقط (Submit)" -ForegroundColor White
Write-Host "3. بناء ورفع معاً (Build + Submit)" -ForegroundColor White
Write-Host ""

$choice = Read-Host "أدخل رقم الخيار (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🔨 بدء بناء التطبيق..." -ForegroundColor Green
        Write-Host "⏱️  هذا قد يستغرق 15-30 دقيقة..." -ForegroundColor Yellow
        Write-Host ""
        
        try {
            eas build --platform ios --profile production
            Write-Host ""
            Write-Host "✅ تم بناء التطبيق بنجاح!" -ForegroundColor Green
            Write-Host "يمكنك الآن رفعه على TestFlight باستخدام الخيار 2" -ForegroundColor Cyan
        } catch {
            Write-Host ""
            Write-Host "❌ فشل في بناء التطبيق" -ForegroundColor Red
            Write-Host "تحقق من الأخطاء أعلاه" -ForegroundColor Yellow
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "📤 رفع آخر بناء على TestFlight..." -ForegroundColor Green
        Write-Host "⏱️  هذا قد يستغرق 5-10 دقائق..." -ForegroundColor Yellow
        Write-Host ""
        
        try {
            eas submit --platform ios --profile production
            Write-Host ""
            Write-Host "✅ تم رفع التطبيق على TestFlight بنجاح!" -ForegroundColor Green
            Write-Host "🎉 يمكنك الآن إضافة مختبرين في App Store Connect" -ForegroundColor Cyan
            Write-Host "🔗 https://appstoreconnect.apple.com" -ForegroundColor Blue
        } catch {
            Write-Host ""
            Write-Host "❌ فشل في رفع التطبيق" -ForegroundColor Red
            Write-Host "تأكد من وجود بناء جاهز أولاً" -ForegroundColor Yellow
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "🔨 بدء بناء التطبيق..." -ForegroundColor Green
        Write-Host "⏱️  هذا قد يستغرق 15-30 دقيقة..." -ForegroundColor Yellow
        Write-Host ""
        
        try {
            eas build --platform ios --profile production
            Write-Host ""
            Write-Host "✅ تم بناء التطبيق بنجاح!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📤 بدء رفع التطبيق على TestFlight..." -ForegroundColor Green
            Write-Host "⏱️  هذا قد يستغرق 5-10 دقائق..." -ForegroundColor Yellow
            Write-Host ""
            
            eas submit --platform ios --profile production
            Write-Host ""
            Write-Host "🎉 تم بناء ورفع التطبيق بنجاح!" -ForegroundColor Green
            Write-Host "يمكنك الآن إضافة مختبرين في App Store Connect" -ForegroundColor Cyan
            Write-Host "🔗 https://appstoreconnect.apple.com" -ForegroundColor Blue
            
        } catch {
            Write-Host ""
            Write-Host "❌ فشل في العملية" -ForegroundColor Red
            Write-Host "تحقق من الأخطاء أعلاه" -ForegroundColor Yellow
        }
    }
    
    default {
        Write-Host ""
        Write-Host "❌ خيار غير صحيح" -ForegroundColor Red
        Write-Host "يرجى اختيار رقم من 1 إلى 3" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📞 للمساعدة: merdevai477@gmail.com" -ForegroundColor Cyan
Write-Host "🔙 العودة للمجلد الرئيسي..." -ForegroundColor Yellow
Set-Location ..