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

const STATE = {
  tab: 'DRAFT',
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

function renderCards(rows) {
  if (!rows.length) {
    cardsEl.innerHTML = '<div class="empty">لا توجد إعلانات في هذا التبويب</div>';
    return;
  }
  cardsEl.innerHTML = rows
    .map((c) => {
      const img = c.prizeImageUrl
        ? `style="background-image:url('${esc(c.prizeImageUrl)}')"`
        : '';
      const canReview = c.status === 'DRAFT';
      return `<article class="card">
        <div class="thumb" ${img}></div>
        <div class="card-body">
          <div class="prize">${esc(c.prizeName)}</div>
          <div class="meta">
            ${esc(c.sponsor?.name || '—')} · ${esc(c.prizeType || '')}<br/>
            ${esc(c.homeTeam)} ضد ${esc(c.awayTeam)}<br/>
            مشاركون: ${c._count?.entries ?? c.participantsCount ?? 0}
            ${c.rejectionReason ? `<br/>سبب الرفض: ${esc(c.rejectionReason)}` : ''}
          </div>
          ${
            canReview
              ? `<div class="actions">
                  <button class="approve" data-act="publish" data-id="${esc(c.id)}">موافقة</button>
                  <button class="danger" data-act="reject" data-id="${esc(c.id)}">رفض</button>
                </div>`
              : `<div class="meta">${esc(c.status)} · ${fmtDate(c.createdAt)}</div>`
          }
        </div>
      </article>`;
    })
    .join('');
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
      const showCommunityFilters = isPosts || isComments || isReels || isReelComments;
      postFiltersEl.hidden = !showCommunityFilters;
      if (showCommunityFilters) syncPostFilterChips();

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
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  setTab(btn.dataset.tab);
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
