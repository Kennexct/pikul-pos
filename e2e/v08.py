"""v0.8 flow (tablet + phone): custom payment methods and sales modes (add, rename, move, delete with guards),
the sold-out switch at the cashier, the "Belum bayar" customer view with its WhatsApp reminder, and history after removals."""
import re
import sys
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (name) => new Promise((res, rej) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const [methods, modes, orders, products] = await Promise.all([all('paymentMethods'), all('salesModes'), all('orders'), all('products')]);
  const live = (rows) => rows.filter((r) => !r.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.name);
  const paid = orders.find((o) => o.status === 'paid');
  return {
    methods: live(methods),
    deleted_methods: methods.filter((m) => m.deletedAt).map((m) => m.name).sort(),
    modes: live(modes),
    paid_with: paid.payments.map((p) => p.methodNameSnapshot),
    paid_mode: paid.salesModeNameSnapshot,
    paid_total: paid.totals.grandTotal,
    sold_out: products.filter((p) => p.isSoldOut).map((p) => p.name),
  };
}"""



def open_register(page, label='Buka kasir'):
    """v0.16 (ADR-017): the register must be opened before the first sale; open it with the suggested float."""
    back = page.url
    page.goto(BASE + '/kas')
    page.get_by_role('button', name=label).first.click()
    page.get_by_role('dialog').get_by_role('button', name=label).click()
    page.get_by_role('dialog').wait_for(state='detached')
    page.goto(back)

def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')

    # 1. Payment methods: add, refuse a duplicate, move up, rename, delete another one.
    page.goto(BASE + '/pengaturan?tab=payments')
    page.get_by_role('button', name='Lewati, pakai contoh toko').click()  # first-time journey: take the example store
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('navigation').first.wait_for()
    open_register(page)
    page.get_by_role('button', name='Tambah metode').click()
    page.locator('#method-name').fill('GoPay')
    shot(page, f'{name}-v1-add-method')
    dialog.get_by_role('button', name='Tambah metode').click()
    page.get_by_text('GoPay ditambahkan').wait_for()

    page.get_by_role('button', name='Tambah metode').click()
    page.locator('#method-name').fill('qris')
    dialog.get_by_role('button', name='Tambah metode').click()
    page.get_by_text('"qris" sudah ada.').wait_for()
    page.get_by_role('button', name='Tutup').click()

    page.get_by_role('button', name='Kelola GoPay').click()
    page.get_by_text('Posisi 4 dari 4').wait_for()
    page.get_by_role('button', name='Naikkan urutan').click()
    page.get_by_text('Posisi 3 dari 4').wait_for()
    page.get_by_role('button', name='Naikkan urutan').click()
    page.get_by_text('Posisi 2 dari 4').wait_for()
    page.locator('#config-name').fill('GoPay Toko')
    shot(page, f'{name}-v2-manage-method')
    page.get_by_role('button', name='Simpan nama').click()
    page.get_by_text('Nama diperbarui').wait_for()

    page.get_by_role('button', name='Kelola Transfer Bank').click()
    page.get_by_role('button', name='Hapus metode').click()
    shot(page, f'{name}-v3-delete-confirm')
    page.get_by_role('button', name='Hapus metode').click()
    page.get_by_text('Transfer Bank dihapus').wait_for()
    shot(page, f'{name}-v4-methods')

    # 2. Sales modes: add one with a markup; the default mode cannot be deleted.
    page.get_by_role('tab', name='Mode Penjualan').click()
    page.get_by_role('button', name='Tambah mode').click()
    page.locator('#mode-name').fill('ShopeeFood')
    dialog.get_by_role('radio', name='Markup %').click()
    page.locator('#mode-markup').fill('25')
    shot(page, f'{name}-v5-add-mode')
    dialog.get_by_role('button', name='Tambah mode').click()
    page.get_by_text('ShopeeFood ditambahkan').wait_for()
    page.get_by_role('button', name='Kelola Dine In').click()
    default_guard = dialog.get_by_text('Mode default tidak bisa dihapus').count() == 1 and dialog.get_by_role('button', name='Hapus mode').count() == 0
    page.get_by_role('button', name='Tutup').click()
    shot(page, f'{name}-v6-modes')

    # 3. Sell in the new mode and pay with the new method.
    page.goto(BASE + '/')
    page.get_by_role('radio', name='ShopeeFood').click()
    shot(page, f'{name}-v7-pos-modes')
    page.get_by_role('button', name='Kerupuk').first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    method_order = [b.inner_text().strip() for b in dialog.locator('button[aria-pressed]').all()]
    dialog.get_by_role('button', name='GoPay Toko').click()
    shot(page, f'{name}-v8-pay')
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    receipt = page.locator('.receipt').inner_text()
    page.get_by_role('button', name='Transaksi baru').click()

    # 4. Sold out: mark from the cashier; the tile stays but cannot be sold.
    page.get_by_role('button', name='Tandai stok habis').click()
    dialog.get_by_role('searchbox').fill('air')
    dialog.get_by_text('Air Mineral', exact=True).click()  # the label; the checkbox itself is visually hidden
    dialog.get_by_text('Habis, tidak bisa dijual').wait_for()
    shot(page, f'{name}-v9-soldout-sheet')
    page.get_by_role('button', name='Tutup').click()
    shot(page, f'{name}-v10-soldout-grid')
    page.get_by_role('button', name='Air Mineral, habis').click()
    tap_opens_sheet = dialog.get_by_text('1 menu ditandai habis').count() == 1
    page.get_by_role('button', name='Tutup').click()
    cart_stays_empty = page.get_by_role('button', name='Lihat pesanan').count() == 0 if is_mobile else page.get_by_role('button', name='Bayar').is_disabled()

    # 5. Debt: save an unpaid order for a customer, then find it under "Belum bayar".
    page.goto(BASE + '/pelanggan')
    page.get_by_role('button', name='Tambah pelanggan').click()
    page.locator('#customer-name').fill('Bu Sari')
    page.locator('#customer-phone').fill('081234567890')
    page.get_by_role('button', name='Simpan pelanggan').click()
    page.get_by_text('Bu Sari disimpan').wait_for()
    page.goto(BASE + '/')
    page.get_by_role('radio', name='Dine In').click()  # the cashier keeps the last mode used
    page.get_by_role('button', name='Kerupuk').first.click()
    page.get_by_role('button', name='Kerupuk').first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Tambah pelanggan').click()
    dialog.get_by_role('button', name=re.compile('Bu Sari')).click()
    page.get_by_role('button', name='Simpan', exact=True).click()
    page.locator('#order-label').fill('Bon Bu Sari')
    dialog.get_by_role('button', name='Simpan pesanan').click()  # the cart sheet may still be animating out
    page.get_by_text(re.compile('disimpan')).first.wait_for()

    page.goto(BASE + '/pelanggan')
    page.get_by_role('tab', name=re.compile('Belum bayar')).click()
    page.get_by_text('Total belum dibayar').wait_for()
    debt_tab = page.locator('main').inner_text() if page.locator('main').count() else page.inner_text('body')
    shot(page, f'{name}-v11-debt-list')
    page.get_by_role('button', name=re.compile('Bu Sari')).click()
    dialog.get_by_text('Belum dibayar').wait_for()
    detail = dialog.inner_text()
    reminder = unquote(dialog.get_by_role('link', name='Ingatkan via WhatsApp').get_attribute('href'))
    shot(page, f'{name}-v12-debt-detail')
    dialog.get_by_role('link', name='Terima bayaran').click()
    page.wait_for_url(re.compile('/pesanan'))

    # 6. Removing things later never rewrites history: a mode with an unpaid order is protected,
    #    and removed methods/modes stay filterable in the sales history.
    page.goto(BASE + '/pengaturan?tab=modes')
    page.get_by_role('button', name='Jadikan Takeaway default').click()
    page.get_by_role('button', name='Kelola Dine In').click()
    page.get_by_role('button', name='Hapus mode').click()
    page.get_by_role('button', name='Hapus mode').click()
    page.get_by_text('Masih ada 1 pesanan tersimpan dengan mode ini').wait_for()
    page.get_by_role('button', name='Batal').click()
    page.get_by_role('button', name='Tutup').click()
    page.get_by_role('button', name='Kelola ShopeeFood').click()
    page.get_by_role('button', name='Hapus mode').click()
    page.get_by_role('button', name='Hapus mode').click()
    page.get_by_text('ShopeeFood dihapus').wait_for()
    page.get_by_role('tab', name='Pembayaran').click()
    page.get_by_role('button', name='Kelola GoPay Toko').click()
    page.get_by_role('button', name='Hapus metode').click()
    page.get_by_role('button', name='Hapus metode').click()
    page.get_by_text('GoPay Toko dihapus').wait_for()

    page.goto(BASE + '/riwayat')
    page.get_by_role('button', name=re.compile('INV-')).first.wait_for()
    method_filter = page.get_by_label('Metode pembayaran')
    removed_options = [o for o in method_filter.locator('option').all_inner_texts() + page.get_by_label('Mode penjualan').locator('option').all_inner_texts() if 'dihapus' in o]
    method_filter.select_option(label='GoPay Toko (dihapus)')
    page.wait_for_timeout(300)
    filtered_hits = page.get_by_role('button', name=re.compile('INV-')).count()
    shot(page, f'{name}-v13-history-removed')

    db = page.evaluate(READ_DB)
    browser.close()
    return {
        'default_mode_guarded': default_guard,
        'pay_methods_in_order': method_order,
        'receipt_ok': 'GoPay Toko' in receipt and 'ShopeeFood' in receipt,
        'soldout_tap_opens_sheet': tap_opens_sheet,
        'soldout_not_added': cart_stays_empty,
        'debt_tab_ok': 'Rp4.000' in debt_tab and '1 pelanggan · 1 pesanan' in debt_tab,
        'debt_detail_ok': 'Belum dibayar' in detail and 'Bon Bu Sari' in detail and 'Rp4.000' in detail,
        'removed_still_filterable': removed_options,
        'history_hits_for_removed_method': filtered_hits,
        'reminder_ok': reminder.startswith('https://wa.me/6281234567890?text=Halo Bu Sari, ini dari') and 'Total: Rp4.000' in reminder,
        **db,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], run(p, *args))
print('ERRORS:', errors or 'none')
