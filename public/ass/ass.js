const loginEl = document.getElementById('login');
const deskEl = document.getElementById('desk');
const cardsEl = document.getElementById('cards');
const activityEl = document.getElementById('activity');
const loginError = document.getElementById('login-error');
const deskError = document.getElementById('desk-error');
const rejectModal = document.getElementById('reject-modal');
const rejectReason = document.getElementById('reject-reason');

const STATE = {
  tab: 'DRAFT',
  rejectId: null,
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

async function load() {
  if (STATE.inflight) return STATE.inflight;
  deskError.hidden = true;
  STATE.inflight = (async () => {
    try {
      if (STATE.tab === 'activity') {
        cardsEl.hidden = true;
        activityEl.hidden = false;
        const json = await api('/activity');
        renderActivity(json.data || []);
        return;
      }
      cardsEl.hidden = false;
      activityEl.hidden = true;
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

cardsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === 'reject') {
    STATE.rejectId = id;
    rejectReason.value = '';
    rejectModal.hidden = false;
    return;
  }
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

api('/me')
  .then(showDesk)
  .catch(showLogin);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !deskEl.hidden) load();
});
