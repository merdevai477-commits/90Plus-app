import './desk.css';

const loginEl = document.getElementById('login');
const deskEl = document.getElementById('desk');
const cardsEl = document.getElementById('cards');
const activityEl = document.getElementById('activity');
const overviewEl = document.getElementById('overview');
const postFiltersEl = document.getElementById('post-filters');
const loginError = document.getElementById('login-error');
const deskError = document.getElementById('desk-error');
const pageTitleEl = document.getElementById('page-title');
const drawerEl = document.getElementById('drawer');
const drawerPanel = document.getElementById('drawer-panel');
const rejectModal = document.getElementById('reject-modal');
const rejectReason = document.getElementById('reject-reason');
const imageModal = document.getElementById('image-modal');
const imagePreview = document.getElementById('image-preview');
const imageCaption = document.getElementById('image-caption');
const imageDeleteBtn = document.getElementById('image-delete');
const videoModal = document.getElementById('video-modal');
const reelVideo = document.getElementById('reel-video');
const videoCaption = document.getElementById('video-caption');
const videoFallback = document.getElementById('video-fallback');
const deleteModal = document.getElementById('delete-modal');
const deleteReason = document.getElementById('delete-reason');
const deleteTitle = document.getElementById('delete-title');
const deleteHint = document.getElementById('delete-hint');

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
  badges: 'الشارات',
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

const STATUS_TONE = {
  DRAFT: 'review',
  PUBLISHED: 'live',
  LOCKED: 'play',
  SETTLED: 'info',
  REJECTED: 'danger',
  CANCELLED: 'danger',
};

const GAME_TONE = {
  competitions: 'live',
  'king-game': 'play',
  'king-results': 'review',
  quiz: 'info',
  wheel: 'danger',
  reels: 'reel',
  community: 'community',
  share: 'info',
  coach: 'play',
  scorers: 'review',
  groups: 'community',
};

const AD_TABS = ['DRAFT', 'PUBLISHED', 'LOCKED', 'SETTLED', 'REJECTED', 'CANCELLED'];

const DELETE_COPY = {
  post: ['حذف المنشور', 'الحذف فوري، وهيترسل تحذير لصاحب المنشور. سبب الحذف اختياري.'],
  comment: ['حذف التعليق', 'الحذف فوري، وهيترسل تحذير لصاحب التعليق. سبب الحذف اختياري.'],
  reel: ['حذف الريل', 'الحذف فوري، الفيديو هيختفي من التطبيق، وهيترسل تحذير لصاحب الريل. سبب الحذف اختياري.'],
  'reel-comment': ['حذف تعليق الريل', 'الحذف فوري، وهيترسل تحذير لصاحب التعليق. سبب الحذف اختياري.'],
};

const STATE = {
  tab: 'overview',
  loadedTab: '',
  rejectId: null,
  deleteId: null,
  deleteKind: 'post',
  previewPostId: null,
  previewReelId: null,
  postFilter: 'all',
  postOrder: 'newest',
  adsById: {},
  postsById: {},
  mediaById: {},
  hls: null,
  inflight: null,
  badgeCategory: 'points',
  badgePeriod: 'all',
  badgeQuery: '',
  badgeCompetitionId: '',
  badgeDefs: [],
  candidates: [],
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

function num(value) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function clip(text, max) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

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

function closeDrawer() {
  drawerEl.hidden = true;
  drawerPanel.innerHTML = '';
}

function openDrawer(html) {
  drawerPanel.innerHTML = html;
  drawerEl.hidden = false;
}

function setTab(tab) {
  STATE.tab = tab;
  document.querySelectorAll('#tabs button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  pageTitleEl.textContent = PAGE_TITLES[tab] || 'لوحة المراجعة';
}

function syncFilters() {
  postFiltersEl.querySelectorAll('[data-order]').forEach((button) => {
    button.classList.toggle('active', button.dataset.order === STATE.postOrder);
  });
  postFiltersEl.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === STATE.postFilter);
  });
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
  const names = {
    facebook: 'فيسبوك',
    instagram: 'إنستجرام',
    whatsapp: 'واتساب',
    twitter: 'تويتر',
    tiktok: 'تيك توك',
    website: 'الموقع',
  };
  return Object.entries(links)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => `${names[key] || key}: ${value}`)
    .join('\n');
}

function statusTag(status) {
  const tone = STATUS_TONE[status] || 'info';
  return `<span class="tag tone-${tone}">${esc(AD_STATUS[status] || status)}</span>`;
}

function row(tone, title, sub, side, act, id) {
  return `<button type="button" class="row" data-act="${act}" data-id="${esc(id)}">
    <span class="dot tone-${tone}"></span>
    <span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
    <span class="row-side">${side}</span>
  </button>`;
}

function renderAds(rows) {
  STATE.adsById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد إعلانات في هذا التبويب. اضغط أي صف لفتح التفاصيل.</div>';
    return;
  }
  cardsEl.innerHTML = `<p class="muted">اضغط أي إعلان عشان تراجع كل التفاصيل.</p>` + rows
    .map((ad) => {
      STATE.adsById[ad.id] = ad;
      const entrants = ad._count?.entries ?? ad.participantsCount ?? 0;
      return row(
        STATUS_TONE[ad.status] || 'review',
        ad.prizeName || 'إعلان',
        `${ad.sponsor?.name || '—'} · ${ad.homeTeam || '—'} ضد ${ad.awayTeam || '—'}`,
        `${num(entrants)} مشترك`,
        'open-ad',
        ad.id,
      );
    })
    .join('');
}

function adDrawer(ad) {
  const sponsor = ad.sponsor || {};
  const owner = sponsor.owner || {};
  const entrants = ad._count?.entries ?? ad.participantsCount ?? 0;
  const views = ad._count?.views ?? ad.viewsCount ?? 0;
  const mode = ad.predictionMode === 'WINNER' ? 'الفائز فقط' : 'النتيجة بالضبط';
  const cash = ad.prizeCashAmount != null ? `${ad.prizeCashAmount} جنيه` : '';
  const score =
    ad.resultHomeScore == null || ad.resultAwayScore == null
      ? ''
      : `${ad.resultHomeScore} - ${ad.resultAwayScore}`;
  const hero = ad.prizeImageUrl
    ? `<div class="hero" style="background-image:url('${esc(ad.prizeImageUrl)}')"></div>`
    : '';
  const actions =
    ad.status === 'DRAFT'
      ? `<div class="drawer-actions">
          <button type="button" class="btn btn-live" data-act="publish" data-id="${esc(ad.id)}">موافقة</button>
          <button type="button" class="btn btn-danger" data-act="reject" data-id="${esc(ad.id)}">رفض</button>
        </div>`
      : '';
  openDrawer(`
    <button type="button" class="btn btn-ghost" data-act="close-drawer">رجوع للقائمة</button>
    ${hero}
    <div>${statusTag(ad.status)} <span class="tag tone-${ad.isFree ? 'live' : 'review'}">${ad.isFree ? 'مجانية' : 'مدفوعة'}</span></div>
    <h2>${esc(ad.prizeName)}</h2>
    <p class="muted">${esc(sponsor.name || '—')} · ${num(entrants)} مشترك · ${num(views)} مشاهدة</p>
    ${ad.rejectionReason ? `<p class="error">سبب الرفض: ${esc(ad.rejectionReason)}</p>` : ''}
    ${actions}
    <p class="block-title tone-info">المعلن</p>
    <div class="kv-grid">
      ${kv('اسم النشاط', sponsor.name)}
      ${kv('وصف النشاط', sponsor.description)}
      ${kv('العنوان', sponsor.address)}
      ${kv('التوصيل', sponsor.hasDelivery == null ? '' : yn(sponsor.hasDelivery, 'متاح', 'غير متاح'))}
      ${kv('حالة الحساب', sponsor.isActive === false ? 'موقوف' : 'نشط')}
      ${kv('التوثيق', sponsor.isVerified ? 'موثّق' : 'غير موثّق')}
      ${kv('متابعو الصفحة', sponsor._count?.followers ?? 0)}
      ${kv('عدد إعلاناته', sponsor._count?.competitions ?? 0)}
      ${kv('صاحب الحساب', owner.displayName || owner.username)}
      ${kv('اسم المستخدم', owner.username ? `@${owner.username}` : '')}
      ${kv('البريد', owner.email)}
      ${kv('روابط التواصل', socialText(sponsor.socialLinks))}
    </div>
    <p class="block-title tone-review">الجائزة</p>
    <div class="kv-grid">
      ${kv('اسم الجائزة', ad.prizeName)}
      ${kv('النوع', ad.prizeType)}
      ${kv('الفئة', ad.category?.nameAr)}
      ${kv('المبلغ النقدي', cash)}
      ${kv('عدد الفائزين', ad.winnersCount)}
      ${kv('وصف الجائزة', ad.prizeDescription)}
    </div>
    <p class="block-title tone-play">المباراة والموعد</p>
    <div class="kv-grid">
      ${kv('المباراة', `${ad.homeTeam || '—'} ضد ${ad.awayTeam || '—'}`)}
      ${kv('الدوري', ad.leagueName)}
      ${kv('موعد المباراة', fmtDate(ad.matchDate))}
      ${kv('حالة المباراة', ad.matchStatus)}
      ${kv('النتيجة', score)}
      ${kv('نوع التوقع', mode)}
      ${kv('آخر موعد للتوقع', fmtDate(ad.predictionDeadline))}
      ${kv('بداية المسابقة', fmtDate(ad.startAt))}
      ${kv('نهاية المسابقة', fmtDate(ad.endAt))}
      ${kv('رقم المباراة', ad.apiMatchId)}
      ${kv('تاريخ الإرسال', fmtDate(ad.createdAt))}
      ${kv('تاريخ النشر', fmtDate(ad.publishedAt))}
      ${kv('تاريخ المراجعة', fmtDate(ad.reviewedAt))}
    </div>
    <p class="block-title tone-community">شروط المسابقة</p>
    <div class="rules">${esc(ad.rules || 'المعلن لم يكتب شروطاً.')}</div>
  `);
}

function renderOverview(data) {
  const users = data?.users || {};
  const games = data?.games || [];
  const comps = data?.competitions || [];
  const totals = data?.competitionTotals || [];
  const maxPlayers = Math.max(1, ...games.map((game) => Number(game.players) || 0));
  const maxEntrants = Math.max(1, ...comps.map((comp) => Number(comp.participants) || 0));
  const userCards = [
    ['إجمالي المستخدمين', users.total, 'info'],
    ['جدد خلال 7 أيام', users.newWeek, 'live'],
    ['دخلوا خلال 7 أيام', users.activeWeek, 'play'],
    ['محظورون', users.banned, 'danger'],
    ['موقوفون', users.suspended, 'review'],
  ]
    .map(
      ([label, value, tone]) =>
        `<article class="stat tone-${tone}"><b>${num(value)}</b><span>${label}</span></article>`,
    )
    .join('');
  const bars = games
    .map((game) => {
      const width = Math.round(((Number(game.players) || 0) / maxPlayers) * 100);
      const tone = GAME_TONE[game.key] || 'info';
      return `<div class="bar">
        <p>${esc(game.name)}</p>
        <div class="track tone-${tone}"><i style="--w:${width}%"></i></div>
        <em>${num(game.players)} مستخدم · ${num(game.actions)} ${esc(game.actionLabel)}</em>
      </div>`;
    })
    .join('');
  const chips = totals
    .map(
      (item) =>
        `<button type="button" class="chip" data-goto="${esc(item.status)}">${esc(AD_STATUS[item.status] || item.status)} · ${num(item.competitions)}</button>`,
    )
    .join('');
  const table = comps
    .map((comp) => {
      const width = Math.round(((Number(comp.participants) || 0) / maxEntrants) * 100);
      return `<tr data-goto="${esc(comp.status)}">
        <td><strong>${esc(comp.prizeName)}</strong><div class="mini-track"><i style="--w:${width}%"></i></div></td>
        <td>${esc(comp.sponsorName)}</td>
        <td>${esc(comp.homeTeam)} ضد ${esc(comp.awayTeam)}</td>
        <td>${statusTag(comp.status)}</td>
        <td>${num(comp.participants)}</td>
        <td>${num(comp.views)}</td>
      </tr>`;
    })
    .join('');
  overviewEl.innerHTML = `
    <h2 class="section-title">المستخدمون</h2>
    <div class="stats">${userCards}</div>
    <h2 class="section-title">المستخدمون في كل لعبة</h2>
    <div class="bars">${bars}</div>
    <h2 class="section-title">المسابقات</h2>
    <div class="filters" style="margin-top:0">${chips}</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>الجائزة</th><th>المعلن</th><th>المباراة</th><th>الحالة</th><th>المشتركون</th><th>المشاهدات</th></tr></thead>
        <tbody>${table || '<tr><td colspan="6" class="empty">لا توجد مسابقات</td></tr>'}</tbody>
      </table>
    </div>
    <p class="muted">آخر تحديث ${esc(fmtDate(data?.generatedAt))}. الشريط يوضح حجم المشاركة مقارنة بأكبر رقم في القائمة.</p>
  `;
}

const BADGE_CATEGORIES = [
  ['points', 'النقاط'],
  ['prediction_streak', 'سلسلة التوقعات'],
  ['prediction_accuracy', 'دقة التوقعات'],
  ['king_game', 'ملك اللعبة'],
  ['king_results', 'ملك النتائج'],
  ['scorers_europe', 'هدافين أوروبا'],
  ['scorers_egypt', 'هدافين مصر'],
  ['coach', 'ملك المدربين'],
  ['posts', 'المنشورات'],
  ['reels', 'الريلز'],
  ['comments', 'التعليقات'],
  ['shares', 'المشاركات'],
  ['community_activity', 'المجتمع'],
  ['daily_streak', 'سلسلة يومية'],
  ['competition_champion', 'بطل مسابقة'],
];

async function renderBadges() {
  const [overview, defs, competitions, candidates] = await Promise.all([
    api('/badges/overview'),
    api('/badges/definitions'),
    api('/badges/competitions'),
    api(`/badges/candidates?${new URLSearchParams({
      category: STATE.badgeCategory,
      period: STATE.badgePeriod,
      competitionId: STATE.badgeCompetitionId,
      q: STATE.badgeQuery,
    })}`),
  ]);
  STATE.badgeDefs = defs.data || [];
  STATE.candidates = candidates.data || [];
  const stats = overview.data || {};
  const cards = [
    ['سارية', stats.active, 'live'],
    ['منتهية', stats.expired, 'review'],
    ['مستخدمون', stats.recognizedUsers, 'info'],
    ['التعريفات', stats.definitions, 'reel'],
  ].map(([label, value, tone]) => `<article class="stat tone-${tone}"><b>${num(value)}</b><span>${label}</span></article>`).join('');
  const cats = BADGE_CATEGORIES.map(([key, label]) => `<button type="button" class="chip ${STATE.badgeCategory === key ? 'active' : ''}" data-badge-cat="${key}">${label}</button>`).join('');
  const periods = [['all', 'كل الوقت'], ['30d', '30 يوم'], ['7d', '7 أيام']]
    .map(([key, label]) => `<button type="button" class="chip ${STATE.badgePeriod === key ? 'active' : ''}" data-badge-period="${key}">${label}</button>`).join('');
  const comps = (competitions.data || []).map((comp) => `<option value="${esc(comp.id)}" ${comp.id === STATE.badgeCompetitionId ? 'selected' : ''}>${esc(comp.prizeName)}</option>`).join('');
  const rows = (candidates.data || []).map((person) => row(
    person.isVerified ? 'live' : 'info',
    person.displayName || person.username,
    `@${person.username} · ${person.metricLabel} ${num(person.metricValue)}${person.badge ? ` · ${person.badge.title}` : ''}`,
    `#${person.rank}`,
    'open-candidate',
    person.userId,
  )).join('');
  const recent = (stats.recent || []).map((item) => `<div class="event"><div><span class="tag tone-${item.active ? 'live' : 'review'}">${esc(item.badgeName)}</span> ${esc(item.displayName || item.username)} · ${esc(item.title)}</div>${item.active ? `<button type="button" class="btn btn-ghost" data-act="revoke-badge" data-id="${esc(item.id)}">سحب</button>` : ''}</div>`).join('');
  overviewEl.innerHTML = `
    <div class="stats">${cards}</div>
    <div class="filters">
      <div class="filter-group">${cats}</div>
      <div class="filter-group">${periods}</div>
      <input id="badge-search" placeholder="ابحث باسم المستخدم" value="${esc(STATE.badgeQuery)}" />
      <select id="badge-competition"><option value="">كل المسابقات</option>${comps}</select>
    </div>
    <h2 class="section-title">أفضل 10 مرشحين</h2>
    <div class="list">${rows || '<div class="empty">لا يوجد مرشحون بهذه البيانات</div>'}</div>
    <h2 class="section-title">آخر المنح</h2>
    ${recent || '<div class="empty">لا توجد منح بعد</div>'}
  `;
  overviewEl.querySelector('#badge-search')?.addEventListener('change', (event) => {
    STATE.badgeQuery = event.target.value;
    load();
  });
  overviewEl.querySelector('#badge-competition')?.addEventListener('change', (event) => {
    STATE.badgeCompetitionId = event.target.value;
    load();
  });
}

function openCandidate(userId) {
  const person = STATE.candidates.find((row) => row.userId === userId);
  if (!person) return;
  const options = STATE.badgeDefs.map((badge) => `<option value="${esc(badge.key)}">${esc(badge.nameAr)}</option>`).join('');
  openDrawer(`
    <button type="button" class="btn btn-ghost" data-act="close-drawer">رجوع</button>
    <h2>${esc(person.displayName || person.username)}</h2>
    <p class="muted">@${esc(person.username)} · ${esc(person.metricLabel)} ${num(person.metricValue)}</p>
    <p class="muted">${person.isVerified ? 'موثّق' : 'غير موثّق'} · ${person.isDeveloper ? 'مطوّر' : 'مستخدم'}</p>
    <form id="award-form" class="badge-form">
      <label>الشارة<select name="badgeKey" required>${options}</select></label>
      <label>اللقب<input name="customTitle" maxlength="80" required placeholder="ملك التوقعات" /></label>
      <label>وصف<textarea name="description" maxlength="500" rows="3"></textarea></label>
      <label>المدة
        <select name="duration">
          <option value="7">7 أيام</option>
          <option value="30">30 يوم</option>
          <option value="permanent" selected>دائمة</option>
        </select>
      </label>
      <button type="submit" class="btn btn-live">مراجعة ومنح</button>
    </form>
  `);
  drawerPanel.querySelector('#award-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const badge = STATE.badgeDefs.find((item) => item.key === data.get('badgeKey'));
    const title = String(data.get('customTitle') || '').trim();
    const duration = String(data.get('duration') || 'permanent');
    const days = duration === 'permanent' ? null : Number(duration);
    const expiry = days ? new Date(Date.now() + days * 86400000).toLocaleDateString('ar-EG') : 'بدون انتهاء';
    const ok = window.confirm(`منح ${person.username}\n${badge?.nameAr || ''}\n${title}\n${duration === 'permanent' ? 'دائمة' : duration + ' يوم'} · ${expiry}`);
    if (!ok) return;
    try {
      await api('/badges/awards', {
        method: 'POST',
        body: JSON.stringify({
          userId: person.userId,
          badgeKey: data.get('badgeKey'),
          customTitle: title,
          description: data.get('description'),
          duration,
          competitionId: STATE.badgeCompetitionId || null,
        }),
      });
      closeDrawer();
      await load();
    } catch (err) {
      deskError.hidden = false;
      deskError.textContent = err.message || 'تعذر منح الشارة';
    }
  });
}

function badges(item) {
  const bits = [];
  if (item.status === 'HIDDEN') bits.push('<span class="tag tone-review">مخفي</span>');
  if (item.aiFlagged) bits.push('<span class="tag tone-reel">مشكوك AI</span>');
  if (item.reportsCount > 0) bits.push(`<span class="tag tone-danger">بلاغات ${item.reportsCount}</span>`);
  if (item.pendingReports > 0) bits.push(`<span class="tag tone-review">قيد المراجعة ${item.pendingReports}</span>`);
  return bits.join(' ');
}

function renderPosts(rows) {
  STATE.postsById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد منشورات في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((post) => {
      STATE.postsById[post.id] = post;
      const name = post.user?.displayName || post.user?.username || 'مستخدم';
      return row('community', name, clip(post.content, 90) || 'بدون نص', fmtDate(post.createdAt), 'open-post', post.id);
    })
    .join('');
}

function renderComments(rows) {
  STATE.postsById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد تعليقات في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((comment) => {
      STATE.postsById[comment.id] = comment;
      const name = comment.user?.displayName || comment.user?.username || 'مستخدم';
      return row('info', name, clip(comment.content, 90), 'تعليق', 'open-comment', comment.id);
    })
    .join('');
}

function renderReels(rows) {
  STATE.mediaById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد ريلز في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((reel) => {
      STATE.mediaById[reel.id] = {
        playbackUrl: reel.playbackUrl,
        thumbnailUrl: reel.thumbnailUrl,
        caption: reel.caption || '',
      };
      STATE.postsById[reel.id] = reel;
      const name = reel.user?.displayName || reel.user?.username || 'مستخدم';
      return row('reel', name, clip(reel.caption, 80) || 'بدون وصف', `${num(reel.views)} مشاهدة`, 'open-reel', reel.id);
    })
    .join('');
}

function renderReelComments(rows) {
  STATE.mediaById = {};
  STATE.postsById = {};
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد تعليقات ريلز في هذا الفلتر</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((comment) => {
      STATE.postsById[comment.id] = comment;
      if (comment.reel?.id) {
        STATE.mediaById[comment.reel.id] = {
          playbackUrl: comment.reel.playbackUrl,
          thumbnailUrl: comment.reel.thumbnailUrl,
          caption: comment.reel.caption || '',
        };
      }
      const name = comment.user?.displayName || comment.user?.username || 'مستخدم';
      return row('reel', name, clip(comment.content, 90), 'تعليق ريل', 'open-reel-comment', comment.id);
    })
    .join('');
}

function renderActivity(rows) {
  if (!rows.length) {
    activityEl.innerHTML = '<div class="empty">لا يوجد نشاط بعد</div>';
    return;
  }
  activityEl.innerHTML = rows
    .map((item) => {
      const prize = item.payload?.prizeName || item.competition?.prizeName || 'جائزة';
      const store = item.payload?.storeName || item.competition?.sponsor?.name || '';
      let tone = 'info';
      let label = 'نشاط';
      let text = prize;
      if (item.type === 'APPROVED') {
        tone = 'live';
        label = 'موافقة';
        text = `تم قبول «${prize}» من ${store}`;
      } else if (item.type === 'REJECTED') {
        tone = 'danger';
        label = 'رفض';
        text = `تم رفض «${prize}» من ${store}${item.payload?.reason ? ` — ${item.payload.reason}` : ''}`;
      } else if (item.type === 'WINNER' || item.payload?.displayName) {
        tone = 'review';
        label = 'فوز';
        text = `تم تربيح ${item.payload?.displayName || item.payload?.username || 'مستخدم'} في «${prize}»`;
      }
      return `<div class="event"><div><span class="tag tone-${tone}">${label}</span> ${esc(text)}</div><div class="when">${fmtDate(item.createdAt)}</div></div>`;
    })
    .join('');
}

function openPost(id) {
  const post = STATE.postsById[id];
  if (!post) return;
  const image = post.imageUrl
    ? `<button type="button" class="btn btn-ghost" data-act="preview" data-id="${esc(post.id)}">عرض الصورة</button>`
    : '';
  openDrawer(`
    <button type="button" class="btn btn-ghost" data-act="close-drawer">رجوع للقائمة</button>
    <h2>${esc(post.user?.displayName || post.user?.username || 'مستخدم')}</h2>
    <div>${badges(post)}</div>
    <div class="rules">${esc(post.content || '—')}</div>
    <p class="muted">${fmtDate(post.createdAt)} · ${num(post.likesCount)} إعجاب · ${num(post.commentsCount)} تعليق</p>
    <div class="drawer-actions">${image}<button type="button" class="btn btn-danger" data-act="delete-post" data-id="${esc(post.id)}">حذف</button></div>
  `);
}

function openComment(id, kind) {
  const comment = STATE.postsById[id];
  if (!comment) return;
  const parent = comment.post?.content || comment.parentContent || comment.reel?.caption || '';
  const watch = comment.reel?.id
    ? `<button type="button" class="btn btn-ghost" data-act="play" data-id="${esc(comment.reel.id)}">عرض الريل</button>`
    : '';
  const act = kind === 'reel' ? 'delete-reel-comment' : 'delete-comment';
  openDrawer(`
    <button type="button" class="btn btn-ghost" data-act="close-drawer">رجوع للقائمة</button>
    <h2>${esc(comment.user?.displayName || comment.user?.username || 'مستخدم')}</h2>
    <div>${badges(comment)}</div>
    <div class="rules">${esc(comment.content || '—')}</div>
    ${parent ? `<p class="muted">على: ${esc(clip(parent, 180))}</p>` : ''}
    <div class="drawer-actions">${watch}<button type="button" class="btn btn-danger" data-act="${act}" data-id="${esc(comment.id)}">حذف</button></div>
  `);
}

function openReel(id) {
  const reel = STATE.postsById[id];
  if (!reel) return;
  openDrawer(`
    <button type="button" class="btn btn-ghost" data-act="close-drawer">رجوع للقائمة</button>
    <h2>${esc(reel.user?.displayName || reel.user?.username || 'مستخدم')}</h2>
    <div>${badges(reel)} ${reel.status === 'PROCESSING' ? '<span class="tag tone-review">جاري المعالجة</span>' : ''}</div>
    <div class="rules">${esc(reel.caption || 'بدون وصف')}</div>
    <p class="muted">${num(reel.views)} مشاهدة · ${num(reel.likesCount)} إعجاب · ${num(reel.commentsCount)} تعليق</p>
    <div class="drawer-actions">
      <button type="button" class="btn btn-ghost" data-act="play" data-id="${esc(reel.id)}">عرض الفيديو</button>
      <button type="button" class="btn btn-danger" data-act="delete-reel" data-id="${esc(reel.id)}">حذف</button>
    </div>
  `);
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

async function openVideo(id) {
  const media = STATE.mediaById[id];
  if (!media) return;
  stopVideo();
  STATE.previewReelId = id;
  videoCaption.textContent = media.caption || '';
  videoFallback.hidden = Boolean(media.playbackUrl);
  reelVideo.poster = media.thumbnailUrl || '';
  if (media.playbackUrl) {
    const url = media.playbackUrl;
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (isHls && reelVideo.canPlayType('application/vnd.apple.mpegurl')) {
      reelVideo.src = url;
    } else if (isHls) {
      const { default: HlsLib } = await import('hls.js');
      if (HlsLib.isSupported()) {
        const hls = new HlsLib({ enableWorker: false });
        hls.loadSource(url);
        hls.attachMedia(reelVideo);
        STATE.hls = hls;
      } else {
        reelVideo.src = url;
      }
    } else {
      reelVideo.src = url;
    }
  }
  videoModal.hidden = false;
}

function openImage(postId) {
  const post = STATE.postsById[postId];
  if (!post?.imageUrl) return;
  STATE.previewPostId = postId;
  imagePreview.src = post.imageUrl;
  imageCaption.textContent = post.user?.displayName || post.user?.username || '';
  imageDeleteBtn.hidden = false;
  imageModal.hidden = false;
}

function openDelete(id, kind) {
  STATE.deleteId = id;
  STATE.deleteKind = kind;
  deleteReason.value = '';
  const copy = DELETE_COPY[kind] || DELETE_COPY.post;
  deleteTitle.textContent = copy[0];
  deleteHint.textContent = copy[1];
  deleteModal.hidden = false;
}

async function renderAppUpdate() {
  let notice = null;
  try {
    notice = (await api('/app-update')).data;
  } catch {
    notice = null;
  }
  const status = notice
    ? `آخر إرسال: ${fmtDate(notice.sentAt)} — وصل لـ ${num(notice.devices)} جهاز`
    : 'مفيش تنبيه ظاهر دلوقتي';
  overviewEl.innerHTML = `
    <form id="app-update-form" style="max-width:560px;display:grid;gap:12px">
      <h2 style="margin:0">إرسال تحديث لكل المستخدمين</h2>
      <p class="muted">هيظهر بوب أب في أي صفحة: «لاحقاً» أو «تحديث». التحديث يفتح متجر الآيفون أو جوجل بلاي، وكمان يتبعت إشعار.</p>
      <label style="display:grid;gap:6px;font-weight:700">
        نص الرسالة
        <textarea id="app-update-message" rows="4" maxlength="280" placeholder="تحديث متاح — نزّل آخر نسخة" style="width:100%;border-radius:16px;padding:12px;border:1px solid rgba(255,255,255,.12);background:#0b0b10;color:inherit">${esc(notice?.message || 'تحديث متاح')}</textarea>
      </label>
      <p class="muted">${esc(status)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="submit" class="btn btn-live" id="app-update-send">إرسال للجميع</button>
        <button type="button" class="btn btn-ghost" id="app-update-clear">إيقاف البوب أب</button>
      </div>
    </form>`;
  document.getElementById('app-update-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('app-update-send');
    const message = document.getElementById('app-update-message').value.trim();
    button.disabled = true;
    deskError.hidden = true;
    try {
      await api('/app-update', { method: 'POST', body: JSON.stringify({ message }) });
      await renderAppUpdate();
    } catch (err) {
      deskError.hidden = false;
      deskError.textContent = err.message || 'تعذر الإرسال';
      button.disabled = false;
    }
  });
  document.getElementById('app-update-clear').addEventListener('click', async () => {
    try {
      await api('/app-update/clear', { method: 'POST', body: '{}' });
      await renderAppUpdate();
    } catch (err) {
      deskError.hidden = false;
      deskError.textContent = err.message || 'تعذر الإيقاف';
    }
  });
}

async function load() {
  if (STATE.inflight) return STATE.inflight;
  deskError.hidden = true;
  if (STATE.loadedTab !== STATE.tab) closeDrawer();
  STATE.loadedTab = STATE.tab;
  STATE.inflight = (async () => {
    const content = ['posts', 'comments', 'reels', 'reel-comments'].includes(STATE.tab);
    const overview = STATE.tab === 'overview' || STATE.tab === 'badges';
    const activity = STATE.tab === 'activity';
    postFiltersEl.hidden = !content;
    if (content) syncFilters();
    try {
        if (STATE.tab === 'badges') {
        cardsEl.hidden = true;
        activityEl.hidden = true;
        overviewEl.hidden = false;
        await renderBadges();
        return;
      }
      if (STATE.tab === 'app-update') {
        cardsEl.hidden = true;
        activityEl.hidden = true;
        overviewEl.hidden = false;
        await renderAppUpdate();
        return;
      }
      if (overview) {
        cardsEl.hidden = true;
        activityEl.hidden = true;
        overviewEl.hidden = false;
        const json = await api('/overview');
        renderOverview(json.data || {});
        return;
      }
      overviewEl.hidden = true;
      if (activity) {
        cardsEl.hidden = true;
        activityEl.hidden = false;
        const json = await api('/activity');
        renderActivity(json.data || []);
        return;
      }
      cardsEl.hidden = false;
      activityEl.hidden = true;
      if (content) {
        const qs = new URLSearchParams({ filter: STATE.postFilter, order: STATE.postOrder, limit: '100' });
        if (STATE.tab === 'reel-comments') renderReelComments((await api(`/reels/comments?${qs}`)).data || []);
        else if (STATE.tab === 'reels') renderReels((await api(`/reels?${qs}`)).data || []);
        else if (STATE.tab === 'comments') renderComments((await api(`/community/comments?${qs}`)).data || []);
        else renderPosts((await api(`/community/posts?${qs}`)).data || []);
        return;
      }
      if (AD_TABS.includes(STATE.tab)) {
        const json = await api(`/competitions?status=${encodeURIComponent(STATE.tab)}`);
        renderAds(json.data || []);
      }
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

async function onAct(act, id, button) {
  if (act === 'close-drawer') {
    closeDrawer();
    return;
  }
  if (act === 'open-candidate') return openCandidate(id);
  if (act === 'revoke-badge') {
    if (!window.confirm('سحب هذه الشارة؟')) return;
    try {
      await api(`/badges/awards/${id}/revoke`, { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      deskError.hidden = false;
      deskError.textContent = err.message || 'تعذر السحب';
    }
    return;
  }
  if (act === 'open-ad') {
    const ad = STATE.adsById[id];
    if (ad) adDrawer(ad);
    return;
  }
  if (act === 'open-post') return openPost(id);
  if (act === 'open-comment') return openComment(id, 'community');
  if (act === 'open-reel') return openReel(id);
  if (act === 'open-reel-comment') return openComment(id, 'reel');
  if (act === 'preview') return openImage(id);
  if (act === 'play') return openVideo(id);
  if (act === 'delete-post') return openDelete(id, 'post');
  if (act === 'delete-comment') return openDelete(id, 'comment');
  if (act === 'delete-reel') return openDelete(id, 'reel');
  if (act === 'delete-reel-comment') return openDelete(id, 'reel-comment');
  if (act === 'reject') {
    STATE.rejectId = id;
    rejectReason.value = '';
    rejectModal.hidden = false;
    return;
  }
  if (act !== 'publish') return;
  if (button) button.disabled = true;
  try {
    await api(`/competitions/${id}/publish`, { method: 'POST', body: '{}' });
    closeDrawer();
    setTab('PUBLISHED');
    await load();
  } catch (err) {
    deskError.hidden = false;
    deskError.textContent = err.message || 'فشل النشر';
  } finally {
    if (button) button.disabled = false;
  }
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const button = document.getElementById('login-btn');
  button.disabled = true;
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
      err.status === 503 ? 'اللوحة غير مُعدّة على السيرفر' : err.status === 429 ? 'محاولات كثيرة — انتظر قليلاً' : 'بيانات الدخول غير صحيحة';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('logout').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } finally {
    closeDrawer();
    showLogin();
  }
});

document.getElementById('tabs').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tab]');
  if (!button) return;
  setTab(button.dataset.tab);
  load();
});

overviewEl.addEventListener('click', (event) => {
  const category = event.target.closest('[data-badge-cat]');
  const period = event.target.closest('[data-badge-period]');
  if (category) {
    STATE.badgeCategory = category.dataset.badgeCat;
    load();
    return;
  }
  if (period) {
    STATE.badgePeriod = period.dataset.badgePeriod;
    load();
    return;
  }
  const revoke = event.target.closest('[data-act="revoke-badge"]');
  if (revoke) {
    onAct('revoke-badge', revoke.dataset.id, revoke);
    return;
  }
  const candidate = event.target.closest('[data-act="open-candidate"]');
  if (candidate) {
    onAct('open-candidate', candidate.dataset.id, candidate);
    return;
  }
  const button = event.target.closest('[data-goto]');
  if (!button) return;
  setTab(button.dataset.goto);
  load();
});

postFiltersEl.addEventListener('click', (event) => {
  const order = event.target.closest('[data-order]');
  const filter = event.target.closest('[data-filter]');
  if (order) {
    STATE.postOrder = order.dataset.order;
    syncFilters();
    load();
  }
  if (filter) {
    STATE.postFilter = filter.dataset.filter;
    syncFilters();
    load();
  }
});

function bindActs(root) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button || !root.contains(button)) return;
    onAct(button.dataset.act, button.dataset.id, button);
  });
}
bindActs(cardsEl);
bindActs(drawerEl);

document.getElementById('reject-cancel').addEventListener('click', () => {
  rejectModal.hidden = true;
  STATE.rejectId = null;
});

document.getElementById('reject-confirm').addEventListener('click', async () => {
  if (!STATE.rejectId) return;
  const button = document.getElementById('reject-confirm');
  button.disabled = true;
  try {
    await api(`/competitions/${STATE.rejectId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: rejectReason.value }),
    });
    rejectModal.hidden = true;
    STATE.rejectId = null;
    closeDrawer();
    setTab('REJECTED');
    await load();
  } catch (err) {
    deskError.hidden = false;
    deskError.textContent = err.message || 'فشل الرفض';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('image-close').addEventListener('click', () => {
  imageModal.hidden = true;
  STATE.previewPostId = null;
  imagePreview.removeAttribute('src');
});

imageDeleteBtn.addEventListener('click', () => {
  if (STATE.previewPostId) openDelete(STATE.previewPostId, 'post');
});

document.getElementById('video-close').addEventListener('click', () => {
  videoModal.hidden = true;
  STATE.previewReelId = null;
  stopVideo();
});

document.getElementById('video-delete').addEventListener('click', () => {
  if (STATE.previewReelId) openDelete(STATE.previewReelId, 'reel');
});

document.getElementById('delete-cancel').addEventListener('click', () => {
  deleteModal.hidden = true;
  STATE.deleteId = null;
});

document.getElementById('delete-confirm').addEventListener('click', async () => {
  if (!STATE.deleteId) return;
  const button = document.getElementById('delete-confirm');
  const kind = DELETE_COPY[STATE.deleteKind] ? STATE.deleteKind : 'post';
  const paths = {
    post: `/community/posts/${STATE.deleteId}/delete`,
    comment: `/community/comments/${STATE.deleteId}/delete`,
    reel: `/reels/${STATE.deleteId}/delete`,
    'reel-comment': `/reels/comments/${STATE.deleteId}/delete`,
  };
  button.disabled = true;
  try {
    await api(paths[kind], { method: 'POST', body: JSON.stringify({ reason: deleteReason.value }) });
    deleteModal.hidden = true;
    imageModal.hidden = true;
    videoModal.hidden = true;
    stopVideo();
    closeDrawer();
    STATE.deleteId = null;
    STATE.previewPostId = null;
    STATE.previewReelId = null;
    await load();
  } catch (err) {
    deskError.hidden = false;
    deskError.textContent = err.message || 'فشل الحذف';
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !deskEl.hidden) load();
});

api('/me').then(showDesk).catch(showLogin);
