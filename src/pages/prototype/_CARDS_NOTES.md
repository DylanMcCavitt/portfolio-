# Prototype: project card + icon options (throwaway)

**Question:** the current project **cards** and the 2-letter hue album-art
**tile** ("icon") are out. What should replace them? Four directions, compared
head-to-head over the same curated set of real projects.

**Run:** `npm run dev` → **http://localhost:4321/prototype/cards**

**Drive it:** switcher / `←`·`→`. Variant in `?variant=A|B|C|D` (client toggle).
Curated set spans areas, statuses, and shot kinds: `exit-manager` (wide shots),
`dog-log` (phone shots), `hood` (no shots → fallback). Cards link through to the
detail prototype.

## The four options (no 2-letter tile in any)

- `A` **Screenshot** — image-led: the project's first real screenshot *is* the
  card; title/area/status below; activity chip overlay. Projects without a shot
  get a tasteful hue cover (no broken image). Most "show the work".
- `B` **Typographic** — zero imagery, zero tile: a monospace project id as the
  only mark, big title, area·year·status, tagline, a thin per-project hue tick.
  Calmest / most editorial; reads like a contents page.
- `C` **Line icon** — a semantic inline-SVG glyph chosen by `area` (Trading→
  candlesticks, Agents→node graph, iOS→phone, Infrastructure→servers, Research→
  flask, Shipped→box, School→mortarboard), hue-tinted, in compact row cards.
  A real icon *system* instead of letters.
- `D` **Generative** — a unique abstract mark generated deterministically from
  each project's id + hue (orbit / field / strata / facet families). Keeps a
  tile-like anchor, but never letters; engine in `_cardsMarkD.ts`.

All four: dark `--pl-*` palette, per-project `hue` accent, status via
`.badge.<kind>`, responsive (1 col ≤820px).

## Notes for whoever folds this in

- Whichever wins replaces the cards/icons in BOTH the agent-landing (B) and the
  project-detail prototypes (the "More projects" cards + the detail hero tile),
  and retires `ProjectArt`/`.art` (the 2-letter tile) + `AlbumCard`.
- **Build gotcha (fixed):** D's SVG-string engine originally lived in the
  component frontmatter and tripped an Astro compiler hoisting bug (frontmatter
  emitted twice → duplicate `export interface Props` → esbuild "Unexpected
  export"). Fixed by extracting the engine to `_cardsMarkD.ts` (esbuild compiles
  it directly). If you keep generative marks, keep that logic in a `.ts` module,
  not in `.astro` frontmatter.

**Verdict (Dylan, 2026-06-18):** **B — Typographic** wins. No imagery, no tile —
monospace project id as the only mark + per-project hue tick. This is the
canonical project card/icon for the whole site; retire `ProjectArt` (2-letter
tile) + `AlbumCard`.

**Cleanup:** fold the winner into the real components, then delete
`_CardsVariant{A,B,C,D}.astro`, `_cardsMarkD.ts`, `cards.astro`, and this file.
