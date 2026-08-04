import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
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
  server = await startServer(4400); // distinct port from smoke.test (4399)
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new' as unknown as boolean,
    args: ['--no-sandbox'],
  });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

/** Type a console command and let the engine settle. */
async function run(page: Page, c: string) {
  await page.click('#cmd');
  await page.type('#cmd', c);
  await page.keyboard.press('Enter');
  await sleep(140);
}

describe('hidden lab — discovery breadcrumbs', () => {
  it('robots.txt sends recon at security.txt (sporting), not straight to the lab', async () => {
    const r = await fetch(server.origin + '/robots.txt');
    const t = await r.text();
    expect(r.status).toBe(200);
    expect(t).toMatch(/Disallow:\s*\/\.well-known\/security\.txt/);
    expect(t).not.toMatch(/substation/); // must not spell out the lab
  });

  it('security.txt is valid-shaped and nudges to /backup/', async () => {
    const t = await (await fetch(server.origin + '/.well-known/security.txt')).text();
    expect(t).toMatch(/Contact:/);
    expect(t).toMatch(/Expires:/);
    expect(t).toContain('/backup/');
  });

  it('/backup resolves to the Apache decoy listing', async () => {
    const r = await fetch(server.origin + '/backup');
    const t = await r.text();
    expect(r.status).toBe(200);
    expect(t).toContain('Index of /backup');
    expect(t).toMatch(/Apache\/2\.4/);
  });

  it('a decoy file points onward to the lab', async () => {
    const t = await (await fetch(server.origin + '/backup/notes.txt')).text();
    expect(t).toContain('/substation/');
  });
});

describe('hidden lab — stays out of the index', () => {
  it('lab + both debrief pages carry a noindex meta', async () => {
    for (const p of ['/substation/', '/substation/debrief/', '/en/substation/debrief/']) {
      const t = await (await fetch(server.origin + p)).text();
      expect(t, p).toMatch(/name="robots" content="noindex/);
    }
  });

  it('hidden paths never appear in the sitemap', () => {
    const sm = readFileSync(join(ROOT, 'dist', 'sitemap-0.xml'), 'utf8');
    expect(sm).not.toMatch(/backup/);
    expect(sm).not.toMatch(/substation/);
    expect(sm).not.toMatch(/well-known/);
  });
});

describe('hidden lab — the HMI puzzle', () => {
  it('the Industroyer kill chain blacks out the substation and reveals the flag, CSP-clean', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto(server.origin + '/substation/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#cmd');
    await run(page, 'iec104 interrogate');
    await run(page, 'iec61850 write PROT1/LLN0.Mod off');
    await run(page, 'iec104 select 1001');
    await run(page, 'iec104 execute 1001 off');

    await page.waitForSelector('#win:not([hidden])', { timeout: 3000 });
    expect(await page.$eval('#flagbox', (el) => el.textContent)).toContain('OKC{');
    expect(await page.$eval('#bus-volt', (el) => el.textContent)).toContain('0.0');
    expect(await page.$eval('#cb01-state', (el) => el.textContent)).toBe('OPEN');
    // No Content-Security-Policy violation fired for the bundled module script.
    expect(errors.join('\n')).not.toMatch(/Content Security Policy|Refused to (execute|apply)/i);
    await page.close();
  });

  it('the bay interlock blocks a trip while protection is healthy', async () => {
    const page = await browser.newPage();
    await page.goto(server.origin + '/substation/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#cmd');
    await run(page, 'iec104 select 1001');
    await run(page, 'iec104 execute 1001 off'); // no protection disable → rejected
    expect(await page.$eval('#win', (el) => (el as HTMLElement).hidden)).toBe(true);
    expect(await page.$eval('#cb01-state', (el) => el.textContent)).toBe('CLOSED');
    await page.close();
  });

  it('the win dialog is keyboard-dismissible (Escape)', async () => {
    const page = await browser.newPage();
    await page.goto(server.origin + '/substation/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#cmd');
    await run(page, 'iec61850 write PROT1/LLN0.Mod off');
    await run(page, 'iec104 select 1001');
    await run(page, 'iec104 execute 1001 off');
    await page.waitForSelector('#win:not([hidden])', { timeout: 3000 });
    await page.keyboard.press('Escape');
    await sleep(150);
    expect(await page.$eval('#win', (el) => (el as HTMLElement).hidden)).toBe(true);
    await page.close();
  });
});
