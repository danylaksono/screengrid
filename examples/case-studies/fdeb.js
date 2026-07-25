// fdeb.js — Force-Directed Edge Bundling (Holten & van Wijk, 2009), a compact
// self-contained port. `bundleEdges(edges, opts)` treats each edge as a straight
// segment {x0,y0,x1,y1}, iteratively attracts *compatible* edges toward each
// other, and writes the resulting bundled polyline to `edge.points` (an array of
// {x,y} including the fixed endpoints). Edges are mutated in place and returned.
//
// It is intentionally "simple": angle/scale/position/visibility compatibility
// (the four Holten criteria), progressive subdivision, and a plain
// spring + electrostatic force model. No spatial index — keep the edge count
// bounded (a few hundred) by thresholding weak flows before calling.

const DEFAULTS = {
  K: 0.1,               // global spring constant
  cycles: 6,            // subdivision cycles
  iterations: 90,       // force iterations in the first cycle
  iterationRate: 2 / 3, // iterations shrink each cycle
  step: 0.1,            // initial step size (px per unit force); halves each cycle
  subdivisions: 1,      // interior subdivision points in the first cycle
  subdivisionRate: 2,   // subdivisions grow each cycle
  compatibility: 0.6,   // compatibility threshold [0,1]
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const edgeLen = (e) => Math.hypot(e.x1 - e.x0, e.y1 - e.y0) || 1e-6;

export function bundleEdges(edges, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const E = edges.filter((e) => edgeLen(e) > 1);
  for (const e of E) e.points = [{ x: e.x0, y: e.y0 }, { x: e.x1, y: e.y1 }];
  if (E.length === 0) return edges;

  const compat = computeCompatibility(E, o.compatibility);

  let P = o.subdivisions;
  let iterations = o.iterations;
  let step = o.step;
  for (let c = 0; c < o.cycles; c++) {
    for (const e of E) e.points = resample(e.points, P + 2);
    for (let it = 0; it < iterations; it++) {
      applyForces(E, compat, P, o.K, step);
    }
    P = Math.round(P * o.subdivisionRate);
    step *= 0.5;
    iterations = Math.max(6, Math.round(iterations * o.iterationRate));
  }
  return edges;
}

function applyForces(E, compat, P, K, step) {
  for (let ei = 0; ei < E.length; ei++) {
    const e = E[ei];
    const pts = e.points;
    const kp = K / (edgeLen(e) * (P + 1)); // spring constant scaled by edge length
    const list = compat[ei];
    const moves = new Array(P);
    for (let i = 1; i <= P; i++) {
      const p = pts[i];
      // Spring force from the two neighbours on the same edge.
      let fx = kp * ((pts[i - 1].x - p.x) + (pts[i + 1].x - p.x));
      let fy = kp * ((pts[i - 1].y - p.y) + (pts[i + 1].y - p.y));
      // Electrostatic attraction from the matching point of compatible edges.
      for (let k = 0; k < list.length; k++) {
        const q = E[list[k].j].points[list[k].flip ? (P + 1 - i) : i];
        const dx = q.x - p.x, dy = q.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-4) { fx += dx / d; fy += dy / d; }
      }
      moves[i - 1] = { x: fx, y: fy };
    }
    for (let i = 1; i <= P; i++) { pts[i].x += step * moves[i - 1].x; pts[i].y += step * moves[i - 1].y; }
  }
}

// Resample a polyline to exactly `count` points, evenly by arc length, endpoints fixed.
function resample(pts, count) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out = [];
  if (total < 1e-6) { for (let k = 0; k < count; k++) out.push({ x: pts[0].x, y: pts[0].y }); return out; }
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const segLen = (cum[i] - cum[i - 1]) || 1e-9;
    const t = (target - cum[i - 1]) / segLen;
    out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
  }
  return out;
}

// Pairwise compatibility (angle · scale · position · visibility); returns, per
// edge, the list of compatible edges { j, flip } (flip = antiparallel).
function computeCompatibility(E, thresh) {
  const n = E.length;
  const compat = Array.from({ length: n }, () => []);
  const meta = E.map((e) => ({
    vx: e.x1 - e.x0, vy: e.y1 - e.y0, l: edgeLen(e),
    mid: { x: (e.x0 + e.x1) / 2, y: (e.y0 + e.y1) / 2 },
  }));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = meta[i], B = meta[j];
      const dot = A.vx * B.vx + A.vy * B.vy;
      const Ca = Math.abs(dot / (A.l * B.l));
      const lavg = (A.l + B.l) / 2;
      const Cs = 2 / (lavg / Math.min(A.l, B.l) + Math.max(A.l, B.l) / lavg);
      const Cp = lavg / (lavg + dist(A.mid, B.mid));
      const Cv = visibilityCompat(E[i], E[j]);
      if (Ca * Cs * Cp * Cv >= thresh) {
        const flip = dot < 0;
        compat[i].push({ j, flip });
        compat[j].push({ j: i, flip });
      }
    }
  }
  return compat;
}

function projectOnLine(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / ((abx * abx + aby * aby) || 1e-9);
  return { x: a.x + abx * t, y: a.y + aby * t };
}
function edgeVisibility(P, Q) {
  const a = { x: P.x0, y: P.y0 }, b = { x: P.x1, y: P.y1 };
  const I0 = projectOnLine({ x: Q.x0, y: Q.y0 }, a, b);
  const I1 = projectOnLine({ x: Q.x1, y: Q.y1 }, a, b);
  const Im = { x: (I0.x + I1.x) / 2, y: (I0.y + I1.y) / 2 };
  const Pm = { x: (P.x0 + P.x1) / 2, y: (P.y0 + P.y1) / 2 };
  const dI = dist(I0, I1) || 1e-9;
  return Math.max(0, 1 - (2 * dist(Pm, Im)) / dI);
}
function visibilityCompat(P, Q) {
  return Math.min(edgeVisibility(P, Q), edgeVisibility(Q, P));
}
