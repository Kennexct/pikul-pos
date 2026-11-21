import { ChartColumn, FileText, LayoutDashboard, Megaphone, Store, Tags, Wallet, type LucideIcon } from 'lucide-react';
import { t } from '../i18n';

/** Console sections (ADR-020), shown in the left sidebar (ADR-021). */
export type Section = 'overview' | 'merchants' | 'payments' | 'report' | 'plans' | 'campaigns' | 'content';
export const SECTIONS: readonly Section[] = ['overview', 'merchants', 'payments', 'report', 'plans', 'campaigns', 'content'];

export interface NavEntry {
  id: Section;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  label: string;
  items: readonly NavEntry[];
}

/** Built on each render so labels follow the chosen language. */
export const navGroups = (): readonly NavGroup[] => [
  {
    label: t('Bisnis'),
    items: [
      { id: 'overview', label: t('Ringkasan'), icon: LayoutDashboard },
      { id: 'merchants', label: t('Merchant'), icon: Store },
      { id: 'payments', label: t('Pembayaran'), icon: Wallet },
      { id: 'report', label: t('Laporan'), icon: ChartColumn },
    ],
  },
  {
    label: t('Situs & promosi'),
    items: [
      { id: 'plans', label: t('Paket harga'), icon: Tags },
      { id: 'campaigns', label: t('Kampanye'), icon: Megaphone },
      { id: 'content', label: t('Konten landing'), icon: FileText },
    ],
  },
];

export const sectionLabel = (id: Section): string =>
  navGroups()
    .flatMap((g) => g.items)
    .find((i) => i.id === id)?.label ?? '';
