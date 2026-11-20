"""v0.16 (ADR-017): register open before the first sale (counted float), close with counted balance,
closed-day warning, Kategori tab (add, rename, reorder, delete), variant expand in the product list.
Usage: python3 e2e/v16.py http://localhost:4173/app OUT"""
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1:3]
errors = []
results = {}


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def check(name, key, value):
    results[f'{name}:{key}'] = value


def pay_exact(page, is_mobile):
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.get_by_role('button', name='Transaksi baru').click()


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{name} console: {m.text}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')

    # Coffee shop through the journey (has products with variants).
    page.goto(BASE + '/')
    page.get_by_role('button', name='Lanjut').click()
    page.locator('#store-name').fill('Kopi Senja')
    page.get_by_role('radio', name=re.compile('Kopi & minuman')).click()
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Mulai jualan').click()

    # 1. Register not open: banner, and the first product tap asks for the opening count.
    page.get_by_text('Kasir belum dibuka hari ini').wait_for()
    shot(page, f'{name}-r1-banner')
    page.get_by_role('button', name=re.compile('^Roti Bakar')).first.click()
    dialog.get_by_role('heading', name='Buka kasir').wait_for()
    dialog.locator('#opening-cash').fill('100000')
    check(name, 'no_denomination_counter', dialog.get_by_text('Hitung per pecahan').count() == 0)
    shot(page, f'{name}-r2-open-sheet')
    dialog.get_by_role('button', name='Buka kasir').click()
    page.get_by_text('Kasir dibuka · modal Rp100.000').wait_for()
    check(name, 'banner_gone', page.get_by_text('Kasir belum dibuka hari ini').count() == 0)
    check(name, 'first_item_added_after_open', True)
    pay_exact(page, is_mobile)  # Roti Bakar Rp15.000 cash

    # 2. Kas: opening is recorded; close with a count that is Rp5.000 short.
    page.goto(BASE + '/kas')
    page.get_by_text('Rp115.000').first.wait_for()  # 100.000 + 15.000 cash sale
    check(name, 'edit_opening_reads_ubah', page.get_by_role('button', name='Ubah').count() == 1)
    page.get_by_role('button', name='Tutup kasir', exact=True).click()
    dialog.locator('#counted-cash').fill('110000')
    dialog.get_by_text('Selisih: kurang Rp5.000').wait_for()
    shot(page, f'{name}-r3-close-count')
    dialog.get_by_role('button', name='Tutup kasir', exact=True).click()
    page.get_by_text('Kasir ditutup, selisih kurang Rp5.000').wait_for()
    shot(page, f'{name}-r4-closed')

    # 3. Cashier after closing: banner, one warning, "Tetap jual" goes on; the next tap is not asked again.
    page.goto(BASE + '/')
    page.get_by_text('Kasir hari ini sudah ditutup').wait_for()
    page.get_by_role('button', name=re.compile('^Kentang Goreng')).first.click()
    dialog.get_by_role('heading', name='Kasir sudah ditutup').wait_for()
    shot(page, f'{name}-r5-closed-warning')
    dialog.get_by_role('button', name='Tetap jual').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').wait_for()
    else:
        page.get_by_label('Keranjang').get_by_text('Kentang Goreng').wait_for()
    check(name, 'closed_day_does_not_block', True)
    pay_exact(page, is_mobile)
    page.get_by_role('button', name=re.compile('^Roti Bakar')).first.click()
    page.wait_for_timeout(300)
    check(name, 'closed_warning_once', dialog.count() == 0)

    # 4. Kategori tab: add, rename, move up, delete (products move to "Tanpa kategori").
    page.goto(BASE + '/produk')
    page.get_by_role('tab', name=re.compile('^Kategori')).click()
    page.get_by_text('Camilan').wait_for()
    page.get_by_role('button', name='Kategori', exact=True).click()
    dialog.locator('#category-name').fill('Kopi')
    dialog.get_by_role('button', name='Simpan').click()
    page.get_by_text('"Kopi" sudah ada.').wait_for()
    dialog.locator('#category-name').fill('Musiman')
    dialog.get_by_role('button', name='Simpan').click()
    page.get_by_text('Musiman disimpan').wait_for()
    page.get_by_role('button', name=re.compile('^Musiman')).click()
    dialog.locator('#category-name').fill('Menu Musiman')
    dialog.get_by_role('button', name='Simpan').click()
    page.get_by_text('Menu Musiman disimpan').wait_for()
    page.get_by_role('button', name='Naikkan Menu Musiman').click()
    page.wait_for_timeout(300)
    order = page.locator('main li').all_inner_texts() if page.locator('main li').count() else []
    names = [t.split('\n')[0] for t in order]
    check(name, 'moved_up', names[-2:] == ['Menu Musiman', 'Camilan'])
    shot(page, f'{name}-c1-categories')
    page.get_by_role('button', name=re.compile('^Camilan')).click()
    dialog.get_by_role('button', name='Hapus kategori').click()
    dialog.get_by_text('2 produk di kategori ini pindah').wait_for()
    shot(page, f'{name}-c2-delete-confirm')
    dialog.get_by_role('button', name='Hapus kategori').click()
    page.get_by_text('Kategori Camilan dihapus').wait_for()
    page.get_by_text('Tanpa kategori: 2 produk').wait_for()

    # 5. Variant expand in the product list.
    page.get_by_role('tab', name=re.compile('^Produk')).click()
    toggle = page.get_by_role('button', name='Tampilkan varian Kopi')
    toggle.click()
    variants = page.get_by_role('list', name='Varian Kopi')
    variants.get_by_text('Latte').wait_for()
    check(name, 'variant_lines', variants.get_by_role('listitem').count() == 5)
    check(name, 'variant_price', 'Rp25.000' in variants.inner_text())
    check(name, 'aria_expanded', page.get_by_role('button', name='Sembunyikan varian Kopi').get_attribute('aria-expanded') == 'true')
    shot(page, f'{name}-p1-variant-expand')
    page.get_by_role('button', name='Sembunyikan varian Kopi').click()
    check(name, 'collapses', page.get_by_role('list', name='Varian Kopi').count() == 0)
    page.get_by_role('button', name='Buka semua varian').click()
    check(name, 'expand_all', page.get_by_role('list', name='Varian Teh').count() == 1)
    shot(page, f'{name}-p2-expand-all')
    browser.close()


with sync_playwright() as p:
    run(p, 'tablet', {'width': 1024, 'height': 768}, False)
    run(p, 'phone', {'width': 390, 'height': 844}, True)
failed = [k for k, v in results.items() if not v]
print('CHECKS:', len(results), 'failed:', failed or 'none')
print('ERRORS:', errors or 'none')
