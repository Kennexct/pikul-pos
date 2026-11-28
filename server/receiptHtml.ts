import type { ReceiptDoc, ReceiptLine } from './receiptTypes';

/** Server-side HTML for a shared receipt (ADR-028): the public page at /r/<token> and the email body. Everything is escaped. */

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const COPY = {
  id: { download: 'Unduh gambar', made: 'Dibuat dengan Pikul', missing: 'Struk tidak ditemukan atau sudah kedaluwarsa.', receipt: 'Struk', open: 'Lihat struk di web' },
  en: { download: 'Download image', made: 'Made with Pikul', missing: 'This receipt was not found or has expired.', receipt: 'Receipt', open: 'View the receipt on the web' },
} as const;

const ROW = 'display:flex;justify-content:space-between;gap:12px';

function lineHtml(x: ReceiptLine): string {
  if (x.k === 'rule') return '<hr style="border:0;border-top:1px dashed #b9c2bd;margin:10px 0">';
  const right = x.r !== undefined ? `<span style="white-space:nowrap">${esc(x.r)}</span>` : '';
  const left = `<span>${esc(x.l)}</span>`;
  switch (x.k) {
    case 'item':
      return `<p style="margin:6px 0 0;font-weight:600">${left}</p>`;
    case 'sub':
      return `<p style="margin:0;padding-left:8px;color:#5b6862;${x.r !== undefined ? ROW : ''}">${left}${right}</p>`;
    case 'total':
      return `<p style="margin:4px 0 0;font-size:15px;font-weight:600;${ROW}">${left}${right}</p>`;
    case 'alert':
      return `<p style="margin:2px 0;color:#b42318;${ROW}">${left}${right}</p>`;
    case 'note':
      return `<p style="margin:0 0 2px;padding-left:8px;font-size:12px;color:#b42318">${left}</p>`;
    case 'meta':
      return `<p style="margin:0;color:#3d4843;${ROW}">${left}${right}</p>`;
    default:
      return `<p style="margin:0;${ROW}">${left}${right}</p>`;
  }
}

/** The receipt itself, inline-styled so it reads the same in a browser and in an email client. */
export function receiptBlock(doc: ReceiptDoc): string {
  const shop = doc.shop;
  const head = [
    `<p style="margin:0;font-family:system-ui,sans-serif;font-size:16px;font-weight:600">${esc(shop.name)}</p>`,
    shop.address && `<p style="margin:0;font-family:system-ui,sans-serif;font-size:12px;color:#5b6862">${esc(shop.address)}</p>`,
    shop.phone && `<p style="margin:0;font-family:system-ui,sans-serif;font-size:12px;color:#5b6862">${esc(shop.phone)}</p>`,
    shop.header && `<p style="margin:4px 0 0;font-family:system-ui,sans-serif;font-size:12px;color:#3d4843">${esc(shop.header)}</p>`,
  ].filter(Boolean);
  const banner = doc.banner
    ? `<p style="margin:0 0 12px;padding:8px 10px;border-radius:8px;background:#fdecea;color:#b42318;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;text-align:center">${esc(doc.banner)}</p>`
    : '';
  const footer = doc.footer
    ? `<hr style="border:0;border-top:1px dashed #b9c2bd;margin:10px 0"><p style="margin:0;text-align:center;font-family:system-ui,sans-serif;font-size:12px;color:#3d4843">${esc(doc.footer)}</p>`
    : '';
  return `<div style="max-width:340px;margin:0 auto;background:#fff;color:#0f1a16;padding:20px;border-radius:12px;border:1px solid #e3e8e5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.55">${banner}<div style="text-align:center;margin-bottom:12px">${head.join('')}</div>${doc.lines.map(lineHtml).join('')}${footer}</div>`;
}

const page = (lang: 'id' | 'en', title: string, head: string, body: string) =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>${head}</head><body style="margin:0;padding:24px 16px;background:#f4f6f5;font-family:system-ui,sans-serif;color:#0f1a16">${body}</body></html>`;

/** Public page for /r/<token>. `imageUrl` is absolute (link previews need it). */
export function receiptPage(doc: ReceiptDoc, imageUrl: string, imagePath: string): string {
  const c = COPY[doc.lang];
  const title = `${c.receipt} ${doc.receiptNo} · ${doc.shop.name}`;
  const og = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(`Total ${doc.total}${doc.banner ? ` · ${doc.banner}` : ''}`)}">`,
    `<meta property="og:image" content="${esc(imageUrl)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('');
  const fileName = `struk-${doc.receiptNo.replace(/[^A-Za-z0-9-]/g, '')}.png`;
  const body = `${receiptBlock(doc)}<p style="max-width:340px;margin:16px auto 0;text-align:center"><a href="${esc(imagePath)}" download="${esc(fileName)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0b7a5a;color:#fff;font-weight:600;text-decoration:none">${c.download}</a></p><p style="margin:24px 0 0;text-align:center;font-size:12px;color:#7a857f">${c.made}</p>`;
  return page(doc.lang, title, og, body);
}

export function missingReceiptPage(): string {
  return page('id', 'Pikul', '', `<p style="max-width:340px;margin:40px auto;text-align:center;font-size:15px">${COPY.id.missing}<br><span style="color:#7a857f;font-size:13px">${COPY.en.missing}</span></p>`);
}

/** Email body: the same receipt plus the link. */
export function receiptEmailHtml(doc: ReceiptDoc, link: string): string {
  const c = COPY[doc.lang];
  return `<div style="background:#f4f6f5;padding:24px 12px">${receiptBlock(doc)}<p style="text-align:center;margin:16px 0 0;font-family:system-ui,sans-serif"><a href="${esc(link)}" style="color:#0b7a5a;font-weight:600">${c.open}</a></p><p style="text-align:center;margin:20px 0 0;font-family:system-ui,sans-serif;font-size:12px;color:#7a857f">${c.made}</p></div>`;
}

/** Plain-text alternative of the email. */
export function receiptEmailText(doc: ReceiptDoc, link: string): string {
  const out = [doc.shop.name, doc.shop.address, doc.shop.phone].filter(Boolean);
  if (doc.banner) out.push('', doc.banner);
  out.push('');
  for (const x of doc.lines) out.push(x.k === 'rule' ? '--------------------------------' : x.r !== undefined ? `${x.l}  ${x.r}` : x.l);
  if (doc.footer) out.push('', doc.footer);
  out.push('', `${COPY[doc.lang].open}: ${link}`);
  return out.join('\n');
}
