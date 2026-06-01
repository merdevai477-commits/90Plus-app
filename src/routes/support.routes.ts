/**
 * Support Routes
 * صفحات الدعم والمساعدة
 */

import path from 'path';
import { Router, Request, Response } from 'express';

const PRIVACY_PAGE_PATH = path.join(__dirname, '../../public/privacy.html');
import {
    buildAppInviteLandingPage,
    buildProfileLandingPage,
    buildReelLandingPage,
} from '../utils/share-landing-pages';

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
 * صفحة سياسة الخصوصية — ثيم قانوني موحّد (public/privacy.html)
 */
router.get('/privacy', (_req: Request, res: Response): void => {
    res.sendFile(PRIVACY_PAGE_PATH, (err) => {
        if (err) {
            res.status(500).send('تعذّر تحميل صفحة سياسة الخصوصية');
        }
    });
});

/**
 * GET /
 * App invite — Android → Google Play, iOS → App Store
 */
router.get('/', (_req: Request, res: Response): void => {
    res.type('html').send(buildAppInviteLandingPage());
});

/**
 * GET /reels/:reelId
 * Reel share — app installed → open reel; otherwise → store
 */
router.get('/reels/:reelId', (req: Request, res: Response): void => {
    const reelId = ensureString(req.params.reelId);
    res.type('html').send(buildReelLandingPage(reelId));
});

/**
 * GET /@:username
 * Profile share — app installed → open profile; otherwise → store
 */
router.get('/@:username', (req: Request, res: Response): void => {
    const raw = ensureString(req.params.username);
    const username = raw.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(username)) {
        res.status(404).type('html').send('<!DOCTYPE html><html><body><p>Profile not found</p></body></html>');
        return;
    }

    res.type('html').send(buildProfileLandingPage(username));
});

function ensureString(param: string | string[] | undefined): string {
    if (Array.isArray(param)) return param[0];
    return param || '';
}

export default router;