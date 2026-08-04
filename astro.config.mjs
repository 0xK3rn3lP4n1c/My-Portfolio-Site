// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// NOTE: `site` is a placeholder — confirm the real production domain.
export default defineConfig({
  site: 'https://omerkaancoskun.com.tr',
  integrations: [sitemap()],
  // Built-in CSP: Astro emits a per-page <meta> policy and auto-hashes the inline
  // scripts/styles it generates (some hoisted scripts get inlined when small). This
  // keeps a strict `script-src 'self'` without a fragile hand-maintained hash.
  // `frame-ancestors` can't live in a <meta> CSP, so it stays a header in netlify.toml.
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
