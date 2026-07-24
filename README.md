# omerkaancoskun.com.tr — portfolio

Personal portfolio of **Ömer Kaan Coşkun** — a cybersecurity / OT & network-security
professional. Built with [Astro](https://astro.build/), deployed on Netlify.

## Stack
- **Astro** (static output), TypeScript
- Content in Markdown via content collections (`src/content/`)
- i18n: Turkish (default, `/`) + English (`/en/`)
- CSS design tokens (no framework); dark, terminal-adjacent theme
- Entrance: lightweight Three.js "OT Threat Map" full-screen intro (GPU shaders,
  reduced-motion fallback, code-split so it loads only on demand)
- Interactive project embeds: the "Road of the Ronin" canvas game and an image gallery

## Develop
```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/
npm run preview
npm run check    # astro type-check
```

## Test
```bash
npm run test:unit   # Vitest — pure logic (i18n helpers)
npm run test:e2e    # Vitest + puppeteer-core — functional checks against a built dist/
```
The e2e suite drives Chromium; set `PUPPETEER_EXECUTABLE_PATH` if your browser isn't at
`/usr/bin/chromium`. CI (`.github/workflows/ci.yml`) runs build → check → unit → e2e on
every push/PR.

## Structure
```
src/
  content/{projects,blog}/   Markdown content (+ content.config.ts schema)
  layouts/                   BaseLayout, ArticleLayout
  components/                Nav, Footer, Hero, ProjectCard, EntryList, Gallery,
                             three/otThreatMap.ts, games/RoninGame + ronin/engine.ts
  pages/                     tr at root, en under /en
  scripts/                   client-side helpers (gallery lightbox)
  styles/                    tokens.css, global.css
  i18n/ui.ts                 UI strings + locale helpers
public/                      static assets (fonts-free; game + gallery media)
astro.config.mjs             integrations, i18n, built-in CSP (auto-hashed)
netlify.toml                 build + security headers
tests/                       unit/ (Vitest) · e2e/ (functional) · helpers/
```

## Security
- Per-page CSP via Astro's built-in `experimental.csp` (auto-hashes inline scripts/styles);
  `frame-ancestors` + HSTS/COOP/CORP/X-Frame-Options headers in `netlify.toml`.
- No third-party scripts (Three.js bundled); only the Google Fonts stylesheet is external.

## Notes
- Planning docs (audit, design ideas, roles, devlog) live in a local, git-ignored `vault/`.
- Known: pinned to Astro 5.x; the Astro 7 upgrade + a contact form are tracked for a later phase.
