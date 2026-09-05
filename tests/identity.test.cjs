const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'app.js'), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness() {
  const storage = new Map();
  const timers = new Map();
  const requests = [];
  const events = {};
  let timerId = 0;
  let renderedSuggestions = 0;
  const localStorage = {
    get length() { return storage.size; },
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    key(index) { return [...storage.keys()][index] ?? null; }
  };
  const document = {
    hidden: false, readyState: 'loading',
    addEventListener(name, callback) { events[name] = callback; },
    getElementById() { return null; },
    querySelectorAll() { return []; }
  };
  const context = vm.createContext({
    console, Date, localStorage, document, navigator: { onLine: true },
    window: { addEventListener() {}, scrollTo() {} },
    setTimeout(callback, ms) {
      const id = ++timerId;
      timers.set(id, { callback, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      return new Promise((resolve, reject) => requests.push({
        url, options,
        resolve(data) { resolve({ json: async () => data }); },
        reject() { reject(new Error('Mock network failure')); }
      }));
    }
  });
  vm.runInContext(source, context, { filename: 'app.js' });
  vm.runInContext('fullRender=function(){}; softRender=function(){}; COMP=new Component({});', context);
  const app = context.COMP;
  app.renderSuggestionsUI = () => { renderedSuggestions += 1; };
  app.sigDataUrl = () => 'data:image/png;base64,mock-signature';
  return {
    app, context, storage, timers, requests, events, localStorage,
    get renderedSuggestions() { return renderedSuggestions; },
    runDelay(ms) {
      for (const [id, timer] of [...timers]) {
        if (timer.ms === ms) { timers.delete(id); timer.callback(); }
      }
    },
    identify(name = 'Alice', id = 'alice-id') {
      app.state.name = name;
      app.state.attEmpId = id;
    },
    answerModule() {
      Object.assign(app.state, {
        view: 'quiz', activeId: 2, openKey: '2-1', graded: true,
        qIdx: 4, qSel: 1, qChecked: true, qResults: [true, true, false, true, true],
        lastScore: 80, lastPassed: true, completed: { 2: { score: 80 } }, attempts: { 2: 80 }
      });
      app.sigStrokes = [[...Array(8)].map((_, i) => ({ x: i, y: i }))];
    }
  };
}

test('clearing identity resets the local assessment, signature, clocks and view', () => {
  const h = harness();
  h.identify(); h.answerModule();
  Object.assign(h.app.state, {
    mpage: 12, imgView: { src: 'photo' }, manualDetailKey: '2-1',
    attRemind: true, attDone: true, attLinked: true, attSending: true,
    attError: 'previous error', rrcInfoOpen: true, showInstallHelp: true,
    suiviHist: [{ name: 'Alice' }], suiviHistState: 'ok',
    qbFb: { '2-1': { vote: 'down' } }, qbCommentKey: '2-1', qbComment: 'private feedback'
  });
  h.app._attRemindAction = () => assert.fail('Old action must not be called');
  vm.runInContext('ptEnter(2,"quiz")', h.context);
  for (const key of ['rodbot_formation_v3', 'rodbot_prog_dirty', 'rodbot_prog_pull_t', 'rodbot_reprise_v1', 'rodbot_pt_page_0', 'rodbot_pt_quiz_7']) {
    h.storage.set(key, 'old');
  }
  for (const key of ['rodbot_lang', 'rodbot_tour_done', 'tms_progress', 'other-site']) h.storage.set(key, 'keep');
  h.app.clearIdentity();
  const state = plain(h.app.state);
  assert.equal(state.view, 'home');
  assert.equal(state.activeId, null);
  for (const key of ['name', 'attEmpId', 'attError', 'qbComment', 'suiviHistState']) assert.equal(state[key], '');
  for (const key of ['graded', 'qChecked', 'lastPassed', 'attDone', 'attLinked', 'attSending', 'attRemind', 'rrcInfoOpen', 'showInstallHelp']) assert.equal(state[key], false);
  for (const key of ['openKey', 'manualDetailKey', 'mpage', 'imgView', 'qSel', 'qbCommentKey', 'suiviHist']) assert.equal(state[key], null);
  for (const key of ['completed', 'attempts', 'answers', 'qbFb']) assert.deepEqual(state[key], {});
  assert.deepEqual(state.qResults, []);
  assert.equal(state.lastScore, 0);
  assert.equal(state.qIdx, 0);
  assert.deepEqual(plain(h.app.sigStrokes), []);
  assert.equal(h.app._attRemindAction, null);
  assert.deepEqual(plain(h.context.PT), { pid: null, page: null, quiz: null });
  h.runDelay(600);
  vm.runInContext('ptFlush()', h.context);
  assert.deepEqual([...h.storage.keys()].sort(), ['other-site', 'rodbot_lang', 'rodbot_tour_done', 'tms_progress']);
  assert.equal(h.requests.length, 0);
});

test('clearing identity cancels pending suggestions, history and progress timers', () => {
  const h = harness();
  h.identify(); h.answerModule();
  h.app.state.view = 'suivi';
  h.app.setName({ target: { value: 'Alice new' } });
  h.app.progPushSoon();
  h.app.clearIdentity();
  h.runDelay(250); h.runDelay(700); h.runDelay(4000);
  assert.equal(h.requests.length, 0);
});

test('stale suggestions cannot reappear after clearing and choosing the same name', async () => {
  const h = harness();
  h.identify();
  h.app.fetchEmpSuggestions('Alice'); h.runDelay(250);
  assert.equal(h.requests.length, 1);
  h.app.clearIdentity(); h.identify();
  h.requests[0].resolve({ ok: true, results: [{ name: 'Alice', id: 'alice-id' }] });
  await flush();
  assert.deepEqual(plain(h.app.state.attSug), []);
  assert.equal(h.renderedSuggestions, 0);
});

test('suggestions use only the latest query, including when the name is erased', async () => {
  const h = harness();
  h.app.setName({ target: { value: 'Alice' } }); h.runDelay(250);
  h.app.setName({ target: { value: 'Alina' } }); h.runDelay(250);
  h.requests[1].resolve({ ok: true, results: [{ name: 'Alina', id: 'alina-id' }] });
  await flush();
  h.requests[0].resolve({ ok: true, results: [{ name: 'Alice', id: 'alice-id' }] });
  await flush();
  assert.equal(h.app.state.attSug[0].name, 'Alina');
  h.app.fetchEmpSuggestions('Alina'); h.runDelay(250);
  h.app.setName({ target: { value: '' } });
  h.requests[2].resolve({ ok: true, results: [{ name: 'Alina', id: 'alina-id' }] });
  await flush();
  assert.deepEqual(plain(h.app.state.attSug), []);
});

test('stale progress pull cannot restore another session or write its pull timestamp', async () => {
  const h = harness();
  h.identify();
  h.app.progPullNow(true);
  h.app.clearIdentity(); h.identify('Bob', 'bob-id');
  h.requests[0].resolve({ ok: true, progress: { pq: { 2: { s: 100, done: true } } } });
  await flush();
  assert.deepEqual(plain(h.app.state.completed), {});
  assert.equal(h.storage.has('rodbot_prog_pull_t'), false);
});

test('current progress pull still merges scores without changing the backend contract', async () => {
  const h = harness();
  h.identify(); h.app.progPullNow(true);
  assert.match(h.requests[0].url, /\?progress=Alice$/);
  h.requests[0].resolve({ ok: true, progress: { pq: { 2: { s: 80, done: true } } } });
  await flush();
  assert.equal(h.app.state.completed[2].score, 80);
  assert.equal(h.storage.has('rodbot_prog_pull_t'), true);
});

test('old push success cannot clear the new identity pending marker', async () => {
  const h = harness();
  h.identify(); h.answerModule(); h.app.progPush();
  const payload = JSON.parse(h.requests[0].options.body);
  assert.deepEqual(payload, { type: 'progress', name: 'Alice', data: { v: 1, pq: { 2: { s: 80, done: true } } } });
  h.app.clearIdentity(); h.identify('Bob', 'bob-id'); h.storage.set('rodbot_prog_dirty', '1');
  h.requests[0].resolve({ ok: true });
  await flush();
  assert.equal(h.storage.get('rodbot_prog_dirty'), '1');
});

test('old push failure cannot recreate a cleared pending marker', async () => {
  const h = harness();
  h.identify(); h.answerModule(); h.app.progPush();
  h.app.clearIdentity(); h.requests[0].reject();
  await flush();
  assert.equal(h.storage.has('rodbot_prog_dirty'), false);
});

test('current push success and failure retain their original behavior', async () => {
  const h = harness();
  h.identify(); h.answerModule(); h.storage.set('rodbot_prog_dirty', '1');
  h.app.progPush(); h.requests[0].resolve({ ok: true }); await flush();
  assert.equal(h.storage.has('rodbot_prog_dirty'), false);
  h.app.progPush(); h.requests[1].reject(); await flush();
  assert.equal(h.storage.get('rodbot_prog_dirty'), '1');
});

test('old history success or failure cannot affect a new identity', async () => {
  for (const fail of [false, true]) {
    const h = harness(); h.identify(); h.app.fetchSuiviHist();
    h.app.clearIdentity(); h.identify('Bob', 'bob-id');
    if (fail) h.requests[0].reject();
    else h.requests[0].resolve({ ok: true, results: [{ name: 'Alice' }], progress: { pq: { 1: { s: 100, done: true } } } });
    await flush();
    assert.equal(h.app.state.suiviHist, null);
    assert.equal(h.app.state.suiviHistState, '');
    assert.deepEqual(plain(h.app.state.completed), {});
  }
});

test('current history still renders its response', async () => {
  const h = harness(); h.identify(); h.app.fetchSuiviHist();
  h.requests[0].resolve({ ok: true, results: [{ module: '02' }] }); await flush();
  assert.equal(h.app.state.suiviHistState, 'ok');
  assert.equal(h.app.state.suiviHist[0].module, '02');
});

test('old attestation success, refusal and error cannot clear the new signature or show a receipt', async () => {
  for (const outcome of ['success', 'refused', 'error']) {
    const h = harness(); h.identify(); h.answerModule();
    h.app.postAttestation({ module: '03', score: '80 %' });
    const payload = JSON.parse(h.requests[0].options.body);
    assert.equal(payload.name, 'Alice'); assert.equal(payload.employeeId, 'alice-id');
    assert.equal(payload.signature, 'data:image/png;base64,mock-signature');
    assert.equal(payload.module, '03'); assert.equal(payload.score, '80 %');
    h.app.clearIdentity(); h.identify('Bob', 'bob-id'); h.answerModule();
    if (outcome === 'error') h.requests[0].reject();
    else h.requests[0].resolve(outcome === 'success' ? { ok: true, linked: true } : { ok: false, error: 'Refused Alice' });
    await flush();
    assert.equal(h.app.state.attDone, false);
    assert.equal(h.app.state.attLinked, false);
    assert.equal(h.app.state.attError, '');
    assert.equal(h.app.sigStrokes[0].length, 8);
  }
});

test('current attestation response still records success and clears its signature', async () => {
  const h = harness(); h.identify(); h.answerModule();
  h.app.postAttestation({ module: '03', score: '80 %' });
  h.requests[0].resolve({ ok: true, linked: true }); await flush();
  assert.equal(h.app.state.attDone, true);
  assert.equal(h.app.state.attLinked, true);
  assert.equal(h.app.state.attSending, false);
  assert.deepEqual(plain(h.app.sigStrokes), []);
});

test('an attestation response from a previous screen cannot mark another module as sent', async () => {
  const h = harness(); h.identify(); h.answerModule();
  h.app.postAttestation({ module: '03', score: '80 %' });
  h.app.openModule(4);
  h.requests[0].resolve({ ok: true, linked: true }); await flush();
  assert.equal(h.app.state.activeId, 4);
  assert.equal(h.app.state.attDone, false);
});

test('name editing invalidates old requests and signature but preserves the anonymous quiz', async () => {
  const h = harness(); h.answerModule();
  h.app.setName({ target: { value: 'Alice' } });
  h.app.progPullNow(true);
  h.app.setName({ target: { value: 'Bob' } });
  h.requests[0].resolve({ ok: true, progress: { pq: { 1: { s: 100, done: true } } } }); await flush();
  assert.equal(h.app.state.name, 'Bob');
  assert.equal(h.app.state.lastScore, 80);
  assert.equal(h.app.state.completed[2].score, 80);
  assert.equal(h.app.state.completed[1], undefined);
  assert.deepEqual(plain(h.app.sigStrokes), []);
});

test('selecting an employee invalidates previous identity responses and starts a fresh pull', async () => {
  const h = harness(); h.identify(); h.answerModule(); h.app.progPullNow(true);
  h.app.pickSuggestion({ name: 'Bob', id: 'bob-id' });
  assert.equal(h.requests.length, 2);
  assert.match(h.requests[1].url, /\?progress=Bob$/);
  h.requests[0].resolve({ ok: true, progress: { pq: { 1: { s: 100, done: true } } } }); await flush();
  assert.equal(h.app.state.name, 'Bob');
  assert.equal(h.app.state.completed[1], undefined);
  assert.deepEqual(plain(h.app.sigStrokes), []);
});
