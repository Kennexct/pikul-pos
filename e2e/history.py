"""Sell two orders, partially refund one, void the other, and check history totals (tablet + phone)."""
import sys
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []



def open_register(page, label='Buka kasir'):
    """v0.16 (ADR-017): the register must be opened before the first sale; open it with the suggested float."""
    back = page.url
    page.goto(BASE + '/kas')
    page.get_by_role('button', name=label).first.click()
    page.get_by_role('dialog').get_by_role('button', name=label).click()
    page.get_by_role('dialog').wait_for(state='detached')
    page.goto(back)

def sell(page, product, is_mobile):
    page.goto(BASE + '/')
    page.get_by_role('button', name=product).first.click()
    if page.get_by_role('dialog').count() and page.get_by_role('button', name='Tambah ke pesanan').count():
        page.get_by_role('button', name='Tambah ke pesanan').click()
    page.get_by_role('button', name='Es Teh').first.click()
    page.get_by_role('button', name='Tambah ke pesanan').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_role('button', name='Transaksi baru').click()


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.goto(BASE + '/')
    page.get_by_role('button', name='Lewati, pakai contoh toko').click()  # first-time journey: take the example store
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('navigation').first.wait_for()
    open_register(page)
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))

    sell(page, 'Kerupuk', is_mobile)      # Kerupuk 2.000 + Es Teh 5.000 = 7.000
    sell(page, 'Air Mineral', is_mobile)  # Air Mineral 4.000 + Es Teh 5.000 = 9.000

    page.goto(BASE + '/riwayat')
    page.get_by_text('Penjualan bersih').wait_for()
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}-h1-history.png')
    before = page.locator('text=Penjualan bersih').locator('..').inner_text()

    rows = page.get_by_role('button', name='INV-')
    rows.nth(1).click()  # older sale (Kerupuk + Es Teh)
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}-h2-detail.png')
    page.get_by_role('button', name='Refund', exact=True).click()
    page.get_by_role('button', name='Tambah refund Es Teh').click()
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/{name}-h3-refund.png')
    page.get_by_role('button', name='Refund via').click()
    page.get_by_text('Refund berhasil dicatat').wait_for()
    page.get_by_role('dialog').get_by_text('Refund sebagian').first.wait_for()
    page.get_by_role('button', name='Tutup').click()

    page.get_by_role('button', name='INV-').nth(0).click()
    page.get_by_role('button', name='Void', exact=True).click()
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/{name}-h4-void.png')
    page.get_by_role('button', name='Void Rp').click()
    page.get_by_text('di-void').wait_for()
    page.get_by_role('button', name='Tutup').click()
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}-h5-after.png')
    after = page.locator('text=Penjualan bersih').locator('..').inner_text()
    browser.close()
    return before.replace('\n', ' '), after.replace('\n', ' ')


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        before, after = run(p, *args)
        print(f'{args[0]}: before [{before}] -> after [{after}]')
print('ERRORS:', errors or 'none')
