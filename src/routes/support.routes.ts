/**
 * Support Routes
 * صفحات الدعم والمساعدة
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /support
 * صفحة الدعم الرئيسية
 */
router.get('/support', (_req: Request, res: Response): void => {
    const supportPage = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>90Plus - الدعم والمساعدة</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #4A148C 0%, #7B1FA2 100%);
                min-height: 100vh;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: white;
                margin-top: 50px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4A148C;
            }
            
            .logo {
                width: 80px;
                height: 80px;
                margin: 0 auto 20px;
                background: #4A148C;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }
            
            h1 {
                color: #4A148C;
                margin-bottom: 10px;
            }
            
            .subtitle {
                color: #666;
                font-size: 18px;
            }
            
            .section {
                margin-bottom: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
                border-left: 4px solid #4A148C;
            }
            
            .section h2 {
                color: #4A148C;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .contact-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            
            .contact-item {
                background: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                transition: transform 0.3s ease;
            }
            
            .contact-item:hover {
                transform: translateY(-5px);
            }
            
            .contact-item .icon {
                font-size: 30px;
                margin-bottom: 10px;
                color: #4A148C;
            }
            
            .contact-item h3 {
                color: #4A148C;
                margin-bottom: 10px;
            }
            
            .contact-item a {
                color: #7B1FA2;
                text-decoration: none;
                font-weight: bold;
            }
            
            .contact-item a:hover {
                text-decoration: underline;
            }
            
            .faq-item {
                margin-bottom: 20px;
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            
            .faq-question {
                font-weight: bold;
                color: #4A148C;
                margin-bottom: 10px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .faq-answer {
                color: #666;
                line-height: 1.6;
            }
            
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #666;
            }
            
            @media (max-width: 768px) {
                .container {
                    margin: 20px;
                    padding: 15px;
                }
                
                .contact-info {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">90+</div>
                <h1>مركز الدعم والمساعدة</h1>
                <p class="subtitle">نحن هنا لمساعدتك في أي وقت</p>
            </div>
            
            <div class="section">
                <h2>📞 تواصل معنا</h2>
                <p>يمكنك التواصل معنا من خلال الطرق التالية:</p>
                <div class="contact-info">
                    <div class="contact-item">
                        <div class="icon">📧</div>
                        <h3>البريد الإلكتروني</h3>
                        <a href="mailto:merdevai477@gmail.com">merdevai477@gmail.com</a>
                        <p>نرد خلال 24 ساعة</p>
                    </div>
                    
                    <div class="contact-item">
                        <div class="icon">📞</div>
                        <h3>الهاتف</h3>
                        <a href="tel:+2207630953">+220 76 30 953</a>
                        <p>متاح من 9 صباحاً - 9 مساءً</p>
                    </div>
                    
                    <div class="contact-item">
                        <div class="icon">💬</div>
                        <h3>الدردشة المباشرة</h3>
                        <p>متاح من 9 صباحاً - 9 مساءً</p>
                        <a href="mailto:merdevai477@gmail.com">ابدأ المحادثة</a>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>❓ الأسئلة الشائعة</h2>
                
                <div class="faq-item">
                    <div class="faq-question">
                        كيف يمكنني إعادة تعيين كلمة المرور؟
                        <span>+</span>
                    </div>
                    <div class="faq-answer">
                        يمكنك إعادة تعيين كلمة المرور من خلال الذهاب إلى صفحة تسجيل الدخول والضغط على "نسيت كلمة المرور". ستصلك رسالة على بريدك الإلكتروني مع تعليمات إعادة التعيين.
                    </div>
                </div>
                
                <div class="faq-item">
                    <div class="faq-question">
                        كيف أحصل على نقاط أكثر في الكويز؟
                        <span>+</span>
                    </div>
                    <div class="faq-answer">
                        يمكنك الحصول على نقاط أكثر من خلال: الإجابة بسرعة، الإجابة الصحيحة، اللعب اليومي، ودعوة الأصدقاء. كلما كانت الأسئلة أصعب، كانت النقاط أكثر.
                    </div>
                </div>
                
                <div class="faq-item">
                    <div class="faq-question">
                        لماذا لا تظهر المباريات المباشرة؟
                        <span>+</span>
                    </div>
                    <div class="faq-answer">
                        تأكد من اتصالك بالإنترنت وأن التطبيق محدث لآخر إصدار. إذا استمرت المشكلة، جرب إغلاق التطبيق وإعادة فتحه أو تواصل معنا للمساعدة.
                    </div>
                </div>
                
                <div class="faq-item">
                    <div class="faq-question">
                        كيف أرفع فيديو ريل؟
                        <span>+</span>
                    </div>
                    <div class="faq-answer">
                        اذهب إلى قسم الريلز واضغط على زر "+" لرفع فيديو جديد. يمكنك اختيار فيديو من معرض الصور أو تسجيل فيديو جديد مباشرة من التطبيق.
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>🔧 المشاكل التقنية</h2>
                <p>إذا واجهت أي مشكلة تقنية، جرب الحلول التالية:</p>
                <ul style="margin: 15px 0; padding-right: 20px;">
                    <li>تأكد من أن التطبيق محدث لآخر إصدار</li>
                    <li>أعد تشغيل التطبيق</li>
                    <li>تحقق من اتصالك بالإنترنت</li>
                    <li>امسح ذاكرة التخزين المؤقت للتطبيق</li>
                    <li>أعد تشغيل جهازك</li>
                </ul>
                <p>إذا لم تحل هذه الخطوات المشكلة، تواصل معنا مع وصف مفصل للمشكلة.</p>
            </div>
            
            <div class="section">
                <h2>📋 سياسة الخصوصية</h2>
                <p>نحن نحترم خصوصيتك ونحمي بياناتك الشخصية. لمعرفة المزيد عن كيفية جمع واستخدام بياناتك:</p>
                <a href="/privacy" style="color: #4A148C; font-weight: bold;">اقرأ سياسة الخصوصية الكاملة</a>
            </div>
            
            <div class="footer">
                <p>&copy; 2024 90Plus. جميع الحقوق محفوظة.</p>
                <p>نسخة التطبيق: 1.0.0</p>
            </div>
        </div>
        
        <script>
            // إضافة تفاعل للأسئلة الشائعة
            document.querySelectorAll('.faq-question').forEach(question => {
                question.addEventListener('click', () => {
                    const answer = question.nextElementSibling;
                    const icon = question.querySelector('span');
                    
                    if (answer.style.display === 'none' || !answer.style.display) {
                        answer.style.display = 'block';
                        icon.textContent = '-';
                    } else {
                        answer.style.display = 'none';
                        icon.textContent = '+';
                    }
                });
            });
            
            // إخفاء الإجابات في البداية
            document.querySelectorAll('.faq-answer').forEach(answer => {
                answer.style.display = 'none';
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(supportPage);
});

/**
 * GET /privacy
 * صفحة سياسة الخصوصية
 */
router.get('/privacy', (_req: Request, res: Response): void => {
    const privacyPage = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>90Plus - سياسة الخصوصية</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.8;
                color: #333;
                background: linear-gradient(135deg, #4A148C 0%, #7B1FA2 100%);
                min-height: 100vh;
            }
            
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
                background: white;
                margin-top: 30px;
                margin-bottom: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4A148C;
            }
            
            .logo {
                width: 60px;
                height: 60px;
                margin: 0 auto 15px;
                background: #4A148C;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 20px;
                font-weight: bold;
            }
            
            h1 {
                color: #4A148C;
                margin-bottom: 10px;
            }
            
            h2 {
                color: #4A148C;
                margin: 30px 0 15px 0;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
            }
            
            .section {
                margin-bottom: 25px;
            }
            
            .last-updated {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
                color: #666;
            }
            
            ul {
                margin: 15px 0;
                padding-right: 25px;
            }
            
            li {
                margin-bottom: 8px;
            }
            
            .contact-box {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                border-left: 4px solid #4A148C;
                margin-top: 30px;
            }
            
            .back-link {
                display: inline-block;
                margin-bottom: 20px;
                color: #4A148C;
                text-decoration: none;
                font-weight: bold;
            }
            
            .back-link:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="/support" class="back-link">← العودة إلى الدعم</a>
            
            <div class="header">
                <div class="logo">90+</div>
                <h1>سياسة الخصوصية</h1>
            </div>
            
            <div class="last-updated">
                آخر تحديث: يناير 2024
            </div>
            
            <div class="section">
                <h2>مقدمة</h2>
                <p>
                    نحن في 90Plus نقدر خصوصيتك ونلتزم بحماية معلوماتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية بياناتك عند استخدام تطبيقنا.
                </p>
            </div>
            
            <div class="section">
                <h2>المعلومات التي نجمعها</h2>
                <ul>
                    <li><strong>معلومات الحساب:</strong> الاسم، البريد الإلكتروني، اسم المستخدم</li>
                    <li><strong>معلومات الاستخدام:</strong> نشاطك في التطبيق، النقاط، الإنجازات</li>
                    <li><strong>المحتوى:</strong> الفيديوهات والصور التي ترفعها</li>
                    <li><strong>معلومات الجهاز:</strong> نوع الجهاز، نظام التشغيل، معرف الجهاز</li>
                    <li><strong>معلومات الموقع:</strong> (اختيارية) لتخصيص المحتوى المحلي</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>كيف نستخدم معلوماتك</h2>
                <ul>
                    <li>تقديم وتحسين خدمات التطبيق</li>
                    <li>تخصيص تجربتك وعرض محتوى مناسب</li>
                    <li>إرسال إشعارات مهمة حول التطبيق</li>
                    <li>منع الاحتيال وضمان أمان التطبيق</li>
                    <li>تحليل الاستخدام لتحسين الخدمات</li>
                    <li>التواصل معك للدعم الفني</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>مشاركة المعلومات</h2>
                <p>نحن لا نبيع أو نؤجر معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك في الحالات التالية:</p>
                <ul>
                    <li>مع موافقتك الصريحة</li>
                    <li>لتقديم الخدمات المطلوبة (مثل خدمات الدفع)</li>
                    <li>للامتثال للقوانين أو الأوامر القضائية</li>
                    <li>لحماية حقوقنا أو حقوق المستخدمين الآخرين</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>أمان البيانات</h2>
                <p>نتخذ إجراءات أمنية متقدمة لحماية معلوماتك:</p>
                <ul>
                    <li>تشفير البيانات أثناء النقل والتخزين</li>
                    <li>خوادم آمنة ومحمية</li>
                    <li>مراقبة مستمرة للأنشطة المشبوهة</li>
                    <li>تحديثات أمنية منتظمة</li>
                    <li>وصول محدود للموظفين المخولين فقط</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>حقوقك</h2>
                <p>لديك الحق في:</p>
                <ul>
                    <li>الوصول إلى معلوماتك الشخصية</li>
                    <li>تصحيح أو تحديث معلوماتك</li>
                    <li>حذف حسابك ومعلوماتك</li>
                    <li>تقييد معالجة بياناتك</li>
                    <li>نقل بياناتك إلى خدمة أخرى</li>
                    <li>الاعتراض على معالجة معينة لبياناتك</li>
                </ul>
            </div>
            
            <div class="section">
                <h2>ملفات تعريف الارتباط</h2>
                <p>
                    نستخدم ملفات تعريف الارتباط وتقنيات مشابهة لتحسين تجربتك، تذكر تفضيلاتك، وتحليل استخدام التطبيق. يمكنك التحكم في هذه الإعدادات من خلال إعدادات جهازك.
                </p>
            </div>
            
            <div class="section">
                <h2>خصوصية الأطفال</h2>
                <p>
                    تطبيقنا مخصص للمستخدمين الذين تبلغ أعمارهم 13 عاماً أو أكثر. نحن لا نجمع عمداً معلومات شخصية من الأطفال دون سن 13 عاماً.
                </p>
            </div>
            
            <div class="section">
                <h2>التحديثات</h2>
                <p>
                    قد نحدث هذه السياسة من وقت لآخر. سنخطرك بأي تغييرات مهمة عبر التطبيق أو البريد الإلكتروني. استمرار استخدامك للتطبيق يعني موافقتك على السياسة المحدثة.
                </p>
            </div>
            
            <div class="contact-box">
                <h2>تواصل معنا</h2>
                <p>إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه، يمكنك التواصل معنا:</p>
                <ul>
                    <li><strong>البريد الإلكتروني:</strong> merdevai477@gmail.com</li>
                    <li><strong>الهاتف:</strong> +220 76 30 953</li>
                    <li><strong>الدعم:</strong> merdevai477@gmail.com</li>
                    <li><strong>العنوان:</strong> 90Plus App Support Team</li>
                </ul>
            </div>
        </div>
    </body>
    </html>
    `;
    
    res.send(privacyPage);
});

const PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=com.mhmdsh1892.ninetyplusapp';

/**
 * GET /reels/:reelId
 * Share landing — opens app if installed, otherwise Google Play
 */
router.get('/reels/:reelId', (req: Request, res: Response): void => {
    const reelId = ensureString(req.params.reelId);
    const playStore = encodeURIComponent(PLAY_STORE_URL);
    const deepLink = encodeURIComponent(`ninetyplus://reel/${reelId}`);
    const intentUrl = `intent://reel/${reelId}#Intent;scheme=ninetyplus;package=com.mhmdsh1892.ninetyplusapp;S.browser_fallback_url=${playStore};end`;

    const page = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>90Plus — فيديو</title>
  <meta property="og:title" content="90Plus — شاهد هذا الفيديو">
  <meta property="og:description" content="افتح الفيديو في تطبيق 90Plus">
  <meta property="og:url" content="https://90plus.app/reels/${reelId}">
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 24px; text-align: center; }
    .card { max-width: 360px; }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px; }
    a.btn { display: block; margin: 10px 0; padding: 14px 20px; border-radius: 28px; text-decoration: none; font-weight: 700; }
    .primary { background: #FFD700; color: #000; }
    .secondary { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
  </style>
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      if (isAndroid) {
        window.location.href = ${JSON.stringify(intentUrl)};
      } else if (isIOS) {
        window.location.href = ${JSON.stringify(`ninetyplus://reel/${reelId}`)};
        setTimeout(function() { window.location.href = ${JSON.stringify(PLAY_STORE_URL)}; }, 1500);
      } else {
        window.location.href = ${JSON.stringify(PLAY_STORE_URL)};
      }
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <p>جاري فتح الفيديو في التطبيق…</p>
    <a class="btn primary" href="${intentUrl.replace(/"/g, '&quot;')}">افتح في التطبيق</a>
    <a class="btn secondary" href="${PLAY_STORE_URL}">حمّل من Google Play</a>
  </div>
</body>
</html>`;

    res.type('html').send(page);
});

/**
 * GET /@:username
 * Profile share landing — opens app if installed, otherwise Google Play
 */
router.get('/@:username', (req: Request, res: Response): void => {
    const raw = ensureString(req.params.username);
    const username = raw.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(username)) {
        res.status(404).type('html').send('<!DOCTYPE html><html><body><p>Profile not found</p></body></html>');
        return;
    }

    const profileUrl = `https://90plus.app/@${username}`;
    const playStore = encodeURIComponent(PLAY_STORE_URL);
    const intentUrl = `intent://user/${username}#Intent;scheme=ninetyplus;package=com.mhmdsh1892.ninetyplusapp;S.browser_fallback_url=${playStore};end`;

    const page = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>90Plus — @${username}</title>
  <meta property="og:title" content="90Plus — @${username}">
  <meta property="og:description" content="افتح البروفايل في تطبيق 90Plus">
  <meta property="og:url" content="${profileUrl}">
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 24px; text-align: center; }
    .card { max-width: 360px; }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px; }
    a.btn { display: block; margin: 10px 0; padding: 14px 20px; border-radius: 28px; text-decoration: none; font-weight: 700; }
    .primary { background: #FFD700; color: #000; }
    .secondary { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
  </style>
  <script>
    (function() {
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      if (isAndroid) {
        window.location.href = ${JSON.stringify(intentUrl)};
      } else if (isIOS) {
        window.location.href = ${JSON.stringify(`ninetyplus://user/${username}`)};
        setTimeout(function() { window.location.href = ${JSON.stringify(PLAY_STORE_URL)}; }, 1500);
      } else {
        window.location.href = ${JSON.stringify(PLAY_STORE_URL)};
      }
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>90Plus</h1>
    <p>جاري فتح بروفايل @${username} في التطبيق…</p>
    <a class="btn primary" href="${intentUrl.replace(/"/g, '&quot;')}">افتح في التطبيق</a>
    <a class="btn secondary" href="${PLAY_STORE_URL}">حمّل من Google Play</a>
  </div>
</body>
</html>`;

    res.type('html').send(page);
});

function ensureString(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0];
    return param || '';
}

export default router;