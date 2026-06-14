/**
 * Build-time Open Graph image generation (#29). Renders branded 1200×630 cards
 * in the player visual language (dark bg, hue-tinted `sym` art tile, title,
 * status badge, byline) via satori (HTML/CSS → SVG) + @resvg/resvg-js (→ PNG).
 * Runs only inside the static `og/**.png.ts` endpoints, pre-rendered at build,
 * so output is static PNG files in `dist/` — no runtime endpoint. Colors mirror
 * `styles/player.css` (`:root` tokens + `.art` / `.badge.*`).
 */
import satori, { type SatoriOptions } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { StatusKind } from '../data/catalog';

/** Canonical OG image dimensions (constraint: 1200×630). */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** Player palette tokens, mirrored from `styles/player.css` `:root`. */
const BG = '#121317';
const PANEL = '#1c1e24';
const LINE = '#2a2c35';
const TEXT = '#e6e8ed';
const DIM = '#969aa6';
const FAINT = '#8a8fa0';

/** Badge fill/text per status kind, mirrored from `.badge.*` in player.css. */
const BADGE: Record<StatusKind, { bg: string; fg: string }> = {
  dry: { bg: 'rgba(230,180,80,0.12)', fg: '#e6b450' },
  live: { bg: 'rgba(80,200,120,0.12)', fg: '#50c878' },
  wip: { bg: 'rgba(139,124,246,0.14)', fg: '#8b7cf6' },
  done: { bg: 'rgba(150,154,166,0.10)', fg: '#969aa6' },
};

/** Inter weights satori needs, loaded once from the `@fontsource` WOFF files.
 *  Resolved through node's module resolution (not a path relative to this
 *  module) so it works both in dev and from the bundled build chunk. */
function loadFonts(): SatoriOptions['fonts'] {
  const require = createRequire(import.meta.url);
  const file = (weight: number) =>
    readFileSync(
      require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`),
    );
  return [
    { name: 'Inter', data: file(400), weight: 400, style: 'normal' },
    { name: 'Inter', data: file(600), weight: 600, style: 'normal' },
    { name: 'Inter', data: file(700), weight: 700, style: 'normal' },
    { name: 'Inter', data: file(800), weight: 800, style: 'normal' },
  ];
}

let FONTS: SatoriOptions['fonts'] | null = null;

/** Inputs for one OG card. */
export interface OgCard {
  /** Hero line, e.g. a project or track title. */
  title: string;
  /** Two-letter symbol shown on the art tile. */
  sym: string;
  /** Accent color (hex), tints the tile, accent bar, and corner glow. */
  hue: string;
  /** Eyebrow above the title, e.g. `Agents & MCP · 2026` or `The Journey`. */
  kind: string;
  /** Optional one-line tagline under the title. */
  tagline?: string;
  /** Optional status badge `[kind, label]`. */
  status?: [StatusKind, string];
}

/** A satori VDOM node (plain object form — no JSX runtime needed). */
type Node = {
  type: string;
  props: { style: Record<string, unknown>; children?: Node | Node[] | string };
};

function el(
  type: string,
  style: Record<string, unknown>,
  children?: Node | Node[] | string,
): Node {
  return { type, props: { style, children } };
}

const flex = { display: 'flex' } as const;

/** Build the satori VDOM for one card. */
function cardTree(card: OgCard): Node {
  const badge = card.status ? BADGE[card.status[0]] : null;

  // Art tile: rounded square with the `sym` and a hue accent bar (`.art`).
  const artTile = el(
    'div',
    { ...flex, position: 'relative', width: 200, height: 200, borderRadius: 24, background: PANEL, border: `1px solid ${LINE}`, alignItems: 'center', justifyContent: 'center', fontSize: 84, fontWeight: 700, color: card.hue, letterSpacing: -2, overflow: 'hidden' },
    [
      el('div', flex, card.sym),
      el('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: card.hue }),
    ],
  );

  const textChildren: Node[] = [
    el('div', { ...flex, fontSize: 26, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: DIM }, card.kind),
    el('div', { ...flex, fontSize: 76, fontWeight: 800, letterSpacing: -3, color: TEXT, lineHeight: 1.05 }, card.title),
  ];
  if (card.tagline) {
    textChildren.push(el('div', { ...flex, fontSize: 30, fontWeight: 400, color: DIM, lineHeight: 1.3 }, card.tagline));
  }
  if (card.status && badge) {
    textChildren.push(
      el('div', { ...flex, marginTop: 6, alignSelf: 'flex-start', fontSize: 22, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: badge.fg, background: badge.bg, padding: '8px 20px', borderRadius: 999 }, card.status[1]),
    );
  }

  return el(
    'div',
    { ...flex, position: 'relative', flexDirection: 'column', width: '100%', height: '100%', background: BG, padding: 80, justifyContent: 'space-between', fontFamily: 'Inter', overflow: 'hidden' },
    [
      // hue corner glow
      el('div', { position: 'absolute', top: -260, right: -200, width: 620, height: 620, borderRadius: 9999, background: card.hue, opacity: 0.16 }),
      // header row: art tile + title block
      el('div', { ...flex, alignItems: 'center', gap: 48 }, [
        artTile,
        el('div', { ...flex, flexDirection: 'column', gap: 16, maxWidth: 760 }, textChildren),
      ]),
      // footer byline
      el('div', { ...flex, alignItems: 'center', justifyContent: 'space-between', fontSize: 28, color: FAINT }, [
        el('div', { ...flex, color: TEXT, fontWeight: 700 }, 'Dylan McCavitt'),
        el('div', flex, 'dylanmccavitt.xyz'),
      ]),
    ],
  );
}

/** Render one OG card to a PNG buffer (1200×630). */
export async function renderOgImage(card: OgCard): Promise<Buffer> {
  FONTS ??= loadFonts();
  const svg = await satori(cardTree(card) as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: FONTS,
  });
  return Buffer.from(new Resvg(svg).render().asPng());
}
