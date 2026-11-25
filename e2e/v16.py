"""v0.16 (ADR-017) + v0.20 (ADR-027): register open before the first sale (counted float), close with counted balance,
a new shift after closing (never the closed one), Kategori tab (add, rename, reorder, delete), variant expand in the product list.
Usage: python3 e2e/v16.py http://localhost:4173/app OUT"""
import re
import sys

from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import add_sample_menu  # noqa: E402

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
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Mulai jualan').click()
    page.get_by_role('navigation').first.wait_for()
    add_sample_menu(page, 'kopi')  # v0.17: the store starts empty (ADR-018)

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

    # 3. Cashier after closing (v0.20, ADR-027): the banner names the closed shift and the next tap opens shift 2.
    page.goto(BASE + '/')
    banner = page.get_by_text(re.compile(r'Shift 1 ditutup \d\d[.:]\d\d'))
    banner.wait_for()
    check(name, 'banner_names_closed_shift', True)
    shot(page, f'{name}-r5-closed-banner')
    page.get_by_role('button', name=re.compile('^Kentang Goreng')).first.click()
    dialog.get_by_role('heading', name='Buka shift baru').wait_for()
    check(name, 'new_shift_suggests_counted_cash', dialog.locator('#opening-cash').input_value().replace('.', '') == '110000')
    check(name, 'new_shift_shows_last_closing', 'dihitung Rp110.000' in dialog.inner_text())
    shot(page, f'{name}-r6-new-shift-sheet')
    dialog.get_by_role('button', name='Buka shift 2').click()
    page.get_by_text('Shift 2 dibuka · modal Rp110.000').wait_for()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').wait_for()
    else:
        page.get_by_label('Keranjang').get_by_text('Kentang Goreng').wait_for()
    check(name, 'item_added_after_new_shift', True)
    pay_exact(page, is_mobile)

    # Kas: shift 2 is the running one, shift 1 keeps its own figures, and the day adds both up.
    page.goto(BASE + '/kas')
    page.get_by_role('heading', name=re.compile('Kas laci · Shift 2')).wait_for()
    shifts = page.get_by_role('region', name='Semua shift hari ini')
    shifts.wait_for()
    shifts_text = shifts.inner_text()
    check(name, 'shift1_closed_and_shift2_running', 'Shift 1' in shifts_text and 'Sedang berjalan' in shifts_text)
    check(name, 'day_total_adds_shifts', 'Rp30.000' in shifts_text)  # 15.000 shift 1 + 15.000 shift 2
    check(name, 'closed_shift_not_reopenable', page.get_by_role('button', name='Buka kembali').count() == 0)
    shot(page, f'{name}-r7-shifts')
    shifts.get_by_role('button', name=re.compile('^Shift 1')).click()
    page.get_by_role('heading', name=re.compile('Kas laci · Shift 1')).wait_for()
    check(name, 'shift1_keeps_its_figures', 'Rp115.000' in page.get_by_role('region', name='Kas laci').inner_text())
    shot(page, f'{name}-r8-shift1-selected')

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
