const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'sw.js'), 'utf8');
const BASE = 'https://example.github.io/RodBot/';
const CURRENT = source.match(/const CACHE = '([^']+)'/)[1];
const ASSETS = 'rodbot-assets-v1';

function harness() {
  const handlers = {};
  const stores = new Map();
  const network = new Map();
  const deleted = [];
  const precached = [];
  const networkCalls = [];
  let claimed = false;
  let skipped = false;
  let storageFails = false;
  const keyOf = (key) => new URL(typeof key === 'string' ? key : key.url, BASE).href;
  const getStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const caches = {
    async open(name) {
      if (storageFails) throw new Error('Storage unavailable');
      const store = getStore(name);
      return {
        async match(key, options) {
          let response = store.get(keyOf(key));
          if (!response && options?.ignoreSearch) {
            const clean = (value) => { const url = new URL(value); url.search = ''; return url.href; };
            const entry = [...store].find(([stored]) => clean(stored) === clean(keyOf(key)));
            response = entry?.[1];
          }
          return response?.clone();
        },
        async put(key, response) { store.set(keyOf(key), response.clone()); },
        async addAll(keys) {
          for (const key of keys) {
            precached.push(keyOf(key));
            store.set(keyOf(key), new Response(`core:${key}`));
          }
        }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
    async match() { throw new Error('Cross-cache lookup is forbidden'); }
  };
  const self = {
    location: new URL('sw.js', BASE),
    clients: { async claim() { claimed = true; } },
    async skipWaiting() { skipped = true; },
    addEventListener(name, handler) { handlers[name] = handler; }
  };
  vm.runInNewContext(source, {
    self, caches, URL, Response,
    fetch: async (request) => {
      const key = keyOf(request);
      networkCalls.push(key);
      const response = network.get(key);
      if (!response) throw new Error('Offline');
      return response.clone();
    }
  }, { filename: 'sw.js' });
  return {
    stores, network, deleted, precached, networkCalls,
    get claimed() { return claimed; },
    get skipped() { return skipped; },
    failStorage() { storageFails = true; },
    seed(cache, path, body, options) {
      getStore(cache).set(keyOf(path), new Response(body, options));
    },
    async lifecycle(name) {
      const promises = [];
      handlers[name]({ waitUntil(value) { promises.push(value); } });
      await Promise.all(promises);
    },
    async message(data) {
      const promises = [];
      handlers.message({ data, waitUntil(value) { promises.push(value); } });
      await Promise.all(promises);
    },
    async request(path, { mode = 'cors', method = 'GET', headers = {} } = {}) {
      let promise;
      handlers.fetch({
        request: { url: keyOf(path), mode, method, headers: new Headers(headers) },
        respondWith(value) { promise = value; }
      });
      return promise ? await promise : undefined;
    }
  };
}

test('installation precaches the new stylesheet and activates', async () => {
  const h = harness();
  await h.lifecycle('install');
  assert.ok(h.precached.includes(BASE + 'interface.css'));
  assert.ok(h.precached.includes(BASE + 'interface.js'));
  assert.ok(h.precached.includes(BASE + 'app.js'));
  assert.equal(h.skipped, true);
});

test('activation deletes only old RodBot caches', async () => {
  const h = harness();
  for (const name of [CURRENT, ASSETS, 'rodbot-formation-v1.59.1', 'tms-v2.08', 'forage-v1', 'rodbot-model-3d']) {
    h.seed(name, './index.html', name);
  }
  await h.lifecycle('activate');
  assert.deepEqual(h.deleted, ['rodbot-formation-v1.59.1']);
  assert.equal(h.claimed, true);
  assert.equal(h.stores.size, 5);
});

test('3d controls and animations load offline immediately after installation', async () => {
  const h = harness();
  await h.lifecycle('install');
  for (const file of ['3d/css/viewer.css', '3d/js/viewer.js', '3d/js/motion.js', '3d/js/tour.js', '3d/js/hotspots.js']) {
    assert.ok(h.precached.includes(BASE + file), `${file} must be precached`);
    const response = await h.request(`${file}?v=1.61.0`);
    assert.equal(await response.text(), `core:./${file}`);
  }
});

test('versioned scripts, styles and manifest use their own precached resource offline', async () => {
  const h = harness();
  for (const file of ['app.js', 'interface.js', 'styles.css', 'interface.css', 'manifest.webmanifest']) {
    h.seed(CURRENT, file, `content:${file}`);
    const response = await h.request(`${file}?v=1.41.0`);
    assert.equal(await response.text(), `content:${file}`);
  }
});

test('offline scripts and styles never receive HTML or an older cache', async () => {
  const h = harness();
  h.seed(CURRENT, 'index.html', '<html>home</html>');
  h.seed('rodbot-formation-v1.40.0', 'app.js', 'old script');
  for (const file of ['app.js?v=1.41.0', 'interface.js?v=1.41.0', 'interface.css?v=1.41.0']) {
    const response = await h.request(file);
    assert.equal(response.type, 'error');
    assert.equal(response.status, 0);
  }
});

test('both home URLs fall back to their precached home offline', async () => {
  const h = harness();
  h.seed(CURRENT, 'index.html', 'home');
  for (const file of ['./', 'index.html?release=1.41.0']) {
    const response = await h.request(file, { mode: 'navigate' });
    assert.equal(await response.text(), 'home');
  }
});

test('3d and other pages preserve their own cached document', async () => {
  const h = harness();
  h.seed(CURRENT, 'index.html', 'home');
  h.seed(CURRENT, '3d/index.html', '3d scene');
  h.network.set(BASE + '3d/', new Response('new scene'));
  assert.equal(await (await h.request('3d/', { mode: 'navigate' })).text(), 'new scene');
  h.network.clear();
  assert.equal(await (await h.request('3d/', { mode: 'navigate' })).text(), 'new scene');
  assert.equal(await (await h.request('./', { mode: 'navigate' })).text(), 'home');
  for (const file of ['3d/other.html', 'missing.html']) {
    assert.equal((await h.request(file, { mode: 'navigate' })).type, 'error');
  }
});

test('successful versioned network responses update the canonical shell entry', async () => {
  const h = harness();
  h.seed(CURRENT, 'app.js', 'precache');
  h.network.set(BASE + 'app.js?v=1.41.0', new Response('fresh script'));
  assert.equal(await (await h.request('app.js?v=1.41.0')).text(), 'fresh script');
  h.network.clear();
  assert.equal(await (await h.request('app.js?v=other')).text(), 'fresh script');
});

test('HTTP errors never overwrite good shell entries or cache assets', async () => {
  const h = harness();
  h.seed(CURRENT, 'app.js', 'good script');
  h.network.set(BASE + 'app.js?v=1.41.0', new Response('failed', { status: 503 }));
  h.network.set(BASE + 'img/missing.jpg', new Response('missing', { status: 404 }));
  assert.equal((await h.request('app.js?v=1.41.0')).status, 503);
  assert.equal((await h.request('img/missing.jpg')).status, 404);
  h.network.clear();
  assert.equal(await (await h.request('app.js?v=1.41.0')).text(), 'good script');
  assert.equal((await h.request('img/missing.jpg')).type, 'error');
});

test('partial PDF responses are returned but not stored as a whole document', async () => {
  const h = harness();
  h.network.set(BASE + 'manual.pdf', new Response('partial', { status: 206 }));
  assert.equal((await h.request('manual.pdf')).status, 206);
  h.network.clear();
  assert.equal((await h.request('manual.pdf')).type, 'error');
});

test('asset lookup stays within the stable RodBot content cache', async () => {
  const h = harness();
  h.seed('other-site', 'img/photo.jpg', 'foreign cached photo');
  h.network.set(BASE + 'img/photo.jpg', new Response('RodBot photo'));
  assert.equal(await (await h.request('img/photo.jpg')).text(), 'RodBot photo');
  h.network.clear();
  assert.equal(await (await h.request('img/photo.jpg')).text(), 'RodBot photo');
  assert.equal(h.networkCalls.length, 1);
  assert.equal(h.stores.get(ASSETS).has(BASE + 'img/photo.jpg'), true);
});

test('POST, external origins and other GitHub projects are not intercepted', async () => {
  const h = harness();
  assert.equal(await h.request('submit', { method: 'POST' }), undefined);
  assert.equal(await h.request('https://worker.example/submit'), undefined);
  assert.equal(await h.request('https://example.github.io/TMS/app.js'), undefined);
  assert.equal(await h.request('https://example.github.io/RodBot-other/app.js'), undefined);
  assert.equal(h.networkCalls.length, 0);
});

test('storage failure does not discard a successful network response', async () => {
  const h = harness();
  h.failStorage();
  for (const file of ['app.js?v=1.41.0', 'img/photo.jpg']) {
    h.network.set(BASE + file, new Response(`network:${file}`));
    assert.equal(await (await h.request(file)).text(), `network:${file}`);
  }
});

test('3d entry and viewer scripts work offline immediately after core installation', async () => {
  const h = harness();
  await h.lifecycle('install');
  for (const path of ['3d/', '3d/index.html?embedded=1']) {
    assert.equal(await (await h.request(path, { mode: 'navigate' })).text(), 'core:./3d/index.html');
  }
  assert.equal(await (await h.request('3d/js/viewer.js?v=1.60.0')).text(), 'core:./3d/js/viewer.js');
  assert.equal((await h.request('3d/js/missing.js')).type, 'error');
});

test('stable assets survive activation and are not downloaded again', async () => {
  const h = harness();
  h.seed(ASSETS, 'manuel-operateur.pdf', 'saved manual');
  await h.lifecycle('activate');
  assert.equal(await (await h.request('manuel-operateur.pdf?v=1.60.0')).text(), 'saved manual');
  assert.equal(h.networkCalls.includes(BASE + 'manuel-operateur.pdf'), false);
});

test('complete precache continues after errors and PRECACHE messages retry missing files', async () => {
  const h = harness();
  h.network.set(BASE + 'manuel-operateur.pdf', new Response('FR manual'));
  await h.lifecycle('activate');
  assert.equal(await (await h.request('manuel-operateur.pdf')).text(), 'FR manual');
  h.network.set(BASE + 'manual-en.pdf', new Response('EN manual'));
  await h.message({ type: 'PRECACHE' });
  assert.equal(await (await h.request('manual-en.pdf')).text(), 'EN manual');
  assert.equal(h.networkCalls.filter((url) => url === BASE + 'manuel-operateur.pdf').length, 1);
  assert.equal(h.networkCalls.filter((url) => url === BASE + 'manual-en.pdf').length, 2);
});

test('offline video range requests use the complete stable cached resource', async () => {
  const h = harness();
  h.seed(ASSETS, '3d/assets/videos/hero_rodbot.mp4', '0123456789', { headers: { 'Content-Type': 'video/mp4' } });
  const response = await h.request('3d/assets/videos/hero_rodbot.mp4', { headers: { Range: 'bytes=2-5' } });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), '2345');
  assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
  assert.equal(h.networkCalls.length, 0);
});

test('fonts and the 3d CDN stay offline-ready without caching employee API responses', async () => {
  const h = harness();
  const engine = 'https://cdn.jsdelivr.net/npm/playcanvas@2.13.3/build/playcanvas.mjs';
  const font = 'https://fonts.googleapis.com/css2?family=Heebo&display=swap';
  h.network.set(engine, new Response('3d engine'));
  h.network.set(font, new Response('Heebo CSS'));
  for (const url of [engine, font]) assert.equal((await h.request(url)).status, 200);
  h.network.clear();
  assert.equal(await (await h.request(engine)).text(), '3d engine');
  assert.equal(await (await h.request(font)).text(), 'Heebo CSS');
  assert.equal((await h.request('https://fonts.googleapis.com/css2?family=Other')).type, 'error');
  assert.equal(await h.request('https://attestations-rodbot.frankyray-21.workers.dev?q=Alice'), undefined);
  assert.equal(await h.request('https://example.github.io/TMS/app.js'), undefined);
});
