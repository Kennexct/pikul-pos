import { BarChart3, CircleHelp, ClipboardList, LayoutGrid, Package, ReceiptText, Settings, Store, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROUTES } from '../../constants';
import { t } from '../../i18n';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Route is wrapped in <OwnerGate>; nav shows a lock while owner mode is locked. */
  isOwnerOnly?: boolean;
}

/** One entry of the main menu (rail + phone bar). A group with several pages shows them as sub-menu tabs. */
export interface NavGroup {
  id: 'pos' | 'sales' | 'money' | 'manage';
  label: string;
  icon: LucideIcon;
  items: readonly NavItem[];
}

/** Every page reachable from the menu, in menu order. */
export const NAV_ITEMS = {
  pos: { to: ROUTES.pos, label: t('Kasir'), icon: Store },
  openOrders: { to: ROUTES.openOrders, label: t('Pesanan'), icon: ClipboardList },
  history: { to: ROUTES.history, label: t('Riwayat'), icon: ReceiptText },
  cash: { to: ROUTES.cash, label: t('Kas'), icon: Wallet },
  reports: { to: ROUTES.reports, label: t('Laporan'), icon: BarChart3, isOwnerOnly: true },
  products: { to: ROUTES.products, label: t('Produk'), icon: Package, isOwnerOnly: true },
  customers: { to: ROUTES.customers, label: t('Pelanggan'), icon: Users },
  settings: { to: ROUTES.settings, label: t('Pengaturan'), icon: Settings, isOwnerOnly: true },
  help: { to: ROUTES.help, label: t('Bantuan'), icon: CircleHelp },
} as const satisfies Record<string, NavItem>;

/** Main menu: four groups instead of nine items (Bantuan sits apart, at the foot of the rail / in Akun on a phone). */
export const NAV_GROUPS: readonly NavGroup[] = [
  { id: 'pos', label: t('Kasir'), icon: Store, items: [NAV_ITEMS.pos] },
  { id: 'sales', label: t('Transaksi'), icon: ReceiptText, items: [NAV_ITEMS.openOrders, NAV_ITEMS.history] },
  { id: 'money', label: t('Keuangan'), icon: Wallet, items: [NAV_ITEMS.cash, NAV_ITEMS.reports] },
  { id: 'manage', label: t('Kelola'), icon: LayoutGrid, items: [NAV_ITEMS.products, NAV_ITEMS.customers, NAV_ITEMS.settings] },
];

/** The group whose pages include this path (exact match; "/" only matches the cashier). */
export const groupOf = (pathname: string): NavGroup | undefined =>
  NAV_GROUPS.find((g) => g.items.some((item) => (item.to === ROUTES.pos ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`))));
