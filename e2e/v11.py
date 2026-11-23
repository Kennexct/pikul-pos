"""v0.11 flow (tablet + phone, English device): the whole app in English — journey, sale, receipt, history, cash,
reports, products, customers, settings, help — with a scan for leftover Indonesian words on every screen.
Then switch to Indonesian in Settings and check that the choice survives a reload."""
import json
import re
import sys
import tempfile
from pathlib import Path

import openpyxl

from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import add_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []
# Common Indonesian interface words. Product names from the starter menu are merchant data and are not checked.
INDONESIAN = set('yang dan belum sudah untuk dengan tidak dari atau ini itu pesanan pelanggan kasir bayar simpan hapus tambah ubah tutup buka laporan riwayat pengaturan produk harga jumlah hari semua cari pilih struk diskon catatan nama toko laci uang tunai habis lainnya lanjut kembali batal penjualan pengeluaran pembayaran cadangan bantuan langkah kemarin bulan transaksi rata kotor bersih masuk keluar modal awal metode mode lunas'.split())
MERCHANT_WORDS = set('kopi susu gula aren teh tarik cokelat roti bakar kentang goreng hitam mode lemon tea matcha latte espresso cappuccino americano'.split())
leftovers = {}



def open_register(page, label='Buka kasir'):
    """v0.16 (ADR-017): the register must be opened before the first sale; open it with the suggested float."""
    back = page.url
    page.goto(BASE + '/kas')
    page.get_by_role('button', name=label).first.click()
    page.get_by_role('dialog').get_by_role('button', name=label).click()
    page.get_by_role('dialog').wait_for(state='detached')
    page.goto(back)

def scan(page, name, screen):
    """Record Indonesian words still visible on this screen."""
    page.wait_for_timeout(350)
    words = re.findall(r"[a-zà-ÿ]+", page.inner_text('body').lower())
    found = sorted({w for w in words if w in INDONESIAN and w not in MERCHANT_WORDS})
    if found:
        leftovers[f'{name}:{screen}'] = found
    page.screenshot(path=f'{OUT}/{name}-y-{screen}.png')


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    context = browser.new_context(locale='en-US', accept_downloads=True, viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')

    # Journey in English (device language), coffee sample menu.
    page.goto(BASE + '/')
    page.get_by_role('heading', name='Bahasa / Language').wait_for()
    english_preselected = page.get_by_role('radio', name='English').get_attribute('aria-checked') == 'true'
    scan(page, name, 'journey-language')
    page.get_by_role('button', name='Continue').click()
    page.locator('#store-name').fill('Sunset Coffee')
    scan(page, name, 'journey-shop')
    page.get_by_role('button', name='Continue').click()
    scan(page, name, 'journey-payments')
    page.get_by_role('button', name='Continue').click()
    scan(page, name, 'journey-how')
    page.get_by_role('button', name='Start selling').click()
    page.get_by_role('navigation').first.wait_for()
    add_sample_menu(page, 'kopi')  # v0.17: the store starts empty (ADR-018)
    open_register(page, 'Open register')

    # Sale with a variant, cash.
    page.get_by_role('button', name=re.compile('^Kopi')).first.click()
    page.get_by_role('radio', name=re.compile('^Americano')).click()
    scan(page, name, 'variant-sheet')
    page.get_by_role('button', name='Add to order').click()
    page.get_by_role('button', name=re.compile('Roti Bakar')).first.click()
    if is_mobile:
        page.get_by_role('button', name='View order').click()
    scan(page, name, 'register')
    page.get_by_role('button', name='Pay').click()
    scan(page, name, 'payment')
    page.get_by_role('button', name='Exact amount').click()
    page.get_by_role('button', name='Complete payment').click()
    page.get_by_text('Payment successful').wait_for()
    receipt = page.locator('.receipt').inner_text()
    whatsapp = page.get_by_role('link', name=re.compile('WhatsApp')).first.get_attribute('href')
    scan(page, name, 'receipt')
    page.get_by_role('button', name='New sale').click()
    seeded = page.evaluate("""async () => {
      const db = await new Promise((res) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); });
      const all = (n) => new Promise((res) => { const r = db.transaction(n).objectStore(n).getAll(); r.onsuccess = () => res(r.result); });
      return { categories: (await all('categories')).map((c) => c.name).sort(), methods: (await all('paymentMethods')).map((m) => m.name).sort(), groups: (await all('variantGroups')).map((g) => g.name).sort() };
    }""")

    # Every main screen.
    for path, screen in [('/pesanan', 'orders'), ('/riwayat', 'history'), ('/kas', 'cash'), ('/laporan', 'reports'), ('/produk', 'products'), ('/pelanggan', 'customers'), ('/bantuan', 'help'), ('/lainnya', 'more')]:
        page.goto(BASE + path)
        scan(page, name, screen)
        if screen == 'history':
            page.get_by_role('button', name=re.compile('INV-')).first.click()
            scan(page, name, 'history-detail')
            dialog.get_by_role('button', name='Refund', exact=True).click()
            scan(page, name, 'refund-sheet')
            page.keyboard.press('Escape')
        if screen == 'cash':
            page.get_by_role('button', name='Record expense').first.click()
            scan(page, name, 'expense-sheet')
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Close register', exact=True).click()
            scan(page, name, 'close-sheet')
            page.keyboard.press('Escape')
        if screen == 'reports':
            page.get_by_role('button', name='Export report').click()
            scan(page, name, 'export-sheet')
            dialog.get_by_role('radio', name=re.compile('Excel')).click()
            with page.expect_download() as info:
                dialog.get_by_role('button', name='Download').click()
            xlsx = Path(tempfile.mkdtemp()) / info.value.suggested_filename
            info.value.save_as(xlsx)
            workbook = openpyxl.load_workbook(xlsx)
            sheet_names = workbook.sheetnames
            summary_labels = [row[0] for row in workbook[sheet_names[0]].iter_rows(values_only=True) if row[0]][:8]
            page.keyboard.press('Escape')
        if screen == 'products':
            page.get_by_role('button', name=re.compile('^Kopi')).first.click()
            scan(page, name, 'product-form')
            page.keyboard.press('Escape')
        if screen == 'customers':
            page.get_by_role('button', name='Add customer').first.click()
            scan(page, name, 'customer-form')
            page.keyboard.press('Escape')
        if screen == 'help':
            page.get_by_role('button', name='History, void and refund').click()
            scan(page, name, 'help-topic')
    for tab in ['store', 'payments', 'modes', 'staff', 'backup']:
        page.goto(f'{BASE}/pengaturan?tab={tab}')
        scan(page, name, f'settings-{tab}')

    # Switch to Indonesian; the choice is per device and survives a reload.
    page.goto(BASE + '/pengaturan?tab=store')
    page.get_by_role('radio', name='Bahasa Indonesia').click()
    page.get_by_role('heading', name='Pengaturan').wait_for()
    page.goto(BASE + '/')
    page.get_by_role('link', name='Transaksi', exact=True).first.wait_for()
    stays_indonesian = page.evaluate("localStorage.getItem('kasirku-lang')") == 'id' and page.get_by_role('link', name='Transaksi', exact=True).count() > 0
    browser.close()
    return {
        'english_preselected': english_preselected,
        'receipt_in_english': all(w in receipt for w in ['Cashier', 'TOTAL', 'Change', 'Time']) and 'Kasir' not in receipt,
        'whatsapp_text_in_english': 'Thank%20you' in whatsapp or 'Thank you' in whatsapp,
        'seeded_in_english': seeded,
        'excel_sheets': sheet_names,
        'excel_summary_labels': summary_labels,
        'switch_to_indonesian_persists': stays_indonesian,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], json.dumps(run(p, *args), ensure_ascii=False))
print('LEFTOVER INDONESIAN:', json.dumps(leftovers, ensure_ascii=False) if leftovers else 'none')
print('ERRORS:', errors or 'none')
