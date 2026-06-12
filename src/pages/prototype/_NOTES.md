# Prototype: player UI variants (throwaway)

**Question:** which direction for (1) the home/landing area, (2) the album-cover
treatment, and (3) the <820px mobile layout?

**Run:** `npm run dev` → http://localhost:4321/prototype/home

**Drive it:** floating panel at bottom-center.

- `Home ‹ ›` — A `now playing` (current) · B `artist profile` (avatar header,
  top tracks, playlist rail) · C `billboard` (full-bleed featured hero, pinned grid)
- `Cover ‹ ›` — A `accent bar` (current) · B `gradient` duotone · C `framed`
  poster · D `vinyl`
- Mobile is decided (tab bar) and graduated into the production shell:
  `TabBar.astro` + the `player.css` mobile block, on every page. Preview via
  the `phone` button (iframe at 390px) or a real narrow window.
- `knobs` — cover radius, glyph size, hue tint, accent-bar height (A),
  gradient strength (B), hero art size, title weight/tracking, row density,
  lowercase titles, art-in-rows.
- `copy url` captures the full state; ←/→ cycle the last-touched dimension.

Everything is URL state, e.g.
`/prototype/home?home=C&cover=B&mobile=B&radius=16&tw=900&lc=1&th=1`

**Verdict (Dylan, 2026-06-12):** home **B** (artist profile) · cover **C**
(framed) · mobile **B** (tab bar). Knobs: glyph 85, tint 23, bar 4, grad 35,
hero 180, weight 650, tracking -1.2, density 16, art-in-rows on. These are now
the prototype defaults (`reset` returns to them).

**Round 2 (same day):** "Live with real money" is not a category — playlist,
sidebar row, tab, and stat chip removed (`Project.money` stays as data). Mobile
tabs are Home · Building · Projects · Resume, persistent across all pages
(`TabBar.astro` in the layout, `/projects` index added as the Projects target).
Playlists without a tab (All + the seven areas) surface on mobile as a chip
rail at the top of every library view (`PlaylistChips.astro`).

Follow-up feedback applied on this branch (real code, not just proto):

- mobile must fit the screen dynamically → `100dvh` shell + `.actions` wraps
  (`player.css`)
- screenshots clickable/expandable → zero-JS `:target` lightbox in `ShotsRail`
- scrollbars hidden: shots rail (all widths), main view + browse sheet (mobile)
- "The Journey" album is now just **Resume** everywhere user-visible
  (sidebar, player bar subline, journey pages, 404, OG); the PDF links are
  labeled `Resume.pdf ↗`. Route stays `/journey` for now.

**Cleanup:** delete `src/pages/prototype/` once the winners are folded into
`LibraryView.astro` / `player.css` / the layout as real, properly-written code.
