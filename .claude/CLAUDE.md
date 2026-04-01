# Portfolio

Clean, recruiter-friendly portfolio site with a Nordic design direction — muted palette, clean lines, natural tones, generous whitespace. Designed for non-technical visitors first (recruiters, hiring managers).

## Stack

- **Astro 5 + TypeScript** — static site, zero JS by default
- **Vanilla CSS** with custom properties for design tokens (colors, spacing, type scale)
- **Vanilla JS** for interactivity (topology map pan/zoom/click, dark mode toggle)
- **Markdown/MDX** for project content
- **Deployed** to Vercel or Cloudflare Pages

No frameworks. No Tailwind. No React. Zero dependency JS.

## Design Direction

- Nordic aesthetic — muted, natural, restrained
- Mobile-first responsive design
- Project descriptions: concise paragraphs + screenshots/visuals, not longform case studies
- Quality over quantity

## Content

- Homepage: hero, featured projects, brief bio, contact links
- Project pages: paragraph description + screenshots for each (homelab, bella-web, nohard, school work order system)
- Homelab section: full interactive topology diagram (ported from homelab/site/, rewritten in vanilla JS + SVG)
- Blog: separate section, nice-to-have, not MVP
- Bella-web and nohard are live and linkable

## Constraints

- Zero client JS by default — progressive enhancement only where needed
- No jargon in project descriptions — write for someone with no coding background
- Topology map: vanilla JS + SVG, no React island

## Workflow

- **No co-author lines** on commits
- **Don't commit** — only `git add` changed files so they show as staged. Dylan reviews and commits from Zed.
- **Don't commit** spec/plan docs (`docs/superpowers/`) — those are working files, not repo artifacts
- Dev environment runs inside a Distrobox container
