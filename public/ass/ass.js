const loginEl = document.getElementById('login');
const deskEl = document.getElementById('desk');
const cardsEl = document.getElementById('cards');
const activityEl = document.getElementById('activity');
const postFiltersEl = document.getElementById('post-filters');
const loginError = document.getElementById('login-error');
const deskError = document.getElementById('desk-error');
const rejectModal = document.getElementById('reject-modal');
const rejectReason = document.getElementById('reject-reason');
const imageModal = document.getElementById('image-modal');
const imagePreview = document.getElementById('image-preview');
const imageCaption = document.getElementById('image-caption');
const deleteModal = document.getElementById('delete-modal');
const deleteReason = document.getElementById('delete-reason');
const deleteTitle = document.getElementById('delete-title');
const deleteHint = document.getElementById('delete-hint');
const videoModal = document.getElementById('video-modal');
const reelVideo = document.getElementById('reel-video');
const videoCaption = document.getElementById('video-caption');
const videoFallback = document.getElementById('video-fallback');
const overviewEl = document.getElementById('overview');
const pageTitleEl = document.getElementById('page-title');
const imageDeleteBtn = document.getElementById('image-delete');

const PAGE_TITLES = {
  overview: 'نظرة عامة',
  DRAFT: 'مراجعة الإعلانات',
  PUBLISHED: 'إعلانات منشورة',
  LOCKED: 'إعلانات مقفلة',
  SETTLED: 'إعلانات مكتملة',
  REJECTED: 'إعلانات مرفوضة',
  CANCELLED: 'إعلانات ملغاة',
  posts: 'منشورات المجتمع',
  comments: 'تعليقات المجتمع',
  reels: 'ريلز',
  'reel-comments': 'تعليقات الريلز',
  activity: 'نشاط المسابقات',
  'app-update': 'تحديث التطبيق',
};

const AD_STATUS = {
  DRAFT: 'بانتظار المراجعة',
  PUBLISHED: 'منشور',
  LOCKED: 'مقفل',
  SETTLED: 'مكتمل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغى',
};

const STATE = {
  tab: 'overview',
  rejectId: null,
  deleteId: null,
  deleteKind: 'post',
  previewPostId: null,
  previewReelId: null,
  postFilter: 'all',
  postOrder: 'newest',
  postsById: {},
  mediaById: {},
  hls: null,
  inflight: null,
};

async function api(path, opts = {}) {
  const res = await fetch(`/api/ass${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || 'request failed');
    err.status = res.status;
    throw err;
  }
  return json;
}

function showLogin() {
  loginEl.hidden = false;
  deskEl.hidden = true;
}

function showDesk() {
  loginEl.hidden = true;
  deskEl.hidden = false;
  load();
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function syncPostFilterChips() {
  postFiltersEl.querySelectorAll('[data-order]').forEach((b) =>
    b.classList.toggle('active', b.dataset.order === STATE.postOrder),
  );
  postFiltersEl.querySelectorAll('[data-filter]').forEach((b) =>
    b.classList.toggle('active', b.dataset.filter === STATE.postFilter),
  );
}

function kv(label, value) {
  const text = value == null || String(value).trim() === '' ? '—' : String(value);
  return `<div class="kv"><b>${esc(label)}</b><span>${esc(text)}</span></div>`;
}

function yn(value, yes, no) {
  return value ? yes : no;
}

function socialText(links) {
  if (!links || typeof links !== 'object') return '';
  const names = { facebook: 'فيسبوك', instagram: 'إنستجرام', whatsapp: 'واتساب', twitter: 'تويتر', tiktok: 'تيك توك', website: 'الموقع' };
  return Object.entries(links)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => `${names[key] || key}: ${value}`)
    .join('\n');
}

function renderCards(rows) {
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد إعلانات في هذا التبويب</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((c) => {
      const sponsor = c.sponsor || {};
      const owner = sponsor.owner || {};
      const entrants = c._count?.entries ?? c.participantsCount ?? 0;
      const views = c._count?.views ?? c.viewsCount ?? 0;
      const mode = c.predictionMode === 'WINNER' ? 'الفائز فقط' : 'النتيجة بالضبط';
      const cash = c.prizeCashAmount != null ? `${c.prizeCashAmount} جنيه` : '';
      const score =
        c.resultHomeScore == null || c.resultAwayScore == null
          ? ''
          : `${c.resultHomeScore} - ${c.resultAwayScore}`;
      const hero = c.prizeImageUrl
        ? `style="background-image:url('${esc(c.prizeImageUrl)}')"`
        : '';
      const canReview = c.status === 'DRAFT';
      const zoom = c.prizeImageUrl
        ? `<button type="button" class="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-extrabold" data-act="preview-prize" data-url="${esc(c.prizeImageUrl)}" data-caption="${esc(c.prizeName)}">تكبير الصورة</button>`
        : '';
      return `<article class="review">
        <div class="review-top">
          <div class="review-hero" ${hero}>
            ${c.sponsor?.logoUrl ? `<img src="${esc(sponsor.logoUrl)}" alt="" class="absolute right-3 top-3 h-14 w-14 rounded-2xl border border-white/20 bg-zinc-950 object-cover" />` : ''}
            ${zoom}
          </div>
          <div class="review-body">
            <div class="review-head">
              <div>
                <div class="badges">
                  <span class="tag win">${esc(AD_STATUS[c.status] || c.status)}</span>
                  <span class="tag ok">${esc(yn(c.isFree, 'مجانية', 'مدفوعة'))}</span>
                  ${sponsor.isVerified ? '<span class="tag ok">معلن موثّق</span>' : '<span class="tag warn">معلن غير موثّق</span>'}
                </div>
                <h2 class="mt-2 text-2xl font-extrabold">${esc(c.prizeName)}</h2>
                <p class="meta">${esc(sponsor.name || '—')} · ${esc(c.category?.nameAr || c.prizeType || '')}</p>
              </div>
              <div class="text-left">
                <div class="text-3xl font-extrabold">${entrants}</div>
                <div class="text-xs font-bold text-zinc-400">مشترك · ${views} مشاهدة</div>
              </div>
            </div>
            ${
              canReview
                ? `<div class="actions max-w-md">
                    <button class="approve" data-act="publish" data-id="${esc(c.id)}">موافقة</button>
                    <button class="danger" data-act="reject" data-id="${esc(c.id)}">رفض</button>
                  </div>`
                : ''
            }
            ${c.rejectionReason ? `<p class="rounded-2xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">سبب الرفض: ${esc(c.rejectionReason)}</p>` : ''}
          </div>
        </div>
        <div class="grid gap-5 p-5 lg:grid-cols-3">
          <section>
            <div class="section-label">المعلن</div>
            <div class="kv-grid lg:grid-cols-1">
              ${kv('اسم النشاط', sponsor.name)}
              ${kv('وصف النشاط', sponsor.description)}
              ${kv('العنوان', sponsor.address)}
              ${kv('التوصيل', sponsor.hasDelivery == null ? '' : yn(sponsor.hasDelivery, 'متاح', 'غير متاح'))}
              ${kv('حالة الحساب', sponsor.isActive === false ? 'موقوف' : 'نشط')}
              ${kv('متابعو الصفحة', sponsor._count?.followers ?? 0)}
              ${kv('عدد إعلاناته', sponsor._count?.competitions ?? 0)}
              ${kv('صاحب الحساب', owner.displayName || owner.username)}
              ${kv('اسم المستخدم', owner.username ? '@' + owner.username : '')}
              ${kv('البريد', owner.email)}
              ${kv('روابط التواصل', socialText(sponsor.socialLinks))}
            </div>
          </section>
          <section>
            <div class="section-label">الجائزة</div>
            <div class="kv-grid lg:grid-cols-1">
              ${kv('اسم الجائزة', c.prizeName)}
              ${kv('النوع', c.prizeType)}
              ${kv('الفئة', c.category?.nameAr)}
              ${kv('المبلغ النقدي', cash)}
              ${kv('عدد الفائزين', c.winnersCount)}
              ${kv('الدخول', yn(c.isFree, 'مجاني', 'مدفوع'))}
              ${kv('وصف الجائزة', c.prizeDescription)}
            </div>
          </section>
          <section>
            <div class="section-label">المباراة والموعد</div>
            <div class="kv-grid lg:grid-cols-1">
              ${kv('المباراة', `${c.homeTeam || '—'} ضد ${c.awayTeam || '—'}`)}
              ${kv('الدوري', c.leagueName)}
              ${kv('موعد المباراة', fmtDate(c.matchDate))}
              ${kv('حالة المباراة', c.matchStatus)}
              ${kv('النتيجة', score)}
              ${kv('نوع التوقع', mode)}
              ${kv('آخر موعد للتوقع', fmtDate(c.predictionDeadline))}
              ${kv('بداية المسابقة', fmtDate(c.startAt))}
              ${kv('نهاية المسابقة', fmtDate(c.endAt))}
              ${kv('رقم المباراة', c.apiMatchId)}
              ${kv('تاريخ الإرسال', fmtDate(c.createdAt))}
              ${kv('تاريخ النشر', fmtDate(c.publishedAt))}
              ${kv('تاريخ المراجعة', fmtDate(c.reviewedAt))}
            </div>
          </section>
        </div>
        <div class="px-5 pb-5">
          <div class="section-label">شروط المسابقة</div>
          <div class="rules">${esc(c.rules || 'المعلن لم يكتب شروطاً.')}</div>
        </div>
      </article>`;
    })
    .join('');
}

function renderOverview(data) {
  const users = data?.users || {};
  const games = data?.games || [];
  const comps = data?.competitions || [];
  const totals = data?.competitionTotals || [];
  const userCards = [
    ['إجمالي المستخدمين', users.total],
    ['جدد خلال 7 أيام', users.newWeek],
    ['دخلوا خلال 7 أيام', users.activeWeek],
    ['محظورون', users.banned],
    ['موقوفون', users.suspended],
  ]
    .map(
      ([label, value]) =>
        `<article class="stat"><b>${Number(value || 0).toLocaleString('ar-EG')}</b><span>${esc(label)}</span></article>`,
    )
    .join('');
  const gameCards = games
    .map(
      (game) => `<article class="game">
        <h3>${esc(game.name)}</h3>
        <div class="nums">
          <div>
            <div class="text-3xl font-extrabold">${Number(game.players || 0).toLocaleString('ar-EG')}</div>
            <div class="text-xs font-bold text-zinc-400">مستخدم</div>
          </div>
          <div class="text-left">
            <div class="text-xl font-extrabold">${Number(game.actions || 0).toLocaleString('ar-EG')}</div>
            <div class="text-xs font-bold text-zinc-400">${esc(game.actionLabel)}</div>
          </div>
        </div>
      </article>`,
    )
    .join('');
  const totalChips = totals
    .map(
      (row) =>
        `<button type="button" class="chip" data-goto="${esc(row.status)}">${esc(AD_STATUS[row.status] || row.status)} · ${row.competitions} مسابقة · ${row.participants} مشترك</button>`,
    )
    .join('');
  const rows = comps
    .map(
      (c) => `<tr>
        <td class="font-extrabold">${esc(c.prizeName)}</td>
        <td>${esc(c.sponsorName)}</td>
        <td>${esc(c.homeTeam)} ضد ${esc(c.awayTeam)}<div class="text-xs text-zinc-500">${esc(c.leagueName || '')}</div></td>
        <td>${fmtDate(c.matchDate)}</td>
        <td><span class="tag win">${esc(AD_STATUS[c.status] || c.status)}</span></td>
        <td class="font-extrabold">${Number(c.participants || 0).toLocaleString('ar-EG')}</td>
        <td>${Number(c.views || 0).toLocaleString('ar-EG')}</td>
        <td>${c.winnersCount || 1}</td>
      </tr>`,
    )
    .join('');
  overviewEl.innerHTML = `
    <section>
      <h2 class="mb-3 text-sm font-extrabold text-zinc-400">المستخدمون</h2>
      <div class="stat-grid">${userCards}</div>
    </section>
    <section>
      <h2 class="mb-3 text-sm font-extrabold text-zinc-400">المستخدمون في كل لعبة</h2>
      <div class="game-grid">${gameCards}</div>
    </section>
    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-extrabold text-zinc-400">كل المسابقات والمشتركون</h2>
        <div class="flex flex-wrap gap-2">${totalChips}</div>
      </div>
      <div class="table-wrap">
        <table class="comp-table">
          <thead>
            <tr>
              <th>الجائزة</th><th>المعلن</th><th>المباراة</th><th>الموعد</th><th>الحالة</th><th>المشتركون</th><th>المشاهدات</th><th>الفائزون</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" class="empty">لا توجد مسابقات</td></tr>'}</tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-zinc-500">آخر تحديث ${fmtDate(data?.generatedAt)} · الأرقام عدد المستخدمين المختلفين، والمسابقات مرتبة بالأكثر مشاركة.</p>
    </section>`;
}

function postBadges(p) {
  const bits = [];
  if (p.status === 'HIDDEN') bits.push('<span class="tag warn">مخفي</span>');
  if (p.aiFlagged) bits.push('<span class="tag ai">مشكوك AI</span>');
  if (p.reportsCount > 0) bits.push(`<span class="tag no">بلاغات ${p.reportsCount}</span>`);
  if (p.pendingReports > 0) bits.push(`<span class="tag no">قيد المراجعة ${p.pendingReports}</span>`);
  if (p.user?.communitySafetyFlag) bits.push(`<span class="tag warn">${esc(p.user.communitySafetyFlag)}</span>`);
  return bits.join(' ');
}

function renderPosts(rows) {
  STATE.postsById = {};
  for (const p of rows) STATE.postsById[p.id] = p;
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد منشورات في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((p) => {
      const name = p.user?.displayName || p.user?.username || 'مستخدم';
      const handle = p.user?.username ? `@${p.user.username}` : '';
      const text = (p.content || '').trim();
      const preview = text.length > 180 ? `${text.slice(0, 180)}…` : text;
      const thumb = p.imageUrl
        ? `<button type="button" class="thumb post-thumb" data-act="preview" data-id="${esc(p.id)}" style="background-image:url('${esc(p.imageUrl)}')" aria-label="عرض الصورة"></button>`
        : `<div class="thumb post-thumb empty-thumb">بدون صورة</div>`;
      return `<article class="card post-card">
        ${thumb}
        <div class="card-body">
          <div class="prize">${esc(name)} <span class="handle">${esc(handle)}</span></div>
          <div class="badges"><span class="tag ok">منشور</span> ${postBadges(p)}</div>
          <div class="post-text">${esc(preview) || '<span class="muted">—</span>'}</div>
          <div class="meta">
            ❤️ ${p.likesCount || 0} · 💬 ${p.commentsCount || 0}<br/>
            ${fmtDate(p.createdAt)}
          </div>
          <div class="actions">
            ${
              p.imageUrl
                ? `<button class="ghost" data-act="preview" data-id="${esc(p.id)}">عرض الصورة</button>`
                : ''
            }
            <button class="danger" data-act="delete-post" data-id="${esc(p.id)}">حذف</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
}

function rememberMedia(id, media) {
  if (!id || !media) return;
  STATE.mediaById[id] = media;
}

function renderReels(rows) {
  STATE.mediaById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد ريلز في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((reel) => {
      const name = reel.user?.displayName || reel.user?.username || 'مستخدم';
      const handle = reel.user?.username ? `@${reel.user.username}` : '';
      const text = (reel.caption || '').trim();
      const preview = text.length > 180 ? `${text.slice(0, 180)}…` : text;
      rememberMedia(reel.id, {
        playbackUrl: reel.playbackUrl,
        thumbnailUrl: reel.thumbnailUrl,
        caption: `${name} · ${fmtDate(reel.createdAt)}`,
      });
      const thumb = reel.thumbnailUrl
        ? `<button type="button" class="thumb post-thumb reel-thumb" data-act="play" data-id="${esc(reel.id)}" style="background-image:url('${esc(reel.thumbnailUrl)}')" aria-label="تشغيل الريل"><span class="play-mark">تشغيل</span></button>`
        : `<button type="button" class="thumb post-thumb reel-thumb empty-thumb" data-act="play" data-id="${esc(reel.id)}">بدون صورة</button>`;
      const processing = reel.status === 'PROCESSING' ? '<span class="tag warn">جاري المعالجة</span>' : '';
      return `<article class="card post-card">
        ${thumb}
        <div class="card-body">
          <div class="prize">${esc(name)} <span class="handle">${esc(handle)}</span></div>
          <div class="badges"><span class="tag ok">ريل</span> ${processing} ${postBadges(reel)}</div>
          <div class="post-text">${esc(preview) || '<span class="muted">بدون وصف</span>'}</div>
          <div class="meta">
            ▶ ${reel.views || 0} · ❤️ ${reel.likesCount || 0} · 💬 ${reel.commentsCount || 0}<br/>
            ${fmtDate(reel.createdAt)}
          </div>
          <div class="actions">
            <button class="ghost" data-act="play" data-id="${esc(reel.id)}">عرض الفيديو</button>
            <button class="danger" data-act="delete-reel" data-id="${esc(reel.id)}">حذف</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
}

function renderReelComments(rows) {
  STATE.mediaById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد تعليقات ريلز في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((c) => {
      const name = c.user?.displayName || c.user?.username || 'مستخدم';
      const handle = c.user?.username ? `@${c.user.username}` : '';
      const text = (c.content || '').trim();
      const preview = text.length > 220 ? `${text.slice(0, 220)}…` : text;
      const caption = (c.reel?.caption || '').trim();
      const reelPreview = caption
        ? caption.length > 100
          ? `${caption.slice(0, 100)}…`
          : caption
        : 'ريل';
      if (c.reel?.id) {
        rememberMedia(c.reel.id, {
          playbackUrl: c.reel.playbackUrl,
          thumbnailUrl: c.reel.thumbnailUrl,
          caption: reelPreview,
        });
      }
      const parent = c.isReply
        ? `<div class="parent-post">رد على: ${esc(c.parentContent || 'تعليق')}</div>`
        : '';
      const watch = c.reel?.playbackUrl
        ? `<button class="ghost" data-act="play" data-id="${esc(c.reel.id)}">عرض الريل</button>`
        : '';
      return `<article class="card post-card comment-card">
        <div class="card-body">
          <div class="prize">${esc(name)} <span class="handle">${esc(handle)}</span></div>
          <div class="badges"><span class="tag win">تعليق ريل</span> ${postBadges(c)}</div>
          <div class="post-text">${esc(preview) || '<span class="muted">—</span>'}</div>
          ${parent}
          <div class="parent-post">على ريل: ${esc(reelPreview)}</div>
          <div class="meta">
            ❤️ ${c.likesCount || 0}<br/>
            ${fmtDate(c.createdAt)}
          </div>
          <div class="actions">
            ${watch}
            <button class="danger" data-act="delete-reel-comment" data-id="${esc(c.id)}">حذف التعليق</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
}

function renderComments(rows) {
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد تعليقات مبلّغ عنها أو مشكوك فيها</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((c) => {
      const name = c.user?.displayName || c.user?.username || 'مستخدم';
      const handle = c.user?.username ? `@${c.user.username}` : '';
      const text = (c.content || '').trim();
      const preview = text.length > 220 ? `${text.slice(0, 220)}…` : text;
      const parent = (c.post?.content || '').trim();
      const parentPreview = parent
        ? parent.length > 100
          ? `${parent.slice(0, 100)}…`
          : parent
        : c.post?.imageUrl
          ? 'منشور بصورة'
          : 'منشور';
      return `<article class="card post-card comment-card">
        <div class="card-body">
          <div class="prize">${esc(name)} <span class="handle">${esc(handle)}</span></div>
          <div class="badges"><span class="tag win">تعليق</span> ${postBadges(c)}</div>
          <div class="post-text">${esc(preview) || '<span class="muted">—</span>'}</div>
          <div class="parent-post">على منشور: ${esc(parentPreview)}</div>
          <div class="meta">
            ❤️ ${c.likesCount || 0}<br/>
            ${fmtDate(c.createdAt)}
          </div>
          <div class="actions">
            <button class="danger" data-act="delete-comment" data-id="${esc(c.id)}">حذف التعليق</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
}

function activityCopy(row) {
  const prize = row.payload?.prizeName || row.competition?.prizeName || 'جائزة';
  const store = row.payload?.storeName || row.competition?.sponsor?.name || '';
  if (row.type === 'APPROVED') return { tag: 'ok', label: 'موافقة', text: `تم قبول «${prize}» من ${store}` };
  if (row.type === 'REJECTED') {
    const reason = row.payload?.reason ? ` — ${row.payload.reason}` : '';
    return { tag: 'no', label: 'رفض', text: `تم رفض «${prize}» من ${store}${reason}` };
  }
  const winner = row.payload?.displayName || row.payload?.username || 'مستخدم';
  return { tag: 'win', label: 'تربيح', text: `تم تربيح ${winner} في «${prize}» من ${store}` };
}

function renderActivity(rows) {
  if (!rows.length) {
    activityEl.innerHTML = '<div class="empty">لا يوجد نشاط بعد</div>';
    return;
  }
  activityEl.innerHTML = rows
    .map((row) => {
      const copy = activityCopy(row);
      return `<div class="event">
        <div>
          <span class="tag ${copy.tag}">${copy.label}</span>
          ${esc(copy.text)}
        </div>
        <div class="when">${fmtDate(row.createdAt)}</div>
      </div>`;
    })
    .join('');
}

function openImagePreview(postId) {
  const p = STATE.postsById[postId];
  if (!p?.imageUrl) return;
  STATE.previewPostId = postId;
  imagePreview.src = p.imageUrl;
  const name = p.user?.displayName || p.user?.username || '';
  imageCaption.textContent = `${name} · ${fmtDate(p.createdAt)}`;
  imageDeleteBtn.hidden = false;
  imageModal.hidden = false;
}

function stopVideo() {
  if (STATE.hls) {
    STATE.hls.destroy();
    STATE.hls = null;
  }
  reelVideo.pause();
  reelVideo.removeAttribute('src');
  reelVideo.load();
}

function openVideoPreview(reelId) {
  const media = STATE.mediaById[reelId];
  if (!media) return;
  stopVideo();
  STATE.previewReelId = reelId;
  videoCaption.textContent = media.caption || '';
  videoFallback.hidden = !!media.playbackUrl;
  reelVideo.poster = media.thumbnailUrl || '';
  if (media.playbackUrl) {
    const url = media.playbackUrl;
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (isHls && reelVideo.canPlayType('application/vnd.apple.mpegurl')) {
      reelVideo.src = url;
    } else if (isHls && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({ enableWorker: false });
      hls.loadSource(url);
      hls.attachMedia(reelVideo);
      STATE.hls = hls;
    } else {
      reelVideo.src = url;
    }
  }
  videoModal.hidden = false;
}

const DELETE_COPY = {
  post: ['حذف المنشور', 'الحذف فوري، وهيترسل تحذير لصاحب المنشور. سبب الحذف اختياري.'],
  comment: ['حذف التعليق', 'الحذف فوري، وهيترسل تحذير لصاحب التعليق. سبب الحذف اختياري.'],
  reel: ['حذف الريل', 'الحذف فوري، الفيديو هيختفي من التطبيق، وهيترسل تحذير لصاحب الريل. سبب الحذف اختياري.'],
  'reel-comment': ['حذف تعليق الريل', 'الحذف فوري، وهيترسل تحذير لصاحب التعليق. سبب الحذف اختياري.'],
};

function openDeleteModal(id, kind = 'post') {
  STATE.deleteId = id;
  STATE.deleteKind = kind;
  deleteReason.value = '';
  imageModal.hidden = true;
  videoModal.hidden = true;
  stopVideo();
  const copy = DELETE_COPY[kind] || DELETE_COPY.post;
  deleteTitle.textContent = copy[0];
  deleteHint.textContent = copy[1];
  deleteModal.hidden = false;
}

async function load() {
  if (STATE.inflight) return STATE.inflight;
  deskError.hidden = true;
  STATE.inflight = (async () => {
    try {
      const isPosts = STATE.tab === 'posts';
      const isComments = STATE.tab === 'comments';
      const isReels = STATE.tab === 'reels';
      const isReelComments = STATE.tab === 'reel-comments';
      const isActivity = STATE.tab === 'activity';
      const isOverview = STATE.tab === 'overview';
      const isAds = ['DRAFT', 'PUBLISHED', 'LOCKED', 'SETTLED', 'REJECTED', 'CANCELLED'].includes(STATE.tab);
      const showCommunityFilters = isPosts || isComments || isReels || isReelComments;
      postFiltersEl.hidden = !showCommunityFilters;
      if (showCommunityFilters) syncPostFilterChips();
      cardsEl.classList.toggle('stack', isAds);

      if (STATE.tab === 'app-update') {
        cardsEl.hidden = true;
        activityEl.hidden = true;
        overviewEl.hidden = false;
        const json = await api('/app-update');
        const notice = json.data;
        const status = notice
          ? `آخر إرسال: ${notice.sentAt || ''} — ${notice.devices || 0} جهاز`
          : 'مفيش تنبيه ظاهر دلوقتي';
        overviewEl.innerHTML = `
          <form id="app-update-form" style="max-width:560px;display:grid;gap:12px">
            <h2 style="margin:0">إرسال تحديث لكل المستخدمين</h2>
            <p class="text-sm text-zinc-400">هيظهر بوب أب في أي صفحة: «لاحقاً» أو «تحديث»، ويفتح المتجر المناسب، ومعاه إشعار.</p>
            <textarea id="app-update-message" rows="4" maxlength="280" class="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm">${notice?.message || 'تحديث متاح'}</textarea>
            <p class="text-sm text-zinc-400">${status}</p>
            <div class="flex gap-2">
              <button type="submit" id="app-update-send" class="rounded-2xl bg-violet-600 px-4 py-2 font-extrabold text-white">إرسال للجميع</button>
              <button type="button" id="app-update-clear" class="rounded-2xl border border-white/10 px-4 py-2 font-bold">إيقاف البوب أب</button>
            </div>
          </form>`;
        document.getElementById('app-update-form').addEventListener('submit', async (event) => {
          event.preventDefault();
          const message = document.getElementById('app-update-message').value.trim();
          await api('/app-update', { method: 'POST', body: JSON.stringify({ message }) });
          await load();
        });
        document.getElementById('app-update-clear').addEventListener('click', async () => {
          await api('/app-update/clear', { method: 'POST', body: '{}' });
          await load();
        });
        return;
      }

      if (isOverview) {
        cardsEl.hidden = true;
        activityEl.hidden = true;
        overviewEl.hidden = false;
        const json = await api('/overview');
        renderOverview(json.data || {});
        return;
      }

      overviewEl.hidden = true;

      if (isActivity) {
        cardsEl.hidden = true;
        activityEl.hidden = false;
        const json = await api('/activity');
        renderActivity(json.data || []);
        return;
      }

      cardsEl.hidden = false;
      activityEl.hidden = true;

      if (isPosts || isComments || isReels || isReelComments) {
        const qs = new URLSearchParams({
          filter: STATE.postFilter,
          order: STATE.postOrder,
          limit: '100',
        });
        if (isReelComments) {
          const json = await api(`/reels/comments?${qs}`);
          renderReelComments(json.data || []);
        } else if (isReels) {
          const json = await api(`/reels?${qs}`);
          renderReels(json.data || []);
        } else if (isComments) {
          const json = await api(`/community/comments?${qs}`);
          renderComments(json.data || []);
        } else {
          const json = await api(`/community/posts?${qs}`);
          renderPosts(json.data || []);
        }
        return;
      }

      const json = await api(`/competitions?status=${encodeURIComponent(STATE.tab)}`);
      renderCards(json.data || []);
    } catch (err) {
      if (err.status === 401) {
        showLogin();
        return;
      }
      deskError.hidden = false;
      deskError.textContent = err.message || 'تعذر التحميل';
    }
  })().finally(() => {
    STATE.inflight = null;
  });
  return STATE.inflight;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  try {
    await api('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });
    showDesk();
  } catch (err) {
    loginError.hidden = false;
    loginError.textContent =
      err.status === 503
        ? 'اللوحة غير مُعدّة على السيرفر'
        : err.status === 429
          ? 'محاولات كثيرة — انتظر قليلاً'
          : 'بيانات الدخول غير صحيحة';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('logout').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } finally {
    showLogin();
  }
});

function setTab(tab) {
  STATE.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab),
  );
  if (pageTitleEl) pageTitleEl.textContent = PAGE_TITLES[tab] || 'لوحة المراجعة';
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  setTab(btn.dataset.tab);
  load();
});

overviewEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-goto]');
  if (!btn) return;
  setTab(btn.dataset.goto);
  load();
});

postFiltersEl.addEventListener('click', (e) => {
  const orderBtn = e.target.closest('[data-order]');
  const filterBtn = e.target.closest('[data-filter]');
  if (orderBtn) {
    STATE.postOrder = orderBtn.dataset.order;
    syncPostFilterChips();
    load();
  }
  if (filterBtn) {
    STATE.postFilter = filterBtn.dataset.filter;
    syncPostFilterChips();
    load();
  }
});

cardsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === 'preview') {
    openImagePreview(id);
    return;
  }
  if (act === 'preview-prize') {
    const url = btn.dataset.url;
    if (!url) return;
    STATE.previewPostId = null;
    imagePreview.src = url;
    imageCaption.textContent = btn.dataset.caption || '';
    imageDeleteBtn.hidden = true;
    imageModal.hidden = false;
    return;
  }
  if (act === 'play') {
    openVideoPreview(id);
    return;
  }
  if (act === 'delete-post') {
    openDeleteModal(id, 'post');
    return;
  }
  if (act === 'delete-comment') {
    openDeleteModal(id, 'comment');
    return;
  }
  if (act === 'delete-reel') {
    openDeleteModal(id, 'reel');
    return;
  }
  if (act === 'delete-reel-comment') {
    openDeleteModal(id, 'reel-comment');
    return;
  }
  if (act === 'reject') {
    STATE.rejectId = id;
    rejectReason.value = '';
    rejectModal.hidden = false;
    return;
  }
  if (act !== 'publish') return;

  btn.disabled = true;
  try {
    await api(`/competitions/${id}/publish`, { method: 'POST', body: '{}' });
    setTab('PUBLISHED');
    await load();
  } catch (err) {
    deskError.hidden = false;
    deskError.textContent = err.message || 'فشل النشر';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('reject-cancel').addEventListener('click', () => {
  rejectModal.hidden = true;
  STATE.rejectId = null;
});

document.getElementById('reject-confirm').addEventListener('click', async () => {
  if (!STATE.rejectId) return;
  const btn = document.getElementById('reject-confirm');
  btn.disabled = true;
  try {
    await api(`/competitions/${STATE.rejectId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: rejectReason.value }),
    });
    rejectModal.hidden = true;
    STATE.rejectId = null;
    setTab('REJECTED');
    await load();
  } catch (err) {
    deskError.hidden = false;
    deskError.textContent = err.message || 'فشل الرفض';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('image-close').addEventListener('click', () => {
  imageModal.hidden = true;
  STATE.previewPostId = null;
  imagePreview.removeAttribute('src');
});

document.getElementById('image-delete').addEventListener('click', () => {
  if (!STATE.previewPostId) return;
  openDeleteModal(STATE.previewPostId, 'post');
});

document.getElementById('video-close').addEventListener('click', () => {
  videoModal.hidden = true;
  STATE.previewReelId = null;
  stopVideo();
});

document.getElementById('video-delete').addEventListener('click', () => {
  if (!STATE.previewReelId) return;
  openDeleteModal(STATE.previewReelId, 'reel');
});

document.getElementById('delete-cancel').addEventListener('click', () => {
  deleteModal.hidden = true;
  STATE.deleteId = null;
  STATE.deleteKind = 'post';
});

document.getElementById('delete-confirm').addEventListener('click', async () => {
  if (!STATE.deleteId) return;
  const btn = document.getElementById('delete-confirm');
  const kind = DELETE_COPY[STATE.deleteKind] ? STATE.deleteKind : 'post';
  const deletePaths = {
    post: `/community/posts/${STATE.deleteId}/delete`,
    comment: `/community/comments/${STATE.deleteId}/delete`,
    reel: `/reels/${STATE.deleteId}/delete`,
    'reel-comment': `/reels/comments/${STATE.deleteId}/delete`,
  };
  const failText = {
    post: 'فشل حذف المنشور',
    comment: 'فشل حذف التعليق',
    reel: 'فشل حذف الريل',
    'reel-comment': 'فشل حذف تعليق الريل',
  };
  btn.disabled = true;
  try {
    await api(deletePaths[kind], {
      method: 'POST',
      body: JSON.stringify({ reason: deleteReason.value }),
    });
    deleteModal.hidden = true;
    imageModal.hidden = true;
    videoModal.hidden = true;
    stopVideo();
    STATE.deleteId = null;
    STATE.deleteKind = 'post';
    STATE.previewPostId = null;
    STATE.previewReelId = null;
    await load();
  } catch (err) {
    deskError.hidden = false;
    deskError.textContent = err.message || failText[kind];
  } finally {
    btn.disabled = false;
  }
});

api('/me')
  .then(showDesk)
  .catch(showLogin);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !deskEl.hidden) load();
});
