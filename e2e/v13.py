"""v0.13 flow (tablet + phone): product → variant → add-on. Coffee template: Kopi – Latte + Grande + Less ice + No sugar,
Takeaway price per variant, receipt and best sellers per variant, a sold-out variant, and a new product with variants
made in the product form. The old "Varian" tab is now "Add-on"."""
import json
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); });
  const all = (n) => new Promise((res) => { const r = db.transaction(n).objectStore(n).getAll(); r.onsuccess = () => res(r.result); });
  const [orders, products] = await Promise.all(['orders', 'products'].map(all));
  const nasi = products.find((p) => p.name === 'Nasi Goreng');
  return {
    lines: orders.flatMap((o) => o.items.map((i) => ({ name: i.nameSnapshot, variant: i.variantName ?? null, price: i.unitPrice, addons: i.options.map((x) => x.name) }))),
    nasi: nasi && { base: nasi.basePrice, variants: nasi.variants.map((v) => [v.name, v.price, Object.values(v.modePrices ?? {})[0] ?? null]) },
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

    # Coffee shop through the journey.
    page.goto(BASE + '/')
    page.get_by_role('button', name='Lanjut').click()
    page.locator('#store-name').fill('Kopi Senja')
    page.get_by_role('radio', name=re.compile('Kopi & minuman')).click()
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Mulai jualan').click()
    page.get_by_role('navigation').first.wait_for()
    open_register(page)

    # 1. Kopi → Latte → Grande, Less ice, No sugar.
    kopi_tile = page.get_by_role('button', name=re.compile('^Kopi')).first
    tile_text = kopi_tile.inner_text()
    kopi_tile.click()
    before_choice = dialog.get_by_role('button', name=re.compile('Pilih varian')).count() == 1
    dialog.get_by_role('radio', name=re.compile('^Latte')).click()
    dialog.get_by_role('button', name='Grande').click()
    dialog.get_by_role('button', name='Sedikit es').click()
    dialog.get_by_role('button', name='Tanpa gula').click()
    add = dialog.get_by_role('button', name=re.compile('Tambah ke pesanan'))
    add_text = add.inner_text()
    shot(page, f'{name}-v13-1-sheet')
    add.click()
    # Same choice again merges; a different variant is its own line.
    kopi_tile.click()
    dialog.get_by_role('radio', name=re.compile('^Latte')).click()
    dialog.get_by_role('button', name='Grande').click()
    dialog.get_by_role('button', name='Sedikit es').click()
    dialog.get_by_role('button', name='Tanpa gula').click()
    dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).click()
    kopi_tile.click()
    dialog.get_by_role('radio', name=re.compile('^Americano')).click()
    dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).click()

    # 2. Takeaway uses each variant's own takeaway price.
    page.get_by_role('radio', name='Takeaway').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    cart = (dialog if is_mobile else page.locator('aside, section').last).inner_text()
    shot(page, f'{name}-v13-2-cart')
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    receipt = page.locator('.receipt').inner_text()
    shot(page, f'{name}-v13-3-receipt')
    page.get_by_role('button', name='Transaksi baru').click()
    page.get_by_role('radio', name='Dine In').click()

    # 3. Espresso sold out: listed under Kopi, disabled in the sheet; the tile stays sellable.
    page.get_by_role('button', name='Tandai stok habis').click()
    dialog.get_by_text('Espresso', exact=True).click()
    shot(page, f'{name}-v13-4-soldout')
    page.get_by_role('button', name='Tutup').click()
    kopi_tile.click()
    espresso_disabled = dialog.get_by_role('radio', name=re.compile('^Espresso')).is_disabled()
    page.keyboard.press('Escape')

    # 4. Products: tab "Add-on"; create Nasi Goreng with two variants and a takeaway price.
    page.goto(BASE + '/produk')
    tabs = page.get_by_role('tablist').inner_text()
    page.get_by_role('button', name='Produk', exact=True).first.click()
    page.locator('#product-name').fill('Nasi Goreng')
    dialog.get_by_text('Punya varian').click()
    names = dialog.locator('input[id^="variant-name-"]')
    prices = dialog.locator('input[id^="variant-price-"]')
    names.nth(0).fill('Biasa')
    prices.nth(0).fill('15000')
    names.nth(1).fill('Spesial')
    prices.nth(1).fill('22000')
    dialog.locator('input[id^="variant-"][id*="-"][placeholder="Ikut harga varian"]').nth(1).fill('23000')
    shot(page, f'{name}-v13-5-form')
    page.get_by_role('button', name='Simpan produk').click()
    page.locator('#product-name').wait_for(state='hidden')
    list_text = page.get_by_text('Nasi Goreng').first.locator('xpath=ancestor::li[1]').inner_text()

    page.goto(BASE + '/')
    page.get_by_role('button', name=re.compile('^Nasi Goreng')).first.click()
    dialog.get_by_role('radio', name=re.compile('^Spesial')).click()
    dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.get_by_role('button', name='Transaksi baru').click()

    # 5. Best sellers per variant.
    page.goto(BASE + '/laporan')
    top = page.get_by_text('Produk terlaris').locator('xpath=ancestor::section[1]').inner_text()
    shot(page, f'{name}-v13-6-report')
    db = page.evaluate(READ_DB)
    browser.close()
    return {
        'tile_shows_from_price': 'Mulai Rp15.000' in tile_text,
        'needs_variant_first': before_choice,
        'sheet_total': add_text.replace('\n', ' '),
        'cart_ok': all(s in cart for s in ['Kopi – Latte', 'Kopi – Americano', 'Grande', 'Rp60.000', 'Rp19.000']),
        'receipt_ok': 'Kopi – Latte' in receipt and 'Sedikit es' in receipt and '2 × Rp30.000' in receipt and 'Rp79.000' in receipt,
        'espresso_disabled': espresso_disabled,
        'products_tabs': tabs.replace('\n', ' '),
        'list_shows_variants': 'Biasa, Spesial' in list_text or '2 varian' in list_text,
        'top_products_per_variant': all(s in top for s in ['Kopi – Latte', 'Kopi – Americano', 'Nasi Goreng – Spesial']),
        **db,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], json.dumps(run(p, *args), ensure_ascii=False))
print('ERRORS:', errors or 'none')
