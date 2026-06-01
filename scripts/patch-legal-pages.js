const fs = require('fs');
const path = require('path');

const termsPath = path.join(__dirname, '../public/terms-of-service.html');
let terms = fs.readFileSync(termsPath, 'utf8');
terms = terms.replace(/<style>[\s\S]*?<\/style>\s*/i, '');
const headerOld = `<header>
        <div class="brand">90Plus</div>
        <nav>
          <a class="active" href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </header>

      <main>`;
const headerNew = `<header>
        <div class="brand">90Plus</div>
        <div class="header-end">
          <nav class="locale-ar">
            <a class="active" href="/terms">الشروط</a>
            <a href="/privacy">الخصوصية</a>
            <a href="/support">الدعم</a>
          </nav>
          <nav class="locale-en" hidden>
            <a class="active" href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/support">Support</a>
          </nav>
          <div class="lang-switch" role="group" aria-label="Language">
            <button type="button" data-lang-btn="ar" class="active">عربي</button>
            <button type="button" data-lang-btn="en">EN</button>
          </div>
        </div>
      </header>

      <div class="locale-en">
      <main>`;
terms = terms.replace(headerOld, headerNew);
terms = terms.replace(
  '</main>\n\n      <footer>',
  `</main>
      </div>

      <div class="locale-ar" hidden>
      <main>
        <section class="hero reveal">
          <div class="eyebrow">قانوني</div>
          <h1>الشروط والأحكام</h1>
          <p class="lead">تحكم هذه الشروط وصولك واستخدامك لتطبيق 90Plus والمواقع والخدمات المرتبطة.</p>
          <div class="meta"><span>آخر تحديث: يناير 2024</span></div>
        </section>
        <section id="overview-ar" class="card reveal delay-1">
          <div class="pill">ملخص</div>
          <p>باستخدامك للخدمة فإنك توافق على هذه الشروط. يوفر 90Plus رؤى كروية، اختبارات، ودردشة ذكية.</p>
          <div class="callout"><strong>باختصار:</strong> استخدم التطبيق بمسؤولية وتحقق من مخرجات الذكاء الاصطناعي.</div>
        </section>
        <section class="card reveal delay-2"><h2>الحساب والأمان</h2><ul>
          <li>قدّم معلومات دقيقة ومحدّثة.</li>
          <li>حافظ على سرية بيانات الدخول.</li>
          <li>لا تشارك حسابك مع الآخرين.</li>
        </ul></section>
        <section class="card reveal delay-2"><h2>الاستخدام المقبول</h2><p>توافق على عدم إساءة استخدام الخدمة أو مضايقة الآخرين أو رفع محتوى مخالف.</p></section>
        <section class="card reveal delay-3"><h2>محتوى المستخدم</h2><p>تحتفظ بملكية محتواك وتمنحنا ترخيصاً محدوداً لتشغيل الخدمة.</p></section>
        <section class="card reveal delay-3"><h2>الملكية الفكرية</h2><p>التصميم والعلامة والبرمجيات مملوكة لـ 90Plus أو مرخصيها.</p></section>
        <section class="card reveal delay-3"><h2>مخرجات الذكاء الاصطناعي</h2><p>قد تكون غير دقيقة ولأغراض معلوماتية فقط — ليست نصيحة مهنية.</p></section>
        <section class="card reveal delay-4"><h2>إنهاء الخدمة</h2><p>يجوز لنا تعليق الحساب عند مخالفة الشروط. يمكنك التوقف عن الاستخدام في أي وقت.</p></section>
        <section class="card reveal delay-4"><h2>تواصل</h2><p><a href="mailto:merdevai477@gmail.com">merdevai477@gmail.com</a></p></section>
      </main>
      </div>

      <footer class="locale-ar">90Plus — الشروط والأحكام</footer>
      <footer class="locale-en" hidden>`,
);
terms = terms.replace(
  '90Plus Legal - Please replace bracketed placeholders before publishing.',
  '90Plus Legal',
);
if (!terms.includes('legal-lang.js')) {
  terms = terms.replace('</body>', '    <script src="/legal/legal-lang.js"></script>\n  </body>');
}
fs.writeFileSync(termsPath, terms);

// Privacy: rebuild from template
const privacyPath = path.join(__dirname, '../public/privacy.html');
let privacy = fs.readFileSync(privacyPath, 'utf8');
privacy = privacy.replace(/<style>[\s\S]*?<\/style>\s*/i, '');
if (!privacy.includes('legal-theme.css')) {
  privacy = privacy.replace(
    'rel="stylesheet"\n    />',
    'rel="stylesheet"\n    />\n    <link rel="stylesheet" href="/legal/legal-theme.css" />',
  );
}
if (!privacy.includes('title-ar')) {
  privacy = privacy.replace(
    '<title>',
    '<meta name="title-ar" content="سياسة الخصوصية | 90Plus" />\n    <meta name="title-en" content="Privacy Policy | 90Plus" />\n    <title>',
  );
}
const privHeaderOld = `<header>
        <div class="brand">90Plus</div>
        <nav>
          <a href="/terms">الشروط</a>
          <a class="active" href="/privacy">الخصوصية</a>
          <a href="/support">الدعم</a>
        </nav>
      </header>

      <main>`;
const privHeaderNew = `<header>
        <div class="brand">90Plus</div>
        <div class="header-end">
          <nav class="locale-ar">
            <a href="/terms">الشروط</a>
            <a class="active" href="/privacy">الخصوصية</a>
            <a href="/support">الدعم</a>
          </nav>
          <nav class="locale-en" hidden>
            <a href="/terms">Terms</a>
            <a class="active" href="/privacy">Privacy</a>
            <a href="/support">Support</a>
          </nav>
          <div class="lang-switch" role="group" aria-label="Language">
            <button type="button" data-lang-btn="ar" class="active">عربي</button>
            <button type="button" data-lang-btn="en">EN</button>
          </div>
        </div>
      </header>

      <div class="locale-ar">
      <main>`;
privacy = privacy.replace(privHeaderOld, privHeaderNew);

const enBlock = `
      </main>
      <footer class="locale-ar">90Plus — سياسة الخصوصية</footer>
      </div>

      <div class="locale-en" hidden>
      <main>
        <section class="hero reveal">
          <div class="eyebrow">Legal</div>
          <h1>Privacy Policy</h1>
          <p class="lead">At 90Plus we value your privacy. This policy explains how we collect, use, and protect your data.</p>
          <div class="meta"><span>Last updated: January 2024</span></div>
        </section>
        <section id="intro-en" class="card reveal delay-1">
          <div class="pill">Summary</div>
          <h2>Introduction</h2>
          <p>We protect your personal information when you use our app.</p>
          <div class="callout"><strong>In short:</strong> We do not sell your data; you can delete your account from settings.</div>
        </section>
        <section class="card reveal delay-2"><h2>Information we collect</h2><ul>
          <li><strong>Account:</strong> name, email, username</li>
          <li><strong>Usage:</strong> activity, points, achievements</li>
          <li><strong>Content:</strong> videos and images you upload</li>
          <li><strong>Device:</strong> device type, OS, device ID</li>
          <li><strong>Location:</strong> optional, for local content</li>
        </ul></section>
        <section class="card reveal delay-2"><h2>How we use data</h2><ul>
          <li>Provide and improve the app</li>
          <li>Personalize your experience</li>
          <li>Send important notifications</li>
          <li>Prevent fraud and ensure security</li>
          <li>Analytics and support</li>
        </ul></section>
        <section class="card reveal delay-3"><h2>Sharing</h2><p>We do not sell your data. We may share with consent, service providers, legal compliance, or to protect rights.</p></section>
        <section class="card reveal delay-3"><h2>Security</h2><ul>
          <li>Encryption in transit and at rest</li>
          <li>Secured servers and monitoring</li>
          <li>Limited staff access</li>
        </ul></section>
        <section class="card reveal delay-3"><h2>Your rights</h2><p>Access, correct, delete, restrict, port, or object to processing where applicable.</p></section>
        <section class="card reveal delay-3"><h2>Cookies</h2><p>We use cookies and similar tech to improve experience; control via device settings.</p></section>
        <section class="card reveal delay-3"><h2>Children</h2><p>For users 13+. We do not knowingly collect data from children under 13.</p></section>
        <section class="card reveal delay-4"><h2>Updates</h2><p>We may update this policy and notify you via the app or email.</p></section>
        <section class="card reveal delay-4"><h2>Contact</h2><ul>
          <li><strong>Email:</strong> <a href="mailto:merdevai477@gmail.com">merdevai477@gmail.com</a></li>
          <li><strong>Phone:</strong> +220 76 30 953</li>
        </ul></section>
      </main>
      <footer class="locale-en">90Plus — Privacy Policy</footer>
      </div>`;

privacy = privacy.replace(
  '</main>\n\n      <footer>90Plus — سياسة الخصوصية</footer>',
  enBlock,
);
if (!privacy.includes('legal-lang.js')) {
  privacy = privacy.replace('</body>', '    <script src="/legal/legal-lang.js"></script>\n  </body>');
}
fs.writeFileSync(privacyPath, privacy);
console.log('Done patching terms + privacy');
