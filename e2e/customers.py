"""Customers flow (tablet + phone): add a customer, attach to a sale, quick-add from the cart, receipt + WhatsApp link,
stats, history search, duplicate-phone error, delete (contact data erased)."""
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (name) => new Promise((res, rej) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const [customers, orders] = await Promise.all([all('customers'), all('orders')]);
  const andi = customers.find((c) => c.name === 'Mas Andi');
  return {
    order_customer_names: orders.map((o) => o.customerNameSnapshot).sort(),
    sari_phone: customers.find((c) => c.name === 'Bu Sari').phone,
    andi_deleted: Boolean(andi.deletedAt),
    andi_contact_erased: andi.phone === undefined && andi.note === undefined,
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


def pay_cash(page):
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))

    # 1. Add a customer from the Customers page.
    page.goto(BASE + '/pelanggan')
    page.get_by_role('button', name='Lewati, pakai contoh toko').click()  # first-time journey: take the example store
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('navigation').first.wait_for()
    open_register(page)
    page.get_by_text('Belum ada pelanggan').wait_for()
    page.get_by_role('button', name='Tambah pelanggan').click()
    page.locator('#customer-name').fill('Bu Sari')
    page.locator('#customer-phone').fill('0812-3456-7890')
    page.locator('#customer-note').fill('Langganan Jumat, tidak pedas')
    page.get_by_role('button', name='Simpan pelanggan').click()
    page.get_by_text('Bu Sari disimpan').wait_for()

    # 2. Sale with an existing customer picked from the cart.
    page.goto(BASE + '/')
    page.get_by_role('button', name='Kerupuk').first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Tambah pelanggan').click()
    page.get_by_role('searchbox', name='Cari pelanggan').fill('0812')
    page.get_by_role('dialog').get_by_role('button', name=re.compile('Bu Sari')).click()
    page.get_by_role('button', name=re.compile('Bu Sari.*Ganti')).wait_for()
    shot(page, f'{name}-c1-cart')
    pay_cash(page)
    receipt = page.locator('.receipt').inner_text()
    wa_href = page.get_by_role('link', name=re.compile('WhatsApp')).get_attribute('href')
    shot(page, f'{name}-c2-receipt')
    page.get_by_role('button', name='Transaksi baru').click()

    # 3. Sale with a customer quick-added from the cart.
    page.get_by_role('button', name='Air Mineral').first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Tambah pelanggan').click()
    page.get_by_role('searchbox', name='Cari pelanggan').fill('Mas Andi')
    shot(page, f'{name}-c3-picker')
    page.get_by_role('button', name=re.compile('Pelanggan baru')).click()
    assert page.locator('#quick-customer-name').input_value() == 'Mas Andi'
    page.locator('#quick-customer-phone').fill('085700001111')
    page.get_by_role('button', name='Simpan & pilih').click()
    page.get_by_role('button', name=re.compile('Mas Andi.*Ganti')).wait_for()
    pay_cash(page)
    page.get_by_role('button', name='Transaksi baru').click()

    # 4. Customers list + detail with stats.
    page.goto(BASE + '/pelanggan')
    page.get_by_text('2 pelanggan tersimpan').wait_for()
    shot(page, f'{name}-c4-list')
    page.get_by_role('button', name=re.compile('Bu Sari')).click()
    detail = page.get_by_role('dialog').inner_text()
    shot(page, f'{name}-c5-detail')
    page.get_by_role('button', name='Tutup').click()

    # 5. Duplicate phone is refused.
    page.get_by_role('button', name='Tambah pelanggan').click()
    page.locator('#customer-name').fill('Orang Lain')
    page.locator('#customer-phone').fill('+62 812 3456 7890')
    page.get_by_role('button', name='Simpan pelanggan').click()
    page.get_by_text('Nomor ini sudah dipakai oleh Bu Sari.').wait_for()
    page.get_by_role('button', name='Tutup').click()

    # 6. Delete erases contact data.
    page.get_by_role('button', name=re.compile('Mas Andi')).click()
    page.get_by_role('button', name='Hapus', exact=True).click()
    page.get_by_role('button', name='Hapus pelanggan').click()
    page.get_by_text('Mas Andi dihapus').wait_for()
    page.get_by_text('1 pelanggan tersimpan').wait_for()

    # 7. History search by customer name.
    page.goto(BASE + '/riwayat')
    page.get_by_role('searchbox', name='Cari transaksi').fill('sari')
    page.wait_for_timeout(300)
    history_hits = page.get_by_role('button', name='INV-').count()

    db = page.evaluate(READ_DB)
    browser.close()
    return {
        'receipt_has_customer': 'Pelanggan' in receipt and 'Bu Sari' in receipt,
        'wa_href_targets_customer': wa_href.startswith('https://wa.me/6281234567890?text='),
        'detail_has_one_visit': bool(re.search(r'Kunjungan\s*1', detail)) and 'Rp2.000' in detail,
        'history_hits_for_sari': history_hits,
        **db,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], run(p, *args))
print('ERRORS:', errors or 'none')
