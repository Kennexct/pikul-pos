import sys
from playwright.sync_api import sync_playwright
BASE, OUT, FIX = sys.argv[1], sys.argv[2], sys.argv[3]
errors = []

def open_register(page, label='Buka kasir'):
    """v0.16 (ADR-017): the register must be opened before the first sale; open it with the suggested float."""
    back = page.url
    page.goto(BASE + '/kas')
    page.get_by_role('button', name=label).first.click()
    page.get_by_role('dialog').get_by_role('button', name=label).click()
    page.get_by_role('dialog').wait_for(state='detached')
    page.goto(back)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = b.new_context(locale='id-ID', viewport={'width': 1024, 'height': 768}).new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{r.status} {r.url}'))
    page.goto(BASE + '/pengaturan')
    page.get_by_role('button', name='Lewati, pakai contoh toko').click()  # first-time journey: take the example store
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('navigation').first.wait_for()
    open_register(page)
    page.get_by_role('tab', name='Pembayaran').click()
    page.locator('input[type=file]').first.set_input_files(f'{FIX}/qris.png')
    page.get_by_alt_text('QRIS statis').wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/m1-settings-qris.png')

    page.goto(BASE + '/produk')
    page.get_by_role('button', name='Produk', exact=True).first.click()
    page.locator('#product-name').fill('Martabak Telur')
    page.locator('#base-price').fill('25000')
    page.locator('[id^=price-]').first.fill('27000')
    page.get_by_role('dialog').get_by_role('button', name='Level Pedas', exact=True).click()
    page.locator('input[type=file]').set_input_files(f'{FIX}/photo.jpg')
    page.wait_for_timeout(800)
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/m2-product-form.png')
    page.get_by_role('button', name='Simpan produk').click()
    page.get_by_text('Martabak Telur').first.wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/m3-products.png')

    page.goto(BASE + '/')
    page.get_by_role('button', name='Martabak Telur').first.click()
    page.get_by_role('button', name='Tambah ke pesanan').click()
    page.get_by_role('button', name='Simpan', exact=True).click()
    page.get_by_role('button', name='Meja 3').click()
    page.get_by_role('button', name='Simpan pesanan').click()
    page.get_by_text('disimpan').first.wait_for()

    page.goto(BASE + '/pesanan')
    page.get_by_text('Meja 3').wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/m4-open-orders.png')
    page.get_by_role('button', name='Buka', exact=True).click()
    page.get_by_role('heading', name='Meja 3').wait_for()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='QRIS').click()
    page.get_by_alt_text('Kode QRIS Warung Saya').wait_for()
    page.wait_for_timeout(400); page.screenshot(path=f'{OUT}/m5-qris-image.png')
    page.get_by_role('button', name='Sudah dibayar').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    print('receipt:', ' | '.join(page.locator('.receipt').inner_text().split('\n')[:14]))
    page.get_by_role('button', name='Transaksi baru').click()
    page.goto(BASE + '/pesanan')
    page.get_by_text('Semua pesanan sudah dibayar').wait_for()
    b.close()
print('ERRORS:', errors or 'none')
