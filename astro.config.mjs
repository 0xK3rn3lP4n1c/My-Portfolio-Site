// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dev-only shim: `astro dev` serves exact files from public/ but (unlike `astro preview`
// and static hosts such as Netlify) does not resolve a bare directory request to its
// index.html — so the decoy at /backup 404s in dev while working in prod. This middleware
// serves public/<dir>/index.html for those requests so local dev matches production. It
// only runs in dev; the production build still ships the byte-exact static Apache page.
/** @returns {import('astro').AstroIntegration} */
function devPublicDirIndex() {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url));
  return {
    name: 'dev-public-dir-index',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((/** @type {import('node:http').IncomingMessage} */ req, /** @type {import('node:http').ServerResponse} */ res, /** @type {(err?: unknown) => void} */ next) => {
          const rel = decodeURIComponent((req.url || '/').split('?')[0])
            .replace(/^\/+/, '')
            .replace(/\/+$/, '');
          if (!rel || rel.includes('..')) return next();
          const file = path.join(publicDir, rel, 'index.html');
          if (file.startsWith(publicDir) && fs.existsSync(file)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            fs.createReadStream(file).pipe(res);
            return;
          }
          next();
        });
      },
    },
  };
}

// NOTE: `site` is a placeholder — confirm the real production domain.
export default defineConfig({
  site: 'https://omerkaancoskun.com.tr',
  // Keep the unlinked "fuzz-only" pages (the hidden OT lab and its decoy) out of the
  // sitemap so search engines never surface them — a recon-minded visitor still can.
  integrations: [
    sitemap({
      filter: (page) => !/\/(substation|backup)(\/|$)/.test(page) && !page.includes('/.well-known'),
    }),
    devPublicDirIndex(),
  ],
  // Class-based syntax highlighting (Prism) instead of Shiki: Shiki emits inline
  // `style="..."` attributes on every token, which a strict CSP (no 'unsafe-inline'
  // for style attributes) blocks. Prism uses token *classes* styled from our bundled
  // stylesheet — CSP-safe. No code blocks ship today, but this keeps future ones clean.
  markdown: {
    syntaxHighlight: 'prism',
  },
  // Built-in CSP (Astro `security.csp`): Astro emits a per-page <meta> policy and
  // auto-hashes the inline scripts/styles it generates (some hoisted scripts get inlined
  // when small). This keeps a strict `script-src 'self'` without a fragile hand-maintained
  // hash. `frame-ancestors` can't live in a <meta> CSP, so it stays a header in netlify.toml.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      styleDirective: { resources: ["'self'", 'https://fonts.googleapis.com'] },
      scriptDirective: { resources: ["'self'"] },
    },
  },
  i18n: {
    defaultLocale: 'tr',
    locales: ['tr', 'en'],
    routing: {
      // Turkish served at `/`, English at `/en/`.
      prefixDefaultLocale: false,
    },
  },
});
