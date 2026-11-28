import type { ReceiptDoc } from './receiptDoc';

/**
 * Receipt PNG drawn on the device (ADR-028): works offline, no server rendering.
 * `layoutReceipt` is pure (text width is passed in) so it can be tested; `receiptPng` paints it on a canvas.
 */

export const RECEIPT_WIDTH = 360;
const PAD = 22;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '"Plus Jakarta Sans Variable", system-ui, sans-serif';
const INK = '#0f1a16';
const MUTED = '#5b6862';
const SOFT = '#3d4843';
const DANGER = '#b42318';
const MAX_PNG_BYTES = 290_000;

export type DrawOp =
  | { t: 'text'; x: number; y: number; text: string; font: string; color: string; align: 'left' | 'right' | 'center' }
  | { t: 'rule'; y: number }
  | { t: 'banner'; y: number; h: number; text: string; font: string };

export type Measure = (text: string, font: string) => number;

/** Splits text into lines no wider than `max`, breaking at spaces (or inside a very long word). */
export function wrap(text: string, max: number, font: string, measure: Measure): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (measure(next, font) <= max) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    cur = word;
    while (measure(cur, font) > max && cur.length > 1) {
      let cut = cur.length - 1;
      while (cut > 1 && measure(cur.slice(0, cut), font) > max) cut--;
      out.push(cur.slice(0, cut));
      cur = cur.slice(cut);
    }
  }
  if (cur || out.length === 0) out.push(cur);
  return out;
}

export function layoutReceipt(doc: ReceiptDoc, measure: Measure): { ops: DrawOp[]; height: number } {
  const ops: DrawOp[] = [];
  const inner = RECEIPT_WIDTH - PAD * 2;
  const mid = RECEIPT_WIDTH / 2;
  let y = PAD;
  const mono = (px: number, weight = 400) => `${weight} ${px}px ${MONO}`;
  const sans = (px: number, weight = 400) => `${weight} ${px}px ${SANS}`;
  const center = (text: string, font: string, color: string, lh: number) => {
    for (const l of wrap(text, inner, font, measure)) {
      y += lh;
      ops.push({ t: 'text', x: mid, y, text: l, font, color, align: 'center' });
    }
  };

  if (doc.banner) {
    const font = sans(14, 600);
    ops.push({ t: 'banner', y, h: 34, text: doc.banner, font });
    y += 34 + 10;
  }
  center(doc.shop.name, sans(17, 600), INK, 22);
  if (doc.shop.address) center(doc.shop.address, sans(12), MUTED, 17);
  if (doc.shop.phone) center(doc.shop.phone, sans(12), MUTED, 17);
  if (doc.shop.header) center(doc.shop.header, sans(12), SOFT, 17);
  y += 8;

  const LH = 19;
  for (const line of doc.lines) {
    if (line.k === 'rule') {
      y += 10;
      ops.push({ t: 'rule', y });
      y += 4;
      continue;
    }
    const indent = line.k === 'sub' || line.k === 'note' ? 10 : 0;
    const font = line.k === 'total' ? mono(15, 600) : line.k === 'item' ? mono(13, 600) : line.k === 'note' ? mono(11.5) : mono(13);
    const color = line.k === 'alert' || line.k === 'note' ? DANGER : line.k === 'sub' ? MUTED : line.k === 'meta' ? SOFT : INK;
    const lh = line.k === 'total' ? 24 : line.k === 'note' ? 16 : LH;
    const rightW = line.r !== undefined ? measure(line.r, font) + 12 : 0;
    const wrapped = wrap(line.l, inner - indent - rightW, font, measure);
    if (line.k === 'item') y += 4;
    wrapped.forEach((text, i) => {
      y += lh;
      ops.push({ t: 'text', x: PAD + indent, y, text, font, color, align: 'left' });
      if (i === 0 && line.r !== undefined) ops.push({ t: 'text', x: RECEIPT_WIDTH - PAD, y, text: line.r, font, color: line.k === 'sub' ? INK : color, align: 'right' });
    });
  }

  if (doc.footer) {
    y += 10;
    ops.push({ t: 'rule', y });
    y += 4;
    center(doc.footer, sans(12), SOFT, 17);
  }
  y += 10;
  ops.push({ t: 'text', x: mid, y: y + 14, text: 'Pikul', font: sans(10, 500), color: '#9aa49f', align: 'center' });
  return { ops, height: Math.ceil(y + 14 + PAD) };
}

function paint(doc: ReceiptDoc, scale: number): HTMLCanvasElement {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('no_canvas');
  const measure: Measure = (text, font) => {
    probe.font = font;
    return probe.measureText(text).width;
  };
  const { ops, height } = layoutReceipt(doc, measure);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(RECEIPT_WIDTH * scale);
  canvas.height = Math.round(height * scale);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no_canvas');
  g.scale(scale, scale);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, RECEIPT_WIDTH, height);
  g.textBaseline = 'alphabetic';
  for (const op of ops) {
    if (op.t === 'rule') {
      g.strokeStyle = '#b9c2bd';
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(PAD, op.y + 0.5);
      g.lineTo(RECEIPT_WIDTH - PAD, op.y + 0.5);
      g.stroke();
    } else if (op.t === 'banner') {
      g.fillStyle = '#fdecea';
      g.beginPath();
      g.roundRect(PAD, op.y, RECEIPT_WIDTH - PAD * 2, op.h, 8);
      g.fill();
      g.fillStyle = DANGER;
      g.font = op.font;
      g.textAlign = 'center';
      g.fillText(op.text, RECEIPT_WIDTH / 2, op.y + op.h / 2 + 5);
    } else {
      g.fillStyle = op.color;
      g.font = op.font;
      g.textAlign = op.align;
      g.fillText(op.text, op.x, op.y);
    }
  }
  return canvas;
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no_png'))), 'image/png'));

/** The receipt as a PNG, sharp on phones (2×), smaller for very long receipts so it stays under the upload limit. */
export async function receiptPng(doc: ReceiptDoc): Promise<Blob> {
  if (typeof document !== 'undefined' && 'fonts' in document) await document.fonts.ready.catch(() => undefined);
  let blob: Blob | null = null;
  for (const scale of [2, 1.5, 1]) {
    blob = await toBlob(paint(doc, scale));
    if (blob.size <= MAX_PNG_BYTES) return blob;
  }
  if (!blob) throw new Error('no_png');
  return blob;
}

export const receiptFileName = (receiptNo: string) => `struk-${receiptNo.replace(/[^A-Za-z0-9-]/g, '')}.png`;
