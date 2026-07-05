# Portfolio

Clean, recruiter-friendly portfolio site. Current visual direction: **shadcn/ui "Sera"** — hard edges, uppercase tracked labels, hairline borders, ring-bordered surfaces, paper/ink feel. Designed for non-technical visitors first (recruiters, hiring managers).

## Stack

- **Astro 5 + TypeScript** — static-first site framework
- **Tailwind** via `@astrojs/tailwind` — utility classes map to CSS-variable design tokens
- **React islands** via `@astrojs/react` where client state is needed (theme toggle, interactive pagers)
- **CSS variables** own the design tokens (colors, spacing, type scale) — see the Sera design handoff for the authoritative values
- **Markdown/MDX** for content collections (projects, log)
- **Deployed** to Vercel or Cloudflare Pages

Default to zero client JS: static `.astro` pages everywhere, React islands only where interactivity actually earns them.

## Design Direction

> **Superseded.** The repo is mid-migration to the **agent-first redesign** (DM).
> DM supersedes Eve for new product architecture; Eve-era runtime code is legacy
> implementation evidence to mine or replace. The authoritative product/design
> direction is now `.agents/envelope/domain.md` plus `docs/agents/scope-ledger.md`.
> The Spotify/player-shell description below is historical — the player shell is
> being retired, not extended.

Current visual direction: the "now playing" player UI — a Spotify-style app shell
(sidebar, scrolling main, persistent bottom player bar) where projects are tracks
and the resume is an album ("The Journey"). Dark-only; tokens are the --pl-* set
in src/styles/player.css. All copy lives in src/data/catalog.ts / resume.ts (no
content collections). Zero client JS except the player-state island
(src/scripts/player.ts, vanilla TS). Retired Sera routes 301 via vercel.json.
Spec: ~/Projects/portfolio-redesign-prototypes/15-player-v4.html.

## Content

- Landing: monogram + numbered nav grid
- About: bio + contact row links
- Projects: index (card grid) + dynamic detail pages from a shared `PROJECTS` array
- Experience: resume button + education/work `dl` blocks
- Log: dated row-link entries
- Contact: row-link channels
- Blog: nice-to-have, not MVP

## Constraints

- Zero client JS by default — progressive enhancement only where needed
- No jargon in project descriptions — write for someone with no coding background

## Workflow

- **No co-author lines** on commits
- **Don't commit** spec/plan docs (`docs/superpowers/`) — those are working files, not repo artifacts
- Dev environment runs inside a Distrobox container

## Agent skills

This repo runs the Factorio workflow kit. The per-repo envelope is the single
binding point — read it before planning or building:

- `.agents/envelope/linear-map.md` — Linear team (`dmcc`/AGE) + Portfolio project, labels, states, the inserter triage map, and the GitHub bridge.
- `.agents/envelope/domain.md` — domain glossary (DM, Eve legacy evidence, Split-canvas landing, Typographic card, Editorial detail, answer block, artifact card).
- `.agents/envelope/commands.md` — build/test/lint/run + default branch and the redesign stack.
- `.agents/envelope/templates/` — PR / issue / project-doc templates.

Repo-specific skills and agents live in `.agents/skills/` and `.agents/agents/`.
Continuity for the agent-first redesign is tracked in `docs/agents/scope-ledger.md`.

## Cursor Cloud specific instructions

Standard build/test/lint/run commands live in `package.json` and
`.agents/envelope/commands.md` — use those, this section only records the
non-obvious cloud caveats.

- **Node 24 is required** (`engines: 24.x`, `.node-version`, `.nvmrc`, `mise.toml`).
  The nvm default alias is set to `24`, so tmux / interactive login shells (where
  `npm run dev` runs) already use Node 24. The Cursor **Shell tool runs a non-login
  shell** with `/exec-daemon/node` (Node 22) first on `PATH`, so bare `node`/`npm`
  there is Node 22. Before running `npm run typecheck`/`build`/`test:*` from the
  Shell tool, activate Node 24 first, e.g. `source ~/.nvm/nvm.sh && nvm use 24`
  (or prepend `$HOME/.nvm/versions/node/v24.18.0/bin` to `PATH`).
- **Tests need no external services or secrets.** The `test:*` scripts use an
  in-memory Postgres via `@electric-sql/pglite`; the CI test set is
  `test:db test:discovery test:slack test:admin test:eve test:dm test:metrics test:rag`.
- **DM/Eve chat is disabled without config.** `/api/dm/chat` and `/api/eve/chat`
  return HTTP 503 `missing_config` unless `OPENAI_API_KEY` (DM) / `EVE_AGENT_HOST`
  (legacy Eve) are set; the site shell, browsing, and all tests work without them.
  The chat UI degrades to a "DM is unavailable right now" notice. Set those env
  vars (never commit them) to exercise live chat.
