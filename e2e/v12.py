"""v0.12 flow (tablet + phone): a market seller — turn on weight units, make a product sold per kg with a flexible
price, sell it by weight, by money amount and at a changed price, check the receipt, history, Excel and a whole-line refund.
Also a flexible-price product sold by the piece."""
import json
import re
import sys
import tempfile
from pathlib import Path

import openpyxl
from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); });
  const all = (n) => new Promise((res) => { const r = db.transaction(n).objectStore(n).getAll(); r.onsuccess = () => res(r.result); });
  const [orders, products, refunds, stores] = await Promise.all(['orders', 'products', 'refunds', 'stores'].map(all));
  const order = orders.find((o) => o.items.some((i) => i.unit === 'kg'));
  return {
    setting: stores[0].settings.isWeightSaleEnabled,
    product: products.filter((p) => p.name === 'Cabai Merah').map((p) => ({ unit: p.unit, flexible: p.isPriceEditable, base: p.basePrice, cost: p.costPrice }))[0],
    lines: order.items.map((i) => ({ name: i.nameSnapshot, unit: i.unit ?? 'pcs', qty: Math.round(i.qty * 1000) / 1000, price: i.unitPrice, normal: i.listPrice ?? null, cost: i.unitCost ?? null })),
    total: order.totals.grandTotal,
    status: order.status,
    refunds: refunds.map((r) => ({ amount: r.amount, qty: r.items.map((i) => Math.round(i.qty * 1000) / 1000) })),
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
    page = browser.new_context(locale='id-ID', accept_downloads=True, viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')

    page.goto(BASE + '/produk')
    skip_with_sample_menu(page)  # first-time journey: empty store + test-only sample menu (ADR-018)
    page.get_by_role('navigation').first.wait_for()
    page.get_by_role('navigation').first.wait_for()
    open_register(page)

    # 1. Without the setting the product form has no unit choice; turn it on in Settings.
    page.get_by_role('button', name='Produk', exact=True).first.click()
    unit_hidden_by_default = dialog.get_by_role('radiogroup', name='Dijual per').count() == 0
    page.keyboard.press('Escape')
    page.goto(BASE + '/pengaturan?tab=modes')  # v0.19.2: moved to Mode Penjualan, saves on tap
    page.get_by_text('Aktifkan satuan berat dan ukuran').click()
    page.get_by_text('Satuan berat dan ukuran aktif').wait_for()
    shot(page, f'{name}-z1-setting')

    # 2. Product per kg, Rp40.000/kg, cost Rp30.000/kg, flexible price. Kerupuk becomes flexible too (per piece).
    page.goto(BASE + '/produk')
    page.get_by_role('button', name='Produk', exact=True).first.click()
    page.locator('#product-name').fill('Cabai Merah')
    dialog.get_by_role('radio', name='Kilogram (kg)').click()
    page.locator('#base-price').fill('40000')
    page.locator('#cost-price').fill('30000')
    dialog.get_by_role('button', name=re.compile('^Pengaturan lain')).click()  # v0.20: rarely used switches fold away
    dialog.get_by_text('Harga bisa diubah saat jual').click()
    dialog.get_by_text('Untung per kg Rp10.000').wait_for()
    shot(page, f'{name}-z2-product-form')
    page.get_by_role('button', name='Simpan produk').click()
    page.get_by_text('Cabai Merah').first.wait_for()
    page.get_by_role('button', name=re.compile('^Kerupuk')).first.click()
    dialog.get_by_role('button', name=re.compile('^Pengaturan lain')).click()
    dialog.get_by_text('Harga bisa diubah saat jual').click()
    page.get_by_role('button', name='Simpan produk').click()
    page.locator('#product-name').wait_for(state='hidden')

    # 3. Sell: 0,75 kg at the normal price; "Rp10.000 worth" at Rp30.000/kg; one Kerupuk at Rp2.500.
    page.goto(BASE + '/')
    tile = page.get_by_role('button', name=re.compile('Cabai Merah')).first
    tile_text = tile.inner_text()
    tile.click()
    page.locator('#entry-quantity').fill('0,75')
    shot(page, f'{name}-z3-entry-weight')
    add_label = dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).inner_text()
    dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).click()

    tile.click()
    dialog.get_by_role('radio', name='Nominal (Rp)').click()
    page.locator('#entry-price').fill('30000')
    page.locator('#entry-amount').fill('10000')
    dialog.get_by_text('Timbang 0,333 kg').wait_for()
    shot(page, f'{name}-z4-entry-amount')
    dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).click()

    page.get_by_role('button', name=re.compile('^Kerupuk')).first.click()
    page.locator('#entry-price').fill('2500')
    dialog.get_by_role('button', name=re.compile('Tambah ke pesanan')).click()

    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    cart_text = (dialog if is_mobile else page.locator('aside, section').last).inner_text()
    shot(page, f'{name}-z5-cart')
    # Change the first weighing to 1 kg through the cart line, then back to 0,75.
    page.get_by_role('button', name='Ubah berat Cabai Merah').first.click()
    page.locator('#entry-quantity').fill('1')
    page.get_by_role('dialog').last.get_by_role('button', name=re.compile('Simpan perubahan')).click()
    page.get_by_role('button', name='Ubah berat Cabai Merah').first.click()
    page.locator('#entry-quantity').fill('0.75')
    page.get_by_role('dialog').last.get_by_role('button', name=re.compile('Simpan perubahan')).click()

    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    receipt = page.locator('.receipt').inner_text()
    shot(page, f'{name}-z6-receipt')
    page.get_by_role('button', name='Transaksi baru').click()

    # 4. History: changed prices are flagged; refund the first weighing whole.
    page.goto(BASE + '/riwayat')
    page.get_by_role('button', name=re.compile('INV-')).first.click()
    note = dialog.get_by_text('Harga diubah saat jual').locator('..').inner_text()
    shot(page, f'{name}-z7-history-detail')
    dialog.get_by_role('button', name='Refund', exact=True).click()
    page.get_by_role('button', name='Tambah refund Cabai Merah').first.click()
    refund_sheet = page.get_by_role('dialog').last.inner_text()
    shot(page, f'{name}-z8-refund')
    page.get_by_role('dialog').last.get_by_role('button', name='Salah input').click()
    page.get_by_role('dialog').last.get_by_role('button', name=re.compile('^Refund')).last.click()
    page.get_by_text('Refund berhasil dicatat').wait_for()

    # 5. Reports: best sellers show the weight; Excel has unit and normal-price columns.
    page.goto(BASE + '/laporan')
    page.get_by_role('radio', name='Qty').click()
    top = page.get_by_text('Produk terlaris').locator('xpath=ancestor::section[1]').inner_text()
    profit = page.get_by_role('region', name='Laba').inner_text()
    shot(page, f'{name}-z9-report')
    page.get_by_role('button', name='Ekspor laporan').click()
    dialog.get_by_role('radio', name=re.compile('Excel')).click()
    with page.expect_download() as info:
        dialog.get_by_role('button', name='Unduh').click()
    xlsx = Path(tempfile.mkdtemp()) / info.value.suggested_filename
    info.value.save_as(xlsx)
    sheet = openpyxl.load_workbook(xlsx)['Item']
    rows = list(sheet.iter_rows(values_only=True))
    header = list(rows[0])
    pick = lambda row: {h: row[header.index(h)] for h in ['Produk', 'Qty', 'Satuan', 'Harga Satuan', 'Harga Normal', 'Total Baris']}

    db = page.evaluate(READ_DB)
    browser.close()
    return {
        'unit_hidden_until_setting_on': unit_hidden_by_default,
        'tile_shows_per_kg': 'Rp40.000/kg' in tile_text,
        'add_button_shows_total': 'Rp30.000' in add_label,
        'cart_ok': all(s in cart_text for s in ['0,75 kg × Rp40.000/kg', '0,333 kg × Rp30.000/kg', 'harga diubah', 'Rp42.500']),
        'receipt_ok': all(s in receipt for s in ['0,75 kg × Rp40.000', '0,333 kg × Rp30.000', 'Rp10.000', '1 × Rp2.500', 'Rp42.500']),
        'history_note': note.replace('\n', ' | '),
        'refund_sheet_ok': 'sisa 0,75 kg dari 0,75 kg' in refund_sheet and 'Rp30.000' in refund_sheet,
        'top_products_ok': '1,083 kg' in top and '1×' in top,
        'profit_has_cogs': 'Harga modal (HPP)' in profit and 'Rp32.500' in profit,
        'excel_rows': [pick(r) for r in rows[1:]],
        **db,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], json.dumps(run(p, *args), ensure_ascii=False))
print('ERRORS:', errors or 'none')
