/** Accessible lightbox for the project gallery grid. Kept in a module so Astro
 *  externalizes the script (inline scripts are blocked by our CSP `script-src 'self'`). */
export function initGallery() {
  const grid = document.getElementById('gallery');
  const box = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img') as HTMLImageElement | null;
  const cap = document.getElementById('lightbox-cap');
  const closeBtn = box?.querySelector('.close') as HTMLButtonElement | null;
  if (!grid || !box || !img || !cap) return;

  const open = (src: string, title: string) => {
    img.src = src;
    img.alt = title;
    cap.textContent = title;
    box.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    closeBtn?.focus();
  };
  const close = () => {
    box.hidden = true;
    document.documentElement.style.overflow = '';
  };

  grid.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest('.cell') as HTMLElement | null;
    if (cell) open(cell.dataset.src || '', cell.dataset.title || '');
  });
  closeBtn?.addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
}
