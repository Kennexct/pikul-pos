import { PackageX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChecklistBanner } from '../../components/Checklist/ChecklistBanner';
import { ReceiptSheet } from '../../components/Receipt/ReceiptSheet';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Sheet } from '../../components/ui/Sheet';
import { SearchInput } from '../../components/ui/SearchInput';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { btnIcon } from '../../components/ui/styles';
import { Tabs } from '../../components/ui/Tabs';
import { useAppData } from '../../hooks/useAppData';
import { useChecklist } from '../../hooks/useChecklist';
import { useCustomer } from '../../hooks/useCustomers';
import { formatRupiah } from '../../lib/money';
import { calculateTotals, resolveModePrice, unitPriceWithOptions } from '../../lib/pricing';
import { uuidv7 } from '../../lib/id';
import { writeAudit } from '../../services/audit';
import { completeOrder, saveOpenOrder, type PaymentInput } from '../../services/orders';
import { requestOwnerApproval } from '../../store/usePinPromptStore';
import { useCartStore } from '../../store/useCartStore';
import { hasVariants, isProductSoldOut, lineName, priceTarget, variantPrice } from '../../lib/productVariants';
import { countUnits, isMeasured } from '../../lib/quantity';
import type { AppliedDiscount, Id, Order, OrderItem, Product, ProductVariant, SalesMode, SaleUnit, SelectedOption } from '../../types';
import { CartPanel } from './components/CartPanel';
import { CustomerPicker } from './components/CustomerPicker';
import { DiscountSheet } from './components/DiscountSheet';
import { PaymentSheet } from './components/PaymentSheet';
import { ProductGrid } from './components/ProductGrid';
import { SaleEntrySheet } from './components/SaleEntrySheet';
import { SaveOrderSheet } from './components/SaveOrderSheet';
import { SoldOutSheet } from './components/SoldOutSheet';
import { OptionSheet } from './components/OptionSheet';
import { t } from '../../i18n';

/** What the entry sheet needs: a product being added, or a cart line being changed. */
interface EntryRequest {
  productId: Id;
  name: string;
  unit: SaleUnit | undefined;
  isPriceEditable: boolean;
  unitCost: number | undefined;
  options: SelectedOption[];
  variantId?: Id;
  variantName?: string;
  normalPrice: number;
  editing?: OrderItem;
}

const needsEntry = (product: Product): boolean => isMeasured(product.unit) || product.isPriceEditable === true;

type Panel = 'none' | 'cart' | 'discount' | 'customer' | 'payment' | 'save' | 'soldOut';
const ALL_CATEGORIES = 'all';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : t('Terjadi kesalahan.'));

export function POSPage() {
  const { store, catalog, cashierId, cashierName, hasOwnerPowers } = useAppData();
  const cart = useCartStore();
  const [panel, setPanel] = useState<Panel>('none');
  /** Phone: discount/customer sheets opened from the cart sheet return to it when they close. */
  const [isFromCart, setIsFromCart] = useState(false);
  const customer = useCustomer(cart.customerId);
  const customerName = customer && !customer.deletedAt ? customer.name : null;
  const [optionProduct, setOptionProduct] = useState<Product | null>(null);
  const [entry, setEntry] = useState<EntryRequest | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [categoryId, setCategoryId] = useState<Id>(ALL_CATEGORIES);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeModes = useMemo(() => catalog?.salesModes.filter((m) => m.isActive) ?? [], [catalog]);
  const mode: SalesMode | undefined =
    activeModes.find((m) => m.id === cart.salesModeId) ?? activeModes.find((m) => m.isDefault) ?? activeModes[0];

  const productsById = useMemo(() => new Map(catalog?.products.map((p) => [p.id, p]) ?? []), [catalog]);

  /** Normal unit price of a cart line for a sales mode: product or variant price plus add-ons (ADR-012). */
  const normalPriceFor = (item: OrderItem, salesMode: SalesMode): number => {
    const product = productsById.get(item.productId);
    if (!product) return item.listPrice ?? item.unitPrice;
    const variant = product.variants?.find((v) => v.id === item.variantId);
    return unitPriceWithOptions(variantPrice(product, variant, salesMode), item.options);
  };

  /**
   * The cart's mode can vanish (hidden or deleted in Settings). Fall back to the default and, for a cart that is
   * not a saved order, re-price it — a saved order keeps the prices the customer was told.
   */
  const { salesModeId, setSalesMode, repriceItems, openOrderId } = cart;
  useEffect(() => {
    if (!mode || salesModeId === mode.id) return;
    setSalesMode(mode.id);
    if (salesModeId === null || openOrderId) return;
    repriceItems((item) => normalPriceFor(item, mode));
  }, [mode, salesModeId, setSalesMode, repriceItems, openOrderId, productsById]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.products ?? []).filter(
      (p) =>
        p.isActive &&
        (categoryId === ALL_CATEGORIES || p.categoryId === categoryId) &&
        (query === '' || p.name.toLowerCase().includes(query)),
    );
  }, [catalog, categoryId, search]);
  const checklist = useChecklist(store?.id ?? null);
  const sellableProducts = useMemo(() => catalog?.products.filter((p) => p.isActive) ?? [], [catalog]);
  const soldOutCount = sellableProducts.filter(isProductSoldOut).length;
  const qtyByProduct = useMemo(() => {
    const map = new Map<Id, number>();
    cart.items.forEach((item) => map.set(item.productId, (map.get(item.productId) ?? 0) + countUnits([item])));
    return map;
  }, [cart.items]);
  const totals = useMemo(
    () => calculateTotals(cart.items, cart.orderDiscount, store ?? { taxPct: 0, servicePct: 0, isTaxInclusive: false }),
    [cart.items, cart.orderDiscount, store],
  );

  if (!store || !catalog) return <LoadingScreen />;
  if (!mode) return <LoadingScreen message={t('Aktifkan minimal satu mode penjualan di Pengaturan.')} />;

  const groupsFor = (product: Product) =>
    product.variantGroupIds.flatMap((id) => catalog.variantGroups.filter((g) => g.id === id));

  const handleSelectProduct = (product: Product) => {
    if (isProductSoldOut(product)) {
      setPanel('soldOut');
      return;
    }
    if (hasVariants(product) || groupsFor(product).length > 0) {
      setOptionProduct(product);
      return;
    }
    addOrAsk(product, undefined, [], resolveModePrice(product, mode));
  };

  /** Measured and flexible-price products go through the entry sheet; everything else is added at once (ADR-011). */
  const addOrAsk = (product: Product, variant: ProductVariant | undefined, options: SelectedOption[], normalPrice: number) => {
    const line = {
      productId: product.id,
      name: lineName(product, variant),
      unitCost: priceTarget(product, variant).costPrice,
      options,
      ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
    };
    if (needsEntry(product)) {
      setEntry({ ...line, unit: product.unit, isPriceEditable: product.isPriceEditable === true, normalPrice });
      return;
    }
    cart.addItem({ ...line, unitPrice: normalPrice });
  };

  const handleEditItem = (item: OrderItem) =>
    setEntry({
      productId: item.productId,
      name: item.nameSnapshot,
      unit: item.unit,
      isPriceEditable: item.listPrice !== undefined,
      unitCost: item.unitCost,
      options: item.options,
      ...(item.variantId ? { variantId: item.variantId, variantName: item.variantName } : {}),
      normalPrice: item.listPrice ?? item.unitPrice,
      editing: item,
    });

  const handleModeChange = (next: SalesMode) => {
    cart.setSalesMode(next.id);
    cart.repriceItems((item) => normalPriceFor(item, next));
  };

  const snapshot = () => {
    const { openOrderId, items, orderDiscount, customerId, label } = useCartStore.getState();
    return { openOrderId, items, orderDiscount, customerId, label };
  };
  const ctx = { store, salesMode: mode, cashierId };

  const handlePay = async (payment: PaymentInput) => {
    setIsSubmitting(true);
    try {
      const order = await completeOrder(snapshot(), ctx, payment);
      cart.clear();
      setPanel('none');
      if (store.settings.shouldAutoShowReceipt) setReceiptOrder(order);
      else toast.success(t('Lunas • {0}', order.receiptNo));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (label: string) => {
    setIsSubmitting(true);
    try {
      const order = await saveOpenOrder({ ...snapshot(), label }, ctx);
      cart.clear();
      setPanel('none');
      toast.success(t('Pesanan "{0}" disimpan', order.label));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** An owner-approved over-limit discount is written to the audit log before it is applied. */
  const handleApplyDiscount = async (discount: AppliedDiscount | null) => {
    try {
      if (discount?.approvedById) {
        await writeAudit({
          storeId: store.id,
          actorId: cashierId,
          entity: 'discount',
          entityId: cart.openOrderId ?? uuidv7(),
          action: 'discount_override',
          payload: { approvedById: discount.approvedById, name: discount.name, type: discount.type, value: discount.value, baseAmount: totals.subtotal - totals.itemDiscountTotal },
        });
      }
      cart.setOrderDiscount(discount);
      closeSub();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const itemCount = cart.items.reduce((sum, item) => sum + item.qty, 0);
  const openSub = (next: 'discount' | 'customer') => {
    setIsFromCart(panel === 'cart');
    setPanel(next);
  };
  const closeSub = () => setPanel(isFromCart ? 'cart' : 'none');

  const cartPanel = (
    <CartPanel
      totals={totals}
      modeName={mode.name}
      customerName={customerName}
      onEditItem={handleEditItem}
      onOpenCustomer={() => openSub('customer')}
      onOpenDiscount={() => openSub('discount')}
      onSave={() => setPanel('save')}
      onPay={() => setPanel('payment')}
    />
  );

  return (
    <div className="flex min-h-0 flex-1">
      <section aria-label={t('Produk')} className="flex min-w-0 flex-1 flex-col">
        {checklist && <ChecklistBanner checklist={checklist} />}
        <div className="flex flex-col gap-3 border-b border-line bg-surface px-3 pt-3 md:px-5 md:pt-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex min-w-0 flex-1 gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder={t('Cari menu…')} label={t('Cari produk')} />
              <button type="button" aria-label={t('Tandai stok habis')} title={t('Tandai stok habis')} onClick={() => setPanel('soldOut')} className={`${btnIcon} relative`}>
                <PackageX aria-hidden size={20} />
                {soldOutCount > 0 && (
                  <span className="num absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-ink px-1 text-[11px] font-bold text-white">
                    {soldOutCount}
                  </span>
                )}
              </button>
            </div>
            <div className="scroll-x -mx-3 min-w-0 px-3 md:mx-0 md:max-w-[55%] md:px-0">
              <SegmentedControl
                label={t('Mode penjualan')}
                options={activeModes.map((m) => ({ value: m.id, label: m.name }))}
                value={mode.id}
                onChange={(id) => {
                  const next = activeModes.find((m) => m.id === id);
                  if (next) handleModeChange(next);
                }}
              />
            </div>
          </div>
          <Tabs
            label={t('Kategori')}
            value={categoryId}
            onChange={setCategoryId}
            items={[{ value: ALL_CATEGORIES, label: t('Semua') }, ...catalog.categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 md:p-5">
          <ProductGrid products={visibleProducts} salesMode={mode} qtyByProduct={qtyByProduct} onSelect={handleSelectProduct} />
        </div>
      </section>

      <aside aria-label={t('Keranjang')} className="hidden w-[38%] min-w-[340px] max-w-[420px] border-l border-line md:flex md:flex-col">
        {cartPanel}
      </aside>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-3 pb-2 md:hidden">
          <button
            type="button"
            onClick={() => setPanel('cart')}
            className="animate-sheet flex h-14 w-full items-center gap-3 rounded-xl bg-ink px-4 text-white shadow-pop active:translate-y-px"
          >
            <span key={itemCount} className="num animate-pop flex h-7 min-w-7 items-center justify-center rounded-md bg-brand-500 px-1.5 text-[13px] font-bold">{itemCount}</span>
            <span className="text-[15px] font-semibold">{t('Lihat pesanan')}</span>
            <span className="num ml-auto text-[16px] font-bold">{formatRupiah(totals.grandTotal)}</span>
          </button>
        </div>
      )}

      <Sheet title={cart.openOrderId ? cart.label : t('Pesanan baru')} isOpen={panel === 'cart'} onClose={() => setPanel('none')} isFlush>
        <CartPanel
          totals={totals}
          modeName={mode.name}
          hasTitle={false}
          onEditItem={handleEditItem}
          customerName={customerName}
          onOpenCustomer={() => openSub('customer')}
          onOpenDiscount={() => openSub('discount')}
          onSave={() => setPanel('save')}
          onPay={() => setPanel('payment')}
        />
      </Sheet>

      {entry && (
        <SaleEntrySheet
          name={entry.name}
          unit={entry.unit}
          isPriceEditable={entry.isPriceEditable}
          normalPrice={entry.normalPrice}
          initial={entry.editing ? { qty: entry.editing.qty, unitPrice: entry.editing.unitPrice } : undefined}
          onClose={() => setEntry(null)}
          onConfirm={({ qty, unitPrice }) => {
            if (entry.editing) cart.updateItem(entry.editing.id, { qty, unitPrice });
            else {
              cart.addItem({
                productId: entry.productId,
                name: entry.name,
                unitPrice,
                unitCost: entry.unitCost,
                options: entry.options,
                ...(entry.variantId ? { variantId: entry.variantId, variantName: entry.variantName } : {}),
                qty,
                unit: entry.unit,
                listPrice: entry.isPriceEditable ? entry.normalPrice : undefined,
              });
            }
            setEntry(null);
          }}
        />
      )}
      {optionProduct && (
        <OptionSheet
          product={optionProduct}
          groups={groupsFor(optionProduct)}
          mode={mode}
          onClose={() => setOptionProduct(null)}
          onConfirm={({ variant, options, unitPrice }) => {
            setOptionProduct(null);
            addOrAsk(optionProduct, variant, options, unitPrice);
          }}
        />
      )}
      {panel === 'discount' && (
        <DiscountSheet
          presets={catalog.discounts.filter((d) => d.isActive && d.scope === 'order')}
          current={cart.orderDiscount}
          maxPercent={hasOwnerPowers ? null : store.settings.cashierMaxDiscountPct}
          baseAmount={totals.subtotal - totals.itemDiscountTotal}
          onRequestOverride={async () => (await requestOwnerApproval(t('Diskon di atas batas kasir')))?.ownerId ?? null}
          onApply={(discount) => void handleApplyDiscount(discount)}
          onClose={closeSub}
        />
      )}
      {panel === 'customer' && (
        <CustomerPicker
          storeId={store.id}
          selectedId={customerName ? cart.customerId : null}
          onSelect={(picked) => {
            cart.setCustomer(picked?.id ?? null);
            closeSub();
          }}
          onClose={closeSub}
        />
      )}
      {panel === 'payment' && (
        <PaymentSheet
          total={totals.grandTotal}
          methods={catalog.paymentMethods}
          storeName={store.name}
          isSubmitting={isSubmitting}
          onConfirm={(payment) => void handlePay(payment)}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'soldOut' && <SoldOutSheet products={sellableProducts} onClose={() => setPanel('none')} />}
      {panel === 'save' && (
        <SaveOrderSheet initialLabel={cart.label} isSubmitting={isSubmitting} onSave={(label) => void handleSave(label)} onClose={() => setPanel('none')} />
      )}
      {receiptOrder && (
        <ReceiptSheet order={receiptOrder} store={store} cashierName={cashierName} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
}
