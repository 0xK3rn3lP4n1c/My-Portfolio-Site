export const languages = { tr: 'Türkçe', en: 'English' } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = 'tr';

export const ui = {
  tr: {
    'nav.home': 'Ana Sayfa',
    'nav.projects': 'Projeler',
    'nav.blog': 'Notlar',
    'nav.skip': 'İçeriğe geç',
    'home.eyebrow': 'Siber Güvenlik · OT & Ağ Güvenliği',
    'home.enter': 'Başlat',
    'home.intro': 'Mühendislik, bilim ve ekonomi üzerine kişisel notlarım ve çalışmalarım.',
    'projects.title': 'Projeler',
    'projects.subtitle': 'Seçilmiş çalışmalar ve deneyler.',
    'blog.title': 'Notlar',
    'blog.subtitle': 'Mühendislik, bilim ve ekonomi üzerine yazılar.',
    'notfound.title': 'Sayfa bulunamadı',
    'notfound.back': 'Ana sayfaya dön',
    'footer.rights': 'Tüm hakları saklıdır.',
  },
  en: {
    'nav.home': 'Home',
    'nav.projects': 'Projects',
    'nav.blog': 'Notes',
    'nav.skip': 'Skip to content',
    'home.eyebrow': 'Cybersecurity · OT & Network Security',
    'home.enter': 'Start',
    'home.intro': 'Personal notes and work on engineering, science and economics.',
    'projects.title': 'Projects',
    'projects.subtitle': 'Selected work and experiments.',
    'blog.title': 'Notes',
    'blog.subtitle': 'Writing on engineering, science and economics.',
    'notfound.title': 'Page not found',
    'notfound.back': 'Back to home',
    'footer.rights': 'All rights reserved.',
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split('/');
  if (seg === 'en') return 'en';
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)['tr']): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/** Prefix a path with the locale (tr = root, en = /en). */
export function localizedPath(path: string, lang: Lang): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === 'en' ? `/en${clean === '/' ? '' : clean}` : clean;
}
