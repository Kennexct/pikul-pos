import sys
from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

BASE = sys.argv[1]
OUT = sys.argv[2]
errors = []


def open_register(page, label='Buka kasir'):
    """v0.16 (ADR-017): the register must be opened before the first sale; open it with the suggested float."""
    back = page.url
    page.goto(BASE + '/kas')
    page.get_by_role('button', name=label).first.click()
    page.get_by_role('dialog').get_by_role('button', name=label).click()
    page.get_by_role('dialog').wait_for(state='detached')
    page.goto(back)

def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile, device_scale_factor=1)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name} pageerror: {e}'))
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{name} console: {m.text}'))
    page.goto(BASE)
    skip_with_sample_menu(page)  # first-time journey: empty store + test-only sample menu (ADR-018)
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('navigation').first.wait_for()
    open_register(page)
    page.get_by_role('button', name='Es Teh').first.wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/{name}-1-pos.png')

    # product with no variants
    page.get_by_role('button', name='Kerupuk').first.click()
    # product with variants -> sheet
    page.get_by_role('button', name='Bakso Urat').first.click()
    page.get_by_role('button', name='Telur').click()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/{name}-2-variant.png')
    page.get_by_role('button', name='Tambah ke pesanan').click()
    # switch to takeaway -> reprice
    page.get_by_role('radio', name='Takeaway').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/{name}-3-cart.png')
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').wait_for()
    page.get_by_role('button', name='Rp50.000').click()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/{name}-4-payment.png')
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/{name}-5-receipt.png')
    text = page.locator('.receipt').inner_text()
    page.get_by_role('button', name='Transaksi baru').click()

    # QRIS screen
    page.get_by_role('button', name='Es Teh').first.click()
    page.get_by_role('button', name='Tambah ke pesanan').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='QRIS').click()
    page.get_by_text('Total yang harus dibayar').wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/{name}-6-qris.png')
    browser.close()
    return text

with sync_playwright() as p:
    t1 = run(p, 'tablet', {'width': 1024, 'height': 768}, False)
    t2 = run(p, 'phone', {'width': 390, 'height': 844}, True)
print('RECEIPT (tablet):\n' + t1)
print('ERRORS:', errors or 'none')
