/**
 * PROTOTYPE — throwaway. Generative-mark engine for card variant D.
 *
 * Extracted out of `_CardsVariantD.astro` on purpose: this SVG-string-heavy
 * code (HTML-in-template-literals) tripped an Astro frontmatter-hoisting bug
 * that emitted the component frontmatter twice (duplicate `export interface
 * Props` → esbuild "Unexpected export"). As a plain .ts module it's compiled by
 * esbuild directly, so the bug can't occur — and the engine belongs in a module
 * anyway. Deterministic: same id always yields the same mark.
 */

/** FNV-1a — small, stable string -> uint32 hash (deterministic per id). */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — seeded PRNG so a mark redraws identically every build. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared defs + tile base (dark tile + radial hue glow + hairline ring). */
function wrap(gid: string, hue: string, inner: string): string {
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${gid}-bg" cx="34%" cy="26%" r="92%">
        <stop offset="0%" stop-color="${hue}" stop-opacity="0.32"/>
        <stop offset="55%" stop-color="${hue}" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="${hue}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${gid}-fg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${hue}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${hue}" stop-opacity="0.5"/>
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="94" height="94" rx="24" style="fill:var(--pl-tile)" stroke="${hue}" stroke-opacity="0.22" stroke-width="1.5"/>
    <rect x="3" y="3" width="94" height="94" rx="24" fill="url(#${gid}-bg)"/>
    ${inner}
  </svg>`;
}

/** Deterministic abstract emblem for a project (id picks the shape family). */
export function genMarkSvg(id: string, hue: string): string {
  const h = hashStr(id);
  const rnd = mulberry32(h);
  const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const f = (n: number) => Number(n.toFixed(1));
  const gid = `mkD-${id}`;
  const fg = `url(#${gid}-fg)`;
  const family = (h >>> 2) % 4;
  let body = '';

  if (family === 0) {
    // Orbits — concentric rings + open arcs around a solid core.
    const radii = [40, 29, 18];
    const rings = ri(2, 3);
    for (let i = 0; i < rings; i++) {
      const r = radii[i];
      const op = f(0.82 - i * 0.2);
      if (rnd() < 0.6) {
        const a0 = (ri(0, 11) * 30 * Math.PI) / 180;
        const sweep = (ri(7, 10) / 12) * 2 * Math.PI;
        const x1 = f(50 + r * Math.cos(a0));
        const y1 = f(50 + r * Math.sin(a0));
        const x2 = f(50 + r * Math.cos(a0 + sweep));
        const y2 = f(50 + r * Math.sin(a0 + sweep));
        const large = sweep > Math.PI ? 1 : 0;
        body += `<path d="M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${hue}" stroke-opacity="${op}" stroke-width="5" stroke-linecap="round"/>`;
      } else {
        body += `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${hue}" stroke-opacity="${op}" stroke-width="3.5"/>`;
      }
    }
    body += `<circle cx="50" cy="50" r="${ri(5, 8)}" fill="${fg}"/>`;
    return wrap(gid, hue, `<g>${body}</g>`);
  }

  if (family === 1) {
    // Field — constellation of dots on a jittered grid, lightly linked.
    const cols = 4;
    const lo = 20;
    const span = 60;
    const step = span / (cols - 1);
    const cells: [number, number][] = [];
    for (let x = 0; x < cols; x++) for (let y = 0; y < cols; y++) cells.push([x, y]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const n = ri(4, 6);
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const [gx, gy] = cells[i];
      pts.push([f(lo + gx * step + (rnd() - 0.5) * 9), f(lo + gy * step + (rnd() - 0.5) * 9)]);
    }
    for (let i = 0; i < pts.length - 1 && i < 3; i++) {
      body += `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${pts[i + 1][0]}" y2="${pts[i + 1][1]}" stroke="${hue}" stroke-opacity="0.28" stroke-width="1.5"/>`;
    }
    pts.forEach((p, i) => {
      const hero = i === 0;
      const r = hero ? ri(7, 9) : ri(3, 5);
      const fill = hero ? fg : hue;
      const op = hero ? 1 : f(0.5 + rnd() * 0.4);
      body += `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${fill}" fill-opacity="${op}"/>`;
    });
    const rot = [0, 90, 180, 270][(h >>> 4) % 4];
    return wrap(gid, hue, `<g transform="rotate(${rot} 50 50)">${body}</g>`);
  }

  if (family === 2) {
    // Strata — equalizer bars rising from a baseline (rotates to horizontal).
    const n = ri(4, 5);
    const x0 = 18;
    const span = 64;
    const gap = span / n;
    const bw = gap * 0.5;
    for (let i = 0; i < n; i++) {
      const hgt = ri(20, 58);
      const x = f(x0 + i * gap + (gap - bw) / 2);
      const y = f(82 - hgt);
      const op = f(0.45 + rnd() * 0.5);
      const fill = rnd() < 0.4 ? fg : hue;
      body += `<rect x="${x}" y="${y}" width="${f(bw)}" height="${hgt}" rx="${f(bw / 2)}" fill="${fill}" fill-opacity="${op}"/>`;
    }
    const rot = (h >>> 4) % 2 ? 90 : 0;
    return wrap(gid, hue, `<g transform="rotate(${rot} 50 50)">${body}</g>`);
  }

  // family === 3: Facets — a faceted diamond gem (4 triangles to centre).
  const v = {
    t: [50, 16],
    r: [84, 50],
    b: [50, 84],
    l: [16, 50],
    c: [50, 50],
  };
  const tris = [
    [v.t, v.r],
    [v.r, v.b],
    [v.b, v.l],
    [v.l, v.t],
  ];
  const heroIdx = (h >>> 3) % 4;
  tris.forEach((tr, i) => {
    const op = i === heroIdx ? 1 : f(0.38 + ((i * 7 + (h >>> 2)) % 5) / 10);
    const fill = i === heroIdx ? fg : hue;
    body += `<polygon points="${tr[0].join(',')} ${tr[1].join(',')} ${v.c.join(',')}" fill="${fill}" fill-opacity="${op}"/>`;
  });
  const rot = [0, 45, 90, 135][(h >>> 4) % 4];
  return wrap(gid, hue, `<g transform="rotate(${rot} 50 50)">${body}</g>`);
}
