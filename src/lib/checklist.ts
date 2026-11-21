import { ROUTES } from '../constants';
import { t } from '../i18n';

/** "Langkah awal" (ADR-009): every item is derived from facts in the database — nothing is ticked by hand. */
export interface ChecklistFacts {
  hasMenu: boolean;
  hasSale: boolean;
  hasOwnerPin: boolean;
  /** QRIS is one of the active payment methods. */
  usesQris: boolean;
  hasQrisImage: boolean;
  hasClosing: boolean;
  hasBackup: boolean;
}

export interface ChecklistItem {
  id: 'menu' | 'sale' | 'pin' | 'qris' | 'closing' | 'backup';
  label: string;
  hint: string;
  isDone: boolean;
  to: string;
}

export function buildChecklist(facts: ChecklistFacts): ChecklistItem[] {
  const items: Array<ChecklistItem | null> = [
    { id: 'menu', label: t('Tambah menu'), hint: t('Masukkan produk yang Anda jual beserta harganya.'), isDone: facts.hasMenu, to: ROUTES.products },
    { id: 'sale', label: t('Coba transaksi pertama'), hint: t('Ketuk menu, lalu Bayar.'), isDone: facts.hasSale, to: ROUTES.pos },
    facts.usesQris
      ? { id: 'qris', label: t('Unggah gambar QRIS'), hint: t('Supaya bisa ditampilkan ke pelanggan saat membayar.'), isDone: facts.hasQrisImage, to: `${ROUTES.settings}?tab=payments` }
      : null,
    { id: 'pin', label: t('Pasang PIN pemilik'), hint: t('Melindungi laporan, produk, dan pengaturan.'), isDone: facts.hasOwnerPin, to: `${ROUTES.settings}?tab=staff` },
    { id: 'closing', label: t('Tutup kasir pertama'), hint: t('Hitung uang laci di akhir hari.'), isDone: facts.hasClosing, to: ROUTES.cash },
    { id: 'backup', label: t('Cadangkan data'), hint: t('Simpan salinan data toko ke berkas.'), isDone: facts.hasBackup, to: `${ROUTES.settings}?tab=backup` },
  ];
  return items.filter((item): item is ChecklistItem => item !== null);
}

export const checklistProgress = (items: readonly ChecklistItem[]): { done: number; total: number; isComplete: boolean } => {
  const done = items.filter((item) => item.isDone).length;
  return { done, total: items.length, isComplete: done === items.length };
};
