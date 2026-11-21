/**
 * Landing page live data (ADR-014): redraws the paid plan cards from the admin console's plans and shows
 * the live campaign pop-up. Everything is built with DOM nodes and textContent — campaign text is never HTML.
 * If the API is unreachable the static cards stay as they are.
 */
interface Offer {
  id: string;
  name: string;
  days: number;
  amount: number;
  regularAmount: number;
  promoEndsAt: number | null;
  note: string;
  badge: string;
  features: string[];
}
interface Popup {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string;
}
interface Content {
  heroTitle: string;
  heroSubtitle: string;
  features: { icon: string; title: string; text: string }[];
  faqs: { q: string; a: string }[];
  contact: string;
}
interface LandingData {
  plans: Offer[];
  popup: Popup | null;
  /** Text saved in the admin console (ADR-020); null keeps the built-in page text. Hidden items are already removed. */
  content?: Content | null;
}

const G = '#0b7a5a';
const INK = '#0f1a16';
const SOFT = '#3d4a44';
const MUTED = '#5b6862';
const SEEN_KEY = 'kk.landingPopupsSeen';
const rupiah = (n: number) => `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`;
const date = (ms: number) => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, text?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.setAttribute('style', style);
  if (text !== undefined) n.textContent = text;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
const svg = (path: string, stroke: string, size = 18) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ 'aria-hidden': 'true', width: String(size), height: String(size), viewBox: '0 0 24 24', fill: 'none', stroke, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) s.setAttribute(k, v);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  s.appendChild(p);
  return s;
};

/** Same look as plan_card() in scripts/landing/build.py. */
function planCard(o: Offer): HTMLElement {
  const card = el('div', 'background: #fff; border: 1px solid #e3e8e5; border-radius: 18px; padding: 28px; display: flex; flex-direction: column; gap: 18px', undefined, { 'data-plan-card': o.id });
  const head = el('div', 'display: flex; justify-content: space-between; align-items: center; gap: 12px');
  head.append(el('h3', `margin: 0; font-size: 20px; font-weight: 800; color: ${INK}`, o.name));
  const promo = o.amount < o.regularAmount;
  const badge = promo ? 'Promo' : o.badge;
  if (badge) head.append(el('span', `padding: 4px 10px; border-radius: 999px; ${promo ? 'background: #e7f4ee; color: #075c44' : 'background: #f1f4f2; color: #3d4a44'}; font-size: 13px; font-weight: 700`, badge));
  const price = el('p', 'margin: 0; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap');
  if (promo) price.append(el('s', `font-size: 18px; font-weight: 600; color: ${MUTED}`, rupiah(o.regularAmount)));
  price.append(el('span', `font-size: 40px; font-weight: 800; letter-spacing: -0.03em; color: ${INK}`, rupiah(o.amount)), el('span', `font-size: 15px; color: ${MUTED}`, `/ ${o.days} hari`));
  card.append(head, price);
  if (promo && o.promoEndsAt !== null) card.append(el('p', `margin: -8px 0 0; font-size: 14px; font-weight: 700; color: ${G}`, `Harga promo sampai ${date(o.promoEndsAt)}`));
  if (o.note) card.append(el('p', `margin: 0; font-size: 15px; line-height: 1.6; color: ${SOFT}`, o.note));
  const ul = el('ul', 'list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px');
  for (const f of o.features) {
    const li = el('li', `display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.5; color: ${SOFT}`);
    const mark = el('span', 'flex: none; margin-top: 1px');
    mark.append(svg('M20 6 9 17l-5-5', G));
    li.append(mark, document.createTextNode(f));
    ul.append(li);
  }
  card.append(ul);
  card.append(el('a', `display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; margin-top: auto; background: #fff; color: ${INK}; border: 1px solid #c9d2cd`, 'Mulai dengan masa coba', { href: '/app/' }));
  return card;
}

function renderPlans(plans: Offer[]) {
  const grid = document.getElementById('paket-grid');
  if (!grid || plans.length === 0) return;
  grid.querySelectorAll('[data-plan-card]').forEach((n) => n.remove());
  for (const p of plans) grid.append(planCard(p));
}

const seenIds = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seenIds().filter((x) => x !== id), id].slice(-30)));
  } catch {
    /* blocked storage: may show again */
  }
}
const isSafeLink = (u: string) => /^\/(?!\/)/.test(u) || /^https:\/\//.test(u);

function showPopup(p: Popup) {
  const opener = document.activeElement as HTMLElement | null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Translucent, lightly blurred scrim: the page stays visible behind the promo. The card rises in and leaves the same way.
  const backdrop = el('div', `position: fixed; inset: 0; z-index: 50; background: rgba(15,26,22,.5); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; ${reduce ? '' : 'animation: kk-fade .2s ease-out'}`);
  const box = el('div', `position: relative; width: 100%; max-width: 480px; max-height: calc(100dvh - 32px); overflow: auto; overscroll-behavior: contain; background: #fff; border-radius: 18px; font-family: "Plus Jakarta Sans", system-ui, sans-serif; box-shadow: 0 24px 64px -16px rgba(15,26,22,.45); ${reduce ? '' : 'animation: kk-rise .32s cubic-bezier(.25,1,.5,1)'}`, undefined, {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'kk-popup-title',
  });
  const scrollY = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    document.removeEventListener('keydown', onKey);
    const done = () => {
      backdrop.remove();
      document.documentElement.style.overflow = scrollY;
      opener?.focus();
    };
    if (reduce) return done();
    backdrop.style.animation = 'kk-unfade .18s ease-in forwards';
    box.style.animation = 'kk-sink .18s cubic-bezier(.5,0,.75,0) forwards';
    window.setTimeout(done, 190);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);

  const x = el('button', 'position: absolute; top: 10px; right: 10px; width: 44px; height: 44px; border: 0; border-radius: 999px; background: rgba(255,255,255,.92); cursor: pointer; display: flex; align-items: center; justify-content: center', undefined, { type: 'button', 'aria-label': 'Tutup' });
  x.append(svg('M18 6 6 18M6 6l12 12', INK, 20));
  x.addEventListener('click', close);

  const link = p.linkUrl && isSafeLink(p.linkUrl) ? p.linkUrl : null;
  const external = link !== null && !link.startsWith('/');
  const linkAttrs = (extra: Record<string, string> = {}) => ({ href: link ?? '#', ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}), ...extra });
  if (p.imageUrl && isSafeLink(p.imageUrl)) {
    const img = el('img', 'display: block; width: 100%; height: auto; border-radius: 18px 18px 0 0', undefined, { src: p.imageUrl, alt: p.title });
    if (link) {
      const a = el('a', 'display: block', undefined, linkAttrs());
      a.addEventListener('click', close);
      a.append(img);
      box.append(a);
    } else box.append(img);
  }
  const content = el('div', 'padding: 22px 24px 24px; display: flex; flex-direction: column; gap: 10px');
  content.append(el('h2', `margin: 0; padding-right: 36px; font-size: 22px; line-height: 1.25; font-weight: 800; letter-spacing: -0.02em; color: ${INK}`, p.title, { id: 'kk-popup-title' }));
  if (p.body) content.append(el('p', `margin: 0; font-size: 16px; line-height: 1.6; color: ${SOFT}; white-space: pre-line`, p.body));
  if (link) {
    const cta = el('a', `display: inline-flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 8px; padding: 0 22px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; background: ${G}; color: #fff`, p.ctaLabel || 'Lihat promo', linkAttrs());
    cta.addEventListener('click', close);
    content.append(cta);
  }
  box.append(x, content);
  backdrop.append(box);
  if (!document.getElementById('kk-popup-style')) document.head.append(el('style', '', '@keyframes kk-fade{from{opacity:0}to{opacity:1}}@keyframes kk-rise{from{opacity:0;transform:translateY(16px) scale(.97)}}@keyframes kk-unfade{to{opacity:0}}@keyframes kk-sink{to{opacity:0;transform:translateY(8px) scale(.98)}}', { id: 'kk-popup-style' }));
  document.body.append(backdrop);
  x.focus();
}

/** Sections below the fold rise in once as they scroll into view (styles in scripts/landing/build.py). */
function revealOnScroll() {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.remove('lp-pending');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const node of document.querySelectorAll('[data-reveal]')) {
    if (node.getBoundingClientRect().top < window.innerHeight) continue; // already on screen: never hide it
    node.classList.add('lp-pending');
    io.observe(node);
  }
}

const hook = (name: string) => document.querySelector<HTMLElement>(`[data-lp="${name}"]`);
function setText(name: string, text: string) {
  const n = hook(name);
  if (n) n.textContent = text;
}

/** Redraws hero, features, FAQ and contact from saved content by cloning the built page's own markup (textContent only). */
function renderContent(c: Content) {
  setText('hero-title', c.heroTitle);
  setText('hero-subtitle', c.heroSubtitle);
  setText('contact', c.contact);
  const feats = hook('features');
  const featTpl = feats?.firstElementChild;
  const icons = document.querySelector<HTMLTemplateElement>('template[data-lp="icons"]')?.content;
  if (feats && featTpl) {
    const rows = c.features.map((f) => {
      const row = featTpl.cloneNode(true) as HTMLElement;
      row.dataset.icon = f.icon;
      const icon = icons?.querySelector(`[data-icon="${CSS.escape(f.icon)}"] svg`) ?? icons?.querySelector('[data-icon="check"] svg');
      const slot = row.firstElementChild;
      if (slot && icon) slot.replaceChildren(icon.cloneNode(true));
      const h = row.querySelector('h3');
      const p = row.querySelector('p');
      if (h) h.textContent = f.title;
      if (p) p.textContent = f.text;
      return row;
    });
    feats.replaceChildren(...rows);
  }
  const faqs = hook('faqs');
  const faqTpl = faqs?.firstElementChild;
  if (faqs && faqTpl) {
    const rows = c.faqs.map((f) => {
      const row = faqTpl.cloneNode(true) as HTMLDetailsElement;
      row.open = false;
      const q = row.querySelector('summary');
      const a = row.querySelector('p');
      if (q) q.textContent = f.q;
      if (a) {
        a.textContent = f.a;
        a.style.whiteSpace = 'pre-line';
      }
      return row;
    });
    faqs.replaceChildren(...rows);
  }
}

async function main() {
  let data: LandingData;
  try {
    const res = await fetch('/api/public/landing', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    data = (await res.json()) as LandingData;
  } catch {
    return;
  }
  renderPlans(data.plans);
  if (data.content) renderContent(data.content);
  const p = data.popup;
  if (p && !seenIds().includes(p.id)) {
    window.setTimeout(() => {
      markSeen(p.id);
      showPopup(p);
    }, 2_500);
  }
}

revealOnScroll();
void main();
