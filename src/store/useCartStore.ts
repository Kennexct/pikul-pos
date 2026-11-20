import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uuidv7 } from '../lib/id';
import { hasPriceChange, isMeasured } from '../lib/quantity';
import type { AppliedDiscount, Id, Order, OrderItem, SaleUnit, SelectedOption } from '../types';

interface AddItemInput {
  productId: Id;
  name: string;
  unitPrice: number;
  /** Product cost price at this moment, if the product has one (ADR-007). */
  unitCost?: number;
  options: SelectedOption[];
  /** Defaults to 1 piece. A weight for measured products (ADR-011). */
  qty?: number;
  unit?: SaleUnit;
  /** Normal price, for flexible-price products only. */
  listPrice?: number;
  /** Product variant (ADR-012); `name` is then "Product – Variant". */
  variantId?: Id;
  variantName?: string;
}

interface CartState {
  salesModeId: Id | null;
  customerId: Id | null;
  /** Set when editing a saved open order (bayar nanti). */
  openOrderId: Id | null;
  label: string;
  items: OrderItem[];
  orderDiscount: AppliedDiscount | null;
  addItem: (input: AddItemInput) => void;
  setQty: (itemId: Id, qty: number) => void;
  /** Change the weight and/or price of a line through the entry sheet. */
  updateItem: (itemId: Id, patch: Pick<OrderItem, 'qty' | 'unitPrice'>) => void;
  removeItem: (itemId: Id) => void;
  setItemNote: (itemId: Id, note: string) => void;
  setItemDiscount: (itemId: Id, discount: AppliedDiscount | null) => void;
  setOrderDiscount: (discount: AppliedDiscount | null) => void;
  setSalesMode: (salesModeId: Id) => void;
  setCustomer: (customerId: Id | null) => void;
  setLabel: (label: string) => void;
  /** Re-price every line, e.g. after switching Dine In -> Takeaway. A price typed by the seller is kept (ADR-011). */
  repriceItems: (priceFor: (item: OrderItem) => number) => void;
  /** Resume a saved open order (M8). */
  loadOrder: (order: Order) => void;
  clear: () => void;
}

const sameOptions = (a: readonly SelectedOption[], b: readonly SelectedOption[]): boolean =>
  a.length === b.length && a.every((opt, i) => opt.optionId === b[i]?.optionId);

const EMPTY_CART = {
  customerId: null,
  openOrderId: null,
  label: '',
  items: [],
  orderDiscount: null,
} as const satisfies Partial<CartState>;

/**
 * Cart is persisted to localStorage so a reload or crash mid-order loses nothing (PRD M1 AC).
 * All updates are immutable.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      salesModeId: null,
      ...EMPTY_CART,
      items: [],

      addItem: ({ productId, name, unitPrice, unitCost, options, qty = 1, unit, listPrice, variantId, variantName }) =>
        set((state) => {
          // Each weighing, and each flexible-price entry, is its own line.
          const isOwnLine = isMeasured(unit) || listPrice !== undefined;
          const existing = isOwnLine
            ? undefined
            : state.items.find((item) => item.productId === productId && item.variantId === variantId && sameOptions(item.options, options) && item.note === '' && item.listPrice === undefined);
          if (existing) {
            return {
              items: state.items.map((item) => (item.id === existing.id ? { ...item, qty: item.qty + 1 } : item)),
            };
          }
          const newItem: OrderItem = {
            id: uuidv7(),
            productId,
            nameSnapshot: name,
            unitPrice,
            ...(unitCost !== undefined ? { unitCost } : {}),
            ...(listPrice !== undefined ? { listPrice } : {}),
            ...(isMeasured(unit) ? { unit } : {}),
            ...(variantId ? { variantId, variantName } : {}),
            qty,
            options,
            discount: null,
            note: '',
          };
          return { items: [...state.items, newItem] };
        }),

      setQty: (itemId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((item) => item.id !== itemId)
              : state.items.map((item) => (item.id === itemId ? { ...item, qty } : item)),
        })),

      updateItem: (itemId, patch) =>
        set((state) => ({ items: state.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) })),

      removeItem: (itemId) => set((state) => ({ items: state.items.filter((item) => item.id !== itemId) })),

      setItemNote: (itemId, note) =>
        set((state) => ({ items: state.items.map((item) => (item.id === itemId ? { ...item, note } : item)) })),

      setItemDiscount: (itemId, discount) =>
        set((state) => ({ items: state.items.map((item) => (item.id === itemId ? { ...item, discount } : item)) })),

      setOrderDiscount: (orderDiscount) => set({ orderDiscount }),
      setSalesMode: (salesModeId) => set({ salesModeId }),
      setCustomer: (customerId) => set({ customerId }),
      setLabel: (label) => set({ label }),
      repriceItems: (priceFor) =>
        set((state) => ({
          items: state.items.map((item) => {
            const normal = priceFor(item);
            if (item.listPrice === undefined) return { ...item, unitPrice: normal };
            return hasPriceChange(item) ? { ...item, listPrice: normal } : { ...item, unitPrice: normal, listPrice: normal };
          }),
        })),
      loadOrder: (order) =>
        set({
          openOrderId: order.id,
          salesModeId: order.salesModeId,
          customerId: order.customerId,
          label: order.label,
          items: order.items,
          orderDiscount: order.orderDiscount,
        }),
      clear: () => set({ ...EMPTY_CART, items: [] }),
    }),
    { name: 'kasirku-cart' /* legacy id, frozen (ADR-016) */, storage: createJSONStorage(() => localStorage) },
  ),
);
