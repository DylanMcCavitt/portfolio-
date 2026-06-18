# Prototype: cleaner project detail page (throwaway)

**Question:** after you click into a project, what should the page look like
once we drop the Spotify/player-shell metaphor? Simpler, cleaner — read like a
real project / case-study page, not a music app.

**Run:** `npm run dev` → **http://localhost:4321/prototype/project/exit-manager**

**Drive it:** floating switcher at bottom-center, or `←` / `→` keys. Variant is
URL state (`?variant=A|B|C`, toggled client-side via `body[data-variant]`). The
showcased project is a **path param** (`/prototype/project/<id>`) — every
catalog project is prerendered, so you can preview real content variety:
- `exit-manager` — wide real screenshots (default)
- `dog-log` — phone (9:16) screenshots
- `hood` — skeleton placeholders (no captured shots)

Related cards link through to other projects and **keep the active variant**.

## The three options

- `A` **Editorial** — centered single-column case study. Monogram + back bar,
  big hero, full-width lead screenshot, a comfortable reading column (About,
  Metrics strip, Highlights, Details), then a gallery, then related cards.
  Content-first, lots of whitespace. Most readable for non-technical visitors.
- `B` **Spec sheet** — two-column: a sticky left rail with the at-a-glance facts
  (status, area·year, metrics, details, links) beside a scrolling content column
  (About, Highlights, screenshots). Most scannable; GitHub/spec feel. Collapses
  to single column (rail on top) ≤820px.
- `C` **Gallery** — visual-first. A split hero (text + first screenshot) then a
  dominant screenshot gallery as the centerpiece, with compact details below.
  Best when the work is visual.

All three: dark `--pl-*` palette + `project.hue` accent, real `<img>`
screenshots (wide / phone / skeleton handled) with a zero-JS `:target`
lightbox, status via `.badge.<kind>`, no Spotify-isms (no play button, seek,
equalizer, "now playing / album / track / liner notes"), normal page scroll.

## Scaffolding (prototype-local)

- `project/[p].astro` — route: prerenders one page per catalog project, renders
  the three variant panes, toggles `body[data-variant]`, preserves the variant
  on related click-through. Reuses `_AgentSwitcher.astro` (the shared switcher).
- `_ProjectVariant{A,B,C}.astro` — the three layouts (props `{ project, related }`).

**Verdict (Dylan, 20__-__-__):** _<pick a winner, or mix — e.g. "A's reading
column with C's lead gallery">_

**Cleanup:** once chosen, fold the winner into
`src/pages/projects/[id].astro` (rewrite properly; decide whether the detail
page keeps any global nav now that the landing is the agent), then delete
`_ProjectVariant{A,B,C}.astro`, `project/[p].astro`, and this file.
