const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, '..', '3d', 'js', 'tour.js'), 'utf8');
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function harness(t, options = {}) {
  const { createTour } = await modulePromise;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const visits = [];
  const states = [];
  const tour = createTour({
    count: () => 3,
    dwell: 6000,
    onChange: (state) => states.push(state),
    visit: async (index) => { visits.push(index); return true; },
    ...options
  });
  t.after(() => tour.destroy());
  return { tour, visits, states };
}

test('visits each step, waits after arrival, and completes after the last dwell', async (t) => {
  const first = deferred();
  const calls = [];
  const { tour } = await harness(t, {
    count: () => 2,
    visit: (index) => { calls.push(index); return calls.length === 1 ? first.promise : true; }
  });
  assert.deepEqual(tour.getState(), { status: 'idle', index: 0, total: 2 });
  tour.start();
  t.mock.timers.tick(30000);
  await flush();
  assert.deepEqual(calls, [0], 'flight time does not consume the reading time');
  first.resolve(true);
  await flush();
  t.mock.timers.tick(5999);
  assert.deepEqual(calls, [0]);
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(calls, [0, 1]);
  t.mock.timers.tick(6000);
  assert.deepEqual(tour.getState(), { status: 'complete', index: 1, total: 2 });
  t.mock.timers.tick(60000);
  assert.deepEqual(calls, [0, 1]);
});

test('stop/start ignores the old flight even when it resolves after the new flight', async (t) => {
  const flights = [];
  const { tour } = await harness(t, {
    visit: (index) => { const flight = deferred(); flights.push({ index, ...flight }); return flight.promise; }
  });
  tour.start(2);
  tour.stop();
  tour.start();
  assert.deepEqual(flights.map((flight) => flight.index), [2, 0]);
  flights[1].resolve(true);
  await flush();
  t.mock.timers.tick(1000);
  flights[0].resolve(true);
  await flush();
  t.mock.timers.tick(5000);
  assert.deepEqual(flights.map((flight) => flight.index), [2, 0, 1]);
  t.mock.timers.tick(1000);
  assert.deepEqual(flights.map((flight) => flight.index), [2, 0, 1], 'old flight cannot schedule another advance');
});

test('stop/start cancels a pending reading timer and restarts at zero', async (t) => {
  const { tour, visits } = await harness(t);
  tour.start(1);
  await flush();
  t.mock.timers.tick(5999);
  tour.stop();
  assert.deepEqual(tour.getState(), { status: 'idle', index: 0, total: 3 });
  tour.start();
  await flush();
  t.mock.timers.tick(1);
  assert.deepEqual(visits, [1, 0]);
  t.mock.timers.tick(5999);
  assert.deepEqual(visits, [1, 0, 1]);
});

test('pause during a flight blocks advancement and resume revisits the same step', async (t) => {
  const flights = [];
  const { tour } = await harness(t, {
    visit: (index) => { const flight = deferred(); flights.push({ index, ...flight }); return flight.promise; }
  });
  tour.start(1);
  tour.pause();
  flights[0].resolve(true);
  await flush();
  t.mock.timers.tick(60000);
  assert.deepEqual(tour.getState(), { status: 'paused', index: 1, total: 3 });
  assert.equal(flights.length, 1);
  tour.resume();
  assert.deepEqual(flights.map((flight) => flight.index), [1, 1]);
  flights[1].resolve(true);
  await flush();
  t.mock.timers.tick(5999);
  assert.equal(flights.length, 2);
  t.mock.timers.tick(1);
  assert.deepEqual(flights.map((flight) => flight.index), [1, 1, 2]);
});

test('pause during reading cancels the old timer and gives a full dwell after resuming', async (t) => {
  const { tour, visits } = await harness(t);
  tour.start();
  await flush();
  t.mock.timers.tick(5000);
  tour.pause();
  t.mock.timers.tick(20000);
  assert.deepEqual(visits, [0]);
  tour.resume();
  await flush();
  t.mock.timers.tick(5999);
  assert.deepEqual(visits, [0, 0]);
  t.mock.timers.tick(1);
  assert.deepEqual(visits, [0, 0, 1]);
});

test('next and previous preserve playing or paused and invalidate pending visits', async (t) => {
  const oldFlight = deferred();
  const calls = [];
  const { tour } = await harness(t, {
    visit: (index) => { calls.push(index); return calls.length === 1 ? oldFlight.promise : true; }
  });
  tour.start();
  tour.next();
  await flush();
  oldFlight.resolve(false);
  await flush();
  assert.deepEqual(tour.getState(), { status: 'playing', index: 1, total: 3 });
  tour.previous();
  await flush();
  assert.deepEqual(tour.getState(), { status: 'playing', index: 0, total: 3 });
  tour.pause();
  tour.next();
  await flush();
  assert.deepEqual(tour.getState(), { status: 'paused', index: 1, total: 3 });
  tour.previous();
  await flush();
  t.mock.timers.tick(60000);
  assert.deepEqual(tour.getState(), { status: 'paused', index: 0, total: 3 });
  assert.deepEqual(calls, [0, 1, 0, 1, 0]);
});

test('a cancelled or rejected active flight pauses without advancing', async (t) => {
  let rejectVisit = false;
  const { tour } = await harness(t, {
    visit: async () => { if (rejectVisit) throw new Error('camera unavailable'); return false; }
  });
  tour.start();
  await flush();
  assert.equal(tour.getState().status, 'paused');
  rejectVisit = true;
  tour.resume();
  await flush();
  t.mock.timers.tick(60000);
  assert.deepEqual(tour.getState(), { status: 'paused', index: 0, total: 3 });
});

test('an empty tour completes without a camera call and explicit start indices are bounded', async (t) => {
  let length = 0;
  const { tour, visits } = await harness(t, { count: () => length });
  tour.start();
  assert.deepEqual(tour.getState(), { status: 'complete', index: 0, total: 0 });
  assert.deepEqual(visits, []);
  length = 2;
  tour.start(50);
  assert.deepEqual(tour.getState(), { status: 'playing', index: 1, total: 2 });
  tour.start(-4);
  assert.deepEqual(visits, [1, 0]);
});

test('destroy prevents later async work and calls from restarting the tour', async (t) => {
  const flight = deferred();
  const { tour, states } = await harness(t, { visit: () => flight.promise });
  tour.start();
  tour.destroy();
  const notifications = states.length;
  flight.resolve(true);
  await flush();
  t.mock.timers.tick(60000);
  tour.start();
  tour.resume();
  tour.next();
  tour.previous();
  tour.stop();
  assert.equal(states.length, notifications);
  assert.deepEqual(tour.getState(), { status: 'idle', index: 0, total: 3 });
});

test('onChange may synchronously stop a start before any camera visit begins', async (t) => {
  const { createTour } = await modulePromise;
  let calls = 0;
  const tour = createTour({
    count: () => 2,
    visit: async () => { calls++; return true; },
    onChange: (state) => { if (state.status === 'playing') tour.stop(); }
  });
  t.after(() => tour.destroy());
  tour.start();
  await flush();
  assert.equal(calls, 0);
  assert.equal(tour.getState().status, 'idle');
});
