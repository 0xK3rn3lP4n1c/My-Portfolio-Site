import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import { startServer, type TestServer } from '../helpers/server';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let browser: Browser;
let server: TestServer;

beforeAll(async () => {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  }
  server = await startServer(4399);
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new' as unknown as boolean,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function newPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  return page;
}

describe('routes', () => {
  it('home renders the hero and enters full-screen intro mode', async () => {
    const page = await newPage();
    await page.goto(server.origin + '/', { waitUntil: 'networkidle0' });
    expect(await page.$eval('#hero-title', (el) => el.textContent)).toContain('Ömer Kaan Coşkun');
    expect(await page.$('.hero.intro-mode')).not.toBeNull();
    await page.close();
  });

  it('English locale renders translated nav', async () => {
    const page = await newPage();
    await page.goto(server.origin + '/en/', { waitUntil: 'networkidle0' });
    const nav = await page.$$eval('nav a', (as) => as.map((a) => a.textContent?.trim()));
    expect(nav).toContain('Home');
    expect(nav).toContain('Projects');
    await page.close();
  });

  it('serves a 404 page for unknown routes', async () => {
    const page = await newPage();
    const res = await page.goto(server.origin + '/nope-nope/', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(404);
    expect(await page.content()).toContain('404');
    await page.close();
  });
});

describe('entrance a11y', () => {
  it('under prefers-reduced-motion: no WebGL canvas, content reachable, no scroll lock', async () => {
    const page = await newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(server.origin + '/', { waitUntil: 'networkidle0' });
    await sleep(400);
    expect(await page.$('.hero.intro-mode')).toBeNull();
    expect(await page.$('#entrance canvas')).toBeNull();
    expect(await page.$('#after-hero')).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.classList.contains('intro-locked'))).toBe(false);
    await page.close();
  });
});

describe('interactive project embeds', () => {
  it('Ronin game starts and paints the canvas', async () => {
    const page = await newPage();
    await page.goto(server.origin + '/projects/road-of-the-ronin/', { waitUntil: 'networkidle0' });
    await page.click('#ronin-start');
    await sleep(900);
    const state = await page.evaluate(() => {
      const overlayHidden = document.getElementById('ronin-overlay')?.classList.contains('hidden');
      const canvas = document.getElementById('ronin-canvas') as HTMLCanvasElement;
      let painted = false;
      try {
        const d = canvas.getContext('2d')!.getImageData(400, 250, 60, 60).data;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 40) { painted = true; break; }
      } catch { /* ignore */ }
      return { overlayHidden, painted };
    });
    expect(state.overlayHidden).toBe(true);
    expect(state.painted).toBe(true);
    await page.close();
  });

  it('Design gallery opens the lightbox on click', async () => {
    const page = await newPage();
    await page.goto(server.origin + '/projects/okc-design/', { waitUntil: 'networkidle0' });
    expect((await page.$$('#gallery .cell')).length).toBe(12);
    await page.click('#gallery .cell');
    await sleep(300);
    expect(await page.evaluate(() => !document.getElementById('lightbox')?.hidden)).toBe(true);
    await page.close();
  });
});
