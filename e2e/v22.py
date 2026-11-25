"""v0.19.6: menu search reaches variants (cashier, sold-out sheet, Produk) and Transaksi's sub-menu reads Riwayat · Kas · Pesanan.
Coffee sample menu: "latte" finds Kopi (Latte) and Teh (Matcha Latte); "kopi latte" finds only Kopi.
Usage: python3 e2e/v22.py http://localhost:4173/app OUT"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import add_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1:3]
errors = []


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def tiles(page):
    return page.locator('main ul.grid > li span.line-clamp-2.font-semibold').all_inner_texts()


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{name} console: {m.text}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))

    page.goto(BASE + '/')
    page.get_by_role('button', name='Lanjut').click()
    page.locator('#store-name').fill('Kopi Senja')
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('button', name='Mulai jualan').click()
    page.get_by_role('navigation').first.wait_for()
    add_sample_menu(page, 'kopi')

    # 1. Cashier: a variant name finds its product and the tile says which variant matched.
    search = page.get_by_role('searchbox', name='Cari produk')
    assert search.get_attribute('placeholder') == 'Cari menu atau varian…'
    search.fill('latte')
    page.get_by_text('Varian: Latte', exact=True).wait_for()
    page.get_by_text('Varian: Matcha Latte', exact=True).wait_for()
    assert tiles(page) == ['Kopi', 'Teh'], tiles(page)
    shot(page, f'{name}-s1-pos-variant')
    search.fill('kopi latte')
    page.wait_for_timeout(200)
    assert tiles(page) == ['Kopi'], tiles(page)
    search.fill('roti')
    page.wait_for_timeout(200)
    assert tiles(page) == ['Roti Bakar'], tiles(page)
    assert page.get_by_text(re.compile('^Varian: ')).count() == 0, 'no variant line when the product name matches'
    search.fill('')

    # 2. Sold-out sheet search reaches variants too.
    page.get_by_role('button', name='Tandai stok habis').click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('searchbox').fill('americano')
    dialog.get_by_text('Americano', exact=True).wait_for()
    assert dialog.get_by_text('Teh', exact=True).count() == 0
    page.keyboard.press('Escape')
    dialog.wait_for(state='hidden')

    # 3. Produk: the matching variant is shown and marked.
    page.goto(BASE + '/produk')
    psearch = page.get_by_role('searchbox', name='Cari produk')
    assert psearch.get_attribute('placeholder') == 'Cari produk atau varian…'
    psearch.fill('gula aren')
    marked = page.locator('[aria-current="true"]', has_text='Kopi Susu Gula Aren')
    marked.wait_for()
    assert page.get_by_role('list', name='Varian Kopi').is_visible()
    assert page.get_by_role('list', name='Varian Teh').count() == 0
    shot(page, f'{name}-s2-products-variant')

    # 4. Transaksi sub-menu order: Riwayat · Kas · Pesanan; the group opens on Riwayat.
    page.goto(BASE + '/')
    page.get_by_role('link', name=re.compile('^Transaksi')).first.click()
    page.wait_for_url(re.compile(r'/riwayat$'))
    if is_mobile:
        sub = page.get_by_role('navigation', name='Menu Transaksi')
        labels = [re.sub(r'\d+', '', s).strip() for s in sub.get_by_role('link').all_inner_texts()]
    else:
        sub = page.locator('aside, nav').filter(has=page.get_by_role('link', name='Riwayat')).last
        labels = [re.sub(r'\d+', '', s).strip() for s in sub.get_by_role('link').all_inner_texts()]
        labels = [label for label in labels if label in ('Riwayat', 'Kas', 'Pesanan')]
    assert labels == ['Riwayat', 'Kas', 'Pesanan'], labels
    shot(page, f'{name}-s3-sales-menu')
    browser.close()


with sync_playwright() as p:
    run(p, 'phone', {'width': 390, 'height': 844}, True)
    run(p, 'tablet', {'width': 1024, 'height': 768}, False)

print('ERRORS:', errors or 'none')
