"""Sell, refund, open Reports, export XLSX/PDF/CSV and verify the downloaded files (tablet + phone)."""
import csv
import io
import sys

import openpyxl
from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

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

def sell(page, product, is_mobile, qris=False):
    page.goto(BASE + '/')
    page.get_by_role('button', name=product).first.click()
    if page.get_by_role('button', name='Tambah ke pesanan').count():
        page.get_by_role('button', name='Tambah ke pesanan').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    if qris:
        page.get_by_role('button', name='QRIS').click()
        page.get_by_role('button', name='Sudah dibayar').click()
    else:
        page.get_by_role('button', name='Uang pas').click()
        page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_role('button', name='Transaksi baru').click()


def download(page, fmt_label, dataset=None):
    page.get_by_role('button', name='Ekspor').click()
    page.wait_for_timeout(400)  # let the sheet finish opening (v0.15 motion)
    page.get_by_role('radio', name=fmt_label).click()
    if dataset:
        page.get_by_role('radio', name=dataset, exact=True).click()
    with page.expect_download() as info:
        page.get_by_role('button', name='Unduh').click()
    dl = info.value
    path = f'{OUT}/{dl.suggested_filename}'
    dl.save_as(path)
    page.get_by_role('button', name='Tutup').click()
    page.get_by_role('dialog').wait_for(state='detached')
    return path


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile, accept_downloads=True).new_page()
    page.goto(BASE + '/')
    skip_with_sample_menu(page)  # first-time journey: empty store + test-only sample menu (ADR-018)
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('navigation').first.wait_for()
    open_register(page)
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))

    sell(page, 'Bakso Campur', is_mobile)              # 18.000 cash
    sell(page, 'Air Mineral', is_mobile, qris=True)    # 4.000 QRIS
    # refund the Air Mineral (QRIS) sale
    page.goto(BASE + '/riwayat')
    page.get_by_role('button', name='INV-').nth(0).click()
    page.get_by_role('button', name='Refund', exact=True).click()
    page.get_by_role('button', name='Pilih semua').click()
    page.get_by_role('button', name='Refund via').click()
    page.get_by_text('Refund berhasil dicatat').wait_for()

    page.goto(BASE + '/laporan')
    page.get_by_text('Penjualan per jam').wait_for()
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/{name}-r1-reports.png', full_page=True)
    kpi = page.locator('text=Penjualan bersih').first.locator('..').inner_text().replace('\n', ' ')

    xlsx = download(page, 'Excel')
    pdf = download(page, 'PDF')
    page.get_by_role('button', name='Ekspor').click()
    page.wait_for_timeout(400)  # let the sheet finish opening (v0.15 motion)
    page.get_by_role('radio', name='CSV').click()
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/{name}-r2-export.png')
    page.get_by_role('button', name='Tutup').click()
    page.get_by_role('dialog').wait_for(state='detached')
    csv_path = download(page, 'CSV', 'Refund')
    browser.close()

    wb = openpyxl.load_workbook(xlsx)
    summary = {row[0].value: row[1].value for row in wb['Ringkasan'].iter_rows() if row[0].value}
    with open(pdf, 'rb') as f:
        pdf_ok = f.read(5) == b'%PDF-'
    with open(csv_path, encoding='utf-8-sig') as f:
        refund_rows = list(csv.DictReader(io.StringIO(f.read())))
    return {
        'kpi': kpi,
        'sheets': wb.sheetnames,
        'xlsx_net': summary.get('Penjualan bersih'),
        'xlsx_net_is_number': isinstance(summary.get('Penjualan bersih'), (int, float)),
        'pdf_ok': pdf_ok,
        'csv_refunds': [(r['Jenis'], r['Metode Asal'], r['Jumlah']) for r in refund_rows],
        'files': [xlsx.split('/')[-1], pdf.split('/')[-1], csv_path.split('/')[-1]],
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], run(p, *args))
print('ERRORS:', errors or 'none')
