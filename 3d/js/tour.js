/** Sequential camera visits. The caller owns camera cancellation and visibility. */
export function createTour({ visit, count, onChange = () => {}, dwell = 6000 }) {
  let status = 'idle';
  let index = 0;
  let generation = 0;
  let timer = null;
  let destroyed = false;
  const delay = Number.isFinite(dwell) ? Math.max(0, dwell) : 6000;

  function total() {
    const value = Number(count());
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function getState() {
    return { status, index, total: total() };
  }

  function invalidate() {
    generation += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    return generation;
  }

  function notify() {
    onChange(getState());
  }

  function complete() {
    invalidate();
    status = 'complete';
    notify();
    return getState();
  }

  async function arrive(token) {
    let arrived = false;
    try {
      arrived = await visit(index);
    } catch {
      // A failed camera visit must never silently advance the tour.
    }
    if (destroyed || token !== generation) return;
    if (arrived !== true) {
      if (status === 'playing') {
        status = 'paused';
        notify();
      }
      return;
    }
    if (status !== 'playing') return;
    timer = setTimeout(() => {
      timer = null;
      if (destroyed || token !== generation || status !== 'playing') return;
      if (index + 1 >= total()) complete();
      else activate(index + 1, 'playing');
    }, delay);
  }

  function activate(target, mode) {
    if (destroyed) return getState();
    const token = invalidate();
    const length = total();
    const requested = Number.isFinite(target) ? Math.trunc(target) : 0;
    index = length ? Math.max(0, Math.min(requested, length - 1)) : 0;
    status = length ? mode : 'complete';
    notify();
    // onChange can synchronously pause, stop, or restart the tour.
    if (length && !destroyed && token === generation) void arrive(token);
    return getState();
  }

  function start(target = 0) {
    return activate(target, 'playing');
  }

  function pause() {
    if (!destroyed && status === 'playing') {
      invalidate();
      status = 'paused';
      notify();
    }
    return getState();
  }

  function resume() {
    // Revisiting also handles a flight interrupted while entering this step.
    return !destroyed && status === 'paused'
      ? activate(index, 'playing') : getState();
  }

  function stop() {
    if (!destroyed) {
      invalidate();
      status = 'idle';
      index = 0;
      notify();
    }
    return getState();
  }

  function next() {
    if (destroyed) return getState();
    if (status === 'playing' && index + 1 >= total()) return complete();
    return activate(index + 1, status === 'playing' ? 'playing' : 'paused');
  }

  function previous() {
    return activate(index - 1, status === 'playing' ? 'playing' : 'paused');
  }

  function destroy() {
    invalidate();
    destroyed = true;
    status = 'idle';
    index = 0;
  }

  return { start, pause, resume, stop, next, previous, getState, destroy };
}
