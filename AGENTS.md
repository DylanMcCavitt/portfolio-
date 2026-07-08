# AGENTS.md

## Cursor Cloud specific instructions

This repo is a static-first **Astro 5/6 + TypeScript** portfolio site (Spotify-style "now playing" player UI). All content lives in `src/data/catalog.ts` and `src/data/resume.ts` (no content collections). Zero client JS except the vanilla-TS player island in `src/scripts/`.

- Requires Node `>=22.12.0` (see `engines` in `package.json`). Package manager is npm (`package-lock.json`).
- Standard scripts (see `package.json`): `npm run dev`, `npm run build`, `npm run preview`, `npm run lint` (eslint), `npm run typecheck` (`astro check`), and `npm run verify` (lint + typecheck + build).
- Dev server: `npm run dev` serves on `http://localhost:4321/`. Use `--host` to expose on the network. The dev toolbar is disabled on purpose in `astro.config.mjs`.
- Key routes: `/` (landing), `/library` (projects), `/projects/<slug>` (detail, generated from `PROJECTS` in `catalog.ts`), `/journey` (resume as an album). `vercel.json` 301-redirects retired routes (e.g. `/projects`, `/log`, `/experience`).
- `npm run typecheck` emits 2 harmless `astro(4000)` hints about inline `application/ld+json` scripts in the layouts — these are expected, not errors.
