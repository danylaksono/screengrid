// map-pool.js — a bounded pool of live MapLibre instances.
//
// The atlas and the failure gallery both put dozens of small maps on one page.
// Each MapLibre instance holds a WebGL context, and browsers cap those at around
// sixteen: past the limit the oldest context is silently killed and its map goes
// blank while its canvas element stays in the DOM. (That failure is invisible to
// a DOM check and obvious on screen, which is a good argument for looking at the
// page you built.)
//
// So maps are built when their container scrolls into view and torn down when
// they scroll out and the pool is over budget. Rebuilding is cheap because the
// spec — not the map object — is the source of truth.

/**
 * Create a scroll-driven pool of maps.
 *
 * @param {Object} options
 * @param {number} [options.maxLive=6] - live map budget, well under the browser cap
 * @param {string} [options.rootMargin='250px'] - how early to build a map
 * @param {Function} options.create - (container) => maplibregl.Map, called to build one
 * @param {Function} [options.onEvict] - (container) => void, after a map is removed
 * @returns {{observe: Function, disconnect: Function, liveCount: Function}}
 */
export function createMapPool({ maxLive = 6, rootMargin = '250px', create, onEvict } = {}) {
  if (typeof create !== 'function') throw new Error('createMapPool: `create` is required');

  const live = new Map(); // container element -> { map, visible, seq }
  let seq = 0;

  const observer = new IntersectionObserver((records) => {
    for (const record of records) {
      const container = record.target;
      const existing = live.get(container);
      if (record.isIntersecting) {
        if (existing) {
          existing.visible = true;
          existing.seq = seq++;
        } else {
          const map = create(container);
          if (map) live.set(container, { map, visible: true, seq: seq++ });
        }
      } else if (existing) {
        existing.visible = false;
      }
    }
    evict();
  }, { rootMargin });

  /** Tear down the least-recently-seen off-screen maps until inside budget. */
  function evict() {
    while (live.size > maxLive) {
      let oldest = null;
      let oldestSeq = Infinity;
      for (const [container, item] of live) {
        if (item.visible) continue;
        if (item.seq < oldestSeq) { oldestSeq = item.seq; oldest = container; }
      }
      if (!oldest) return; // everything is on screen; nothing to reclaim
      const item = live.get(oldest);
      live.delete(oldest);
      item.map.remove();
      oldest.innerHTML = '';
      if (onEvict) onEvict(oldest);
    }
  }

  return {
    observe: (element) => observer.observe(element),
    disconnect: () => observer.disconnect(),
    liveCount: () => live.size,
  };
}
