// Summarises a Newman JSON report so we can see status codes per request
// and inspect the response bodies for endpoints we care about.
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, 'run-result.json');
const r = JSON.parse(fs.readFileSync(file, 'utf8'));

const interestingFolders = new Set(['Matches', 'Reels', 'Predictions', 'Quiz']);
const interestingNames = new Set([
    'Health Check',
    'API Info',
    'Get Reels Feed',
    'Get Live Fixtures',
    'Get Fixtures by Date',
    'Get Quiz Categories',
    'Get Daily Quiz Status',
    'Get Quiz Stats',
    'Get User XP (Public)',
    'Get Predictions Leaderboard',
]);

const rows = [];
for (const exec of r.run.executions) {
    const item = exec.item;
    const name = item.name;
    const status = exec.response?.code;
    const duration = exec.response?.responseTime;
    const sz = exec.response?.responseSize;
    const url = exec.request?.url?.host?.join('.') + '/' + (exec.request?.url?.path || []).join('/');
    rows.push({ name, status, duration, size: sz, url });
}

console.log('--- ALL REQUESTS ---');
for (const row of rows) {
    const flag = row.status >= 400 ? ' ⚠️' : '';
    console.log(`${String(row.status).padEnd(4)} ${String(row.duration ?? '-').padStart(4)}ms  ${row.name}${flag}`);
}

console.log('\n--- NON-2xx RESPONSES (BODIES) ---');
for (const exec of r.run.executions) {
    const code = exec.response?.code ?? 0;
    if (code < 400) continue;
    const name = exec.item.name;
    const body = exec.response?.stream
        ? Buffer.from(exec.response.stream.data).toString('utf8')
        : '';
    console.log(`\n[${code}] ${name}`);
    console.log(body.slice(0, 800));
}

console.log('\n--- KEY 200 BODIES (FOOTBALL/REELS/QUIZ) ---');
for (const exec of r.run.executions) {
    const name = exec.item.name;
    if (!interestingNames.has(name)) continue;
    const code = exec.response?.code ?? 0;
    const body = exec.response?.stream
        ? Buffer.from(exec.response.stream.data).toString('utf8')
        : '';
    console.log(`\n[${code}] ${name}`);
    console.log(body.slice(0, 1200));
}

console.log('\n--- ASSERTION FAILURES ---');
const failures = r.run.failures || [];
if (failures.length === 0) console.log('(none)');
for (const f of failures) {
    console.log(`✗ ${f.source?.name || f.parent?.name}: ${f.error?.test || f.error?.name} — ${f.error?.message}`);
}
