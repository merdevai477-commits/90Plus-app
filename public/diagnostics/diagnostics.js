const KEY = 'diagAdminKey';
const statusEl = document.getElementById('status');
const sessionsEl = document.getElementById('sessions');
const reportEl = document.getElementById('report');

function setStatus(text) {
  statusEl.textContent = text;
}

function headers() {
  const key = sessionStorage.getItem(KEY) || '';
  return { 'Content-Type': 'application/json', 'x-diagnostics-admin-key': key };
}

async function api(path, options) {
  const response = await fetch('/api/diagnostics/admin' + path, { ...options, headers: headers() });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
  return body;
}

function badge(kind) {
  const span = document.createElement('span');
  span.className = 'badge ' + (kind === 'inference' ? 'inference' : 'fact');
  span.textContent = kind === 'inference' ? 'inference' : 'fact';
  return span;
}

async function loadSessions() {
  setStatus('Loading sessions…');
  const body = await api('/sessions?limit=20');
  sessionsEl.replaceChildren();
  for (const session of body.sessions || []) {
    const item = document.createElement('li');
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Report';
    open.addEventListener('click', () => loadReport(session.id));
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'Stop';
    stop.addEventListener('click', async () => {
      await api('/sessions/' + session.id + '/stop', { method: 'POST' });
      await loadSessions();
    });
    const text = document.createElement('span');
    text.textContent = (session.label || session.id) + ' · ' + (session.state || session.status);
    item.append(open, stop, text);
    sessionsEl.append(item);
  }
  setStatus((body.sessions || []).length + ' sessions');
}

async function loadReport(sessionId) {
  setStatus('Loading report…');
  const report = await api('/sessions/' + sessionId + '/report');
  reportEl.replaceChildren();
  const title = document.createElement('p');
  title.textContent = sessionId + ' · client ' + report.completeness.clientEvents + ' · backend ' + report.completeness.backendEvents;
  reportEl.append(title);
  if (!report.findings.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No findings. That can mean a quiet session or events that were not uploaded.';
    reportEl.append(empty);
    setStatus('Report ready');
    return;
  }
  for (const finding of report.findings) {
    const block = document.createElement('article');
    block.className = 'finding';
    const heading = document.createElement('h3');
    heading.append(badge(finding.kind), document.createTextNode(' ' + finding.title));
    const cause = document.createElement('p');
    cause.textContent = finding.probableCause;
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = 'confidence ' + finding.confidence + ' · n=' + finding.evidence.n;
    const rec = document.createElement('p');
    rec.textContent = finding.recommendation;
    block.append(heading, cause, meta, rec);
    for (const caveat of finding.caveats || []) {
      const line = document.createElement('p');
      line.className = 'muted';
      line.textContent = caveat;
      block.append(line);
    }
    reportEl.append(block);
  }
  setStatus('Report ready');
}

document.getElementById('saveKey').addEventListener('click', () => {
  sessionStorage.setItem(KEY, document.getElementById('adminKey').value.trim());
  setStatus('Key saved in this tab only');
});

document.getElementById('refresh').addEventListener('click', () => {
  loadSessions().catch((error) => setStatus(error.message));
});

document.getElementById('createForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const build = form.build.value.trim();
  try {
    await api('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        label: form.label.value.trim() || undefined,
        durationMin: Number(form.minutes.value),
        target: { platform: form.platform.value, buildNumbers: [build] },
      }),
    });
    form.reset();
    await loadSessions();
  } catch (error) {
    setStatus(error.message);
  }
});

if (sessionStorage.getItem(KEY)) {
  loadSessions().catch((error) => setStatus(error.message));
}
