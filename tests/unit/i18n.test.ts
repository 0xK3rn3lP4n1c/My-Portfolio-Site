import { describe, it, expect } from 'vitest';
import { getLangFromUrl, useTranslations, localizedPath, defaultLang, ui } from '../../src/i18n/ui';

describe('getLangFromUrl', () => {
  it('detects English from the /en prefix', () => {
    expect(getLangFromUrl(new URL('https://x.dev/en/'))).toBe('en');
    expect(getLangFromUrl(new URL('https://x.dev/en/projects'))).toBe('en');
  });
  it('falls back to the default (tr) elsewhere', () => {
    expect(getLangFromUrl(new URL('https://x.dev/'))).toBe('tr');
    expect(getLangFromUrl(new URL('https://x.dev/projects'))).toBe('tr');
    expect(getLangFromUrl(new URL('https://x.dev/blog/merhaba'))).toBe('tr');
    expect(defaultLang).toBe('tr');
  });
});

describe('useTranslations', () => {
  it('returns locale-specific strings', () => {
    expect(useTranslations('tr')('nav.home')).toBe('Ana Sayfa');
    expect(useTranslations('en')('nav.home')).toBe('Home');
    expect(useTranslations('tr')('nav.projects')).toBe('Projeler');
    expect(useTranslations('en')('nav.projects')).toBe('Projects');
  });
  it('keeps both locales in sync (same key set)', () => {
    expect(Object.keys(ui.tr).sort()).toEqual(Object.keys(ui.en).sort());
  });
});

describe('localizedPath', () => {
  it('leaves default-locale (tr) paths untouched', () => {
    expect(localizedPath('/projects', 'tr')).toBe('/projects');
    expect(localizedPath('/', 'tr')).toBe('/');
  });
  it('prefixes /en for English', () => {
    expect(localizedPath('/projects', 'en')).toBe('/en/projects');
    expect(localizedPath('/', 'en')).toBe('/en');
    expect(localizedPath('/blog/merhaba', 'en')).toBe('/en/blog/merhaba');
  });
  it('normalises a missing leading slash', () => {
    expect(localizedPath('projects', 'tr')).toBe('/projects');
    expect(localizedPath('projects', 'en')).toBe('/en/projects');
  });
});
