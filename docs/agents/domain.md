# Domain Notes

Agents must read repo-specific product and domain docs listed here before broad code exploration.

## Read first for this repo

- `.claude/CLAUDE.md` for current project stack and constraints. Its visual direction can lag active handoffs; prefer the latest handoff/PRD for redesign decisions.
- `adr/0001-landing-and-entry-ia.md` for landing/entry information architecture history.
- `src/data/catalog.ts` and `src/data/resume.ts` for canonical project, résumé, and contact content.
- `docs/agents/scope-ledger.md` for agent-first redesign continuity.

## Product language

- Audience: recruiters and hiring managers first.
- Current redesign north star: an agent-first portfolio where Eve answers questions about Dylan and renders project, résumé, and contact artifacts.
- Keep project copy jargon-light and outcome-focused.
- Default to static Astro pages; use client JavaScript only for deliberate interactive islands such as Eve chat.
