// End-to-end check of the real server: static files, lobby flow and one judged answer.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), dir = await mkdtemp(resolve(tmpdir(), 'arena-it-'));
const port = 35000 + Math.floor(Math.random() * 10000), base = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, ['server/index.mjs'], {cwd: root, env: {...process.env, PORT: String(port), DATA_DIR: dir}, stdio: ['ignore', 'pipe', 'pipe']});
let logs = ''; proc.stderr.on('data', x => logs += x);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(path, body, token) {
  const res = await fetch(base + path, {method: 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: JSON.stringify(body)});
  return {status: res.status, body: await res.json()};
}
try {
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) { try { ready = (await fetch(base + '/api/health')).ok; } catch {} if (!ready) await sleep(50); }
  assert.ok(ready, 'server did not start');

  const page = await fetch(base + '/', {headers: {'Accept-Encoding': 'gzip'}});
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes('/assets/'), 'build dist first: npm run build');
  const asset = html.match(/\/assets\/[^"]+\.js/)[0], js = await fetch(base + asset, {headers: {'Accept-Encoding': 'gzip'}});
  assert.equal(js.headers.get('content-encoding'), 'gzip');
  assert.match(js.headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(base + asset, {headers: {'If-None-Match': js.headers.get('etag')}})).status, 304);
  console.log('PASS static files: gzip, immutable cache, ETag.');

  const created = await post('/api/create', {name: 'Ala'});
  assert.equal(created.status, 200);
  const players = [{...created.body}];
  for (const name of ['Bartek', 'Celina']) { const joined = await post('/api/join', {name, code: created.body.code}); assert.equal(joined.status, 200); players.push(joined.body); }
  const code = created.body.code;
  // A stale revision is rejected but returns the current state, which is all we need here.
  const state = async i => (await post(`/api/rooms/${code}/action`, {type: 'STATE', rev: -1}, players[i].token)).body.state;
  async function act(i, type, data = {}) { const r = await post(`/api/rooms/${code}/action`, {type, rev: (await state(i)).rev, ...data}, players[i].token); assert.equal(r.status, 200, r.body.error); return r.body.state; }
  // Players must be connected (SSE) for the server to accept actions.
  const streams = players.map(p => fetch(`${base}/api/rooms/${code}/stream?token=${p.token}`));
  await sleep(300);

  const s0 = await state(0);
  assert.ok(s0.categories.includes('Co to za piłkarz?'));
  assert.equal(s0.players.length, 3);
  for (const [i, category] of ['Stolice', 'Nauka', 'Co to za piłkarz?'].entries()) { await act(i, 'CATEGORY', {category}); await act(i, 'READY'); }
  let s = await act(0, 'START');
  assert.equal(s.phase, 'choose');
  const you = await Promise.all([0, 1, 2].map(async i => (await state(i)).you)), chooser = you.indexOf(s.challengerId);
  s = await act(chooser, 'CHALLENGE', {opponent: s.eligibleOpponentIds[0]});
  for (let i = 0; i < 3; i++) await act(i, 'DUEL_READY');
  for (let i = 0; i < 100 && s.duel?.status !== 'running'; i++) { await sleep(100); s = await state(0); }
  assert.equal(s.duel.status, 'running');
  const judge = you.indexOf(s.duel.adminId), turn = s.duel.turn;
  assert.ok(!s.duel.ids.includes(s.duel.adminId), 'judge is never a contestant');
  const judged = await state(judge), other = await state(you.indexOf(turn));
  assert.ok(judged.duel.answer, 'judge sees the answer');
  assert.equal('answer' in other.duel, false, 'contestant does not see the answer');
  s = await act(judge, 'ANSWER', {kind: 'good', questionKey: judged.duel.questionKey});
  assert.ok(s.players.find(p => p.id === turn).points >= 1);
  assert.notEqual(s.duel.turn, turn);
  console.log('PASS lobby → duel → judged answer, answer hidden from contestants.');
  streams.forEach(p => p.then(r => r.body?.cancel()).catch(() => {}));
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  proc.kill();
  await rm(dir, {recursive: true, force: true});
}
