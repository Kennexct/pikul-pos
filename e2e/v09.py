"""v0.9 flow (tablet + phone): cost price -> profit in Reports (+ Excel), expenses, close of day (difference, reopen,
sold-out reset, WhatsApp summary), and backup -> change data -> restore (plus a bad file)."""
import json
import re
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote

import openpyxl
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (name) => new Promise((res, rej) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const [orders, expenses, closings, products, meta, audit, outbox] = await Promise.all(['orders', 'expenses', 'dayClosings', 'products', 'meta', 'auditEvents', 'outbox'].map(all));
  const live = closings.filter((c) => !c.deletedAt);
  return {
    orders: orders.length,
    unit_costs: orders.flatMap((o) => o.items.map((i) => [i.nameSnapshot, i.unitCost ?? null])),
    expenses: expenses.filter((e) => !e.deletedAt).length,
    closings_total: closings.length,
    live_closing: live.map((c) => ({ expected: c.expectedCash, counted: c.countedCash, diff: c.difference })),
    sold_out: products.filter((p) => p.isSoldOut).length,
    meta_keys: meta.map((m) => m.key).filter((k) => ['restoredAt', 'lastBackupAt'].includes(k)).sort(),
    audit: [...new Set(audit.map((a) => a.action))].sort(),
    outbox: outbox.length,
  };
}"""


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def toasts_gone(page):
    """Toasts pause while the mouse rests on them; park the pointer and wait so they cannot cover the header tabs."""
    page.mouse.move(2, page.viewport_size['height'] - 2)
    page.locator('[data-rht-toaster] [role=status]').first.wait_for(state='hidden')


def sell(page, is_mobile, product, method):
    page.goto(BASE + '/')
    page.get_by_role('button', name=product).first.click()
    page.wait_for_timeout(300)  # products with variants open a sheet first
    if page.get_by_role('button', name='Tambah ke pesanan').count():
        page.get_by_role('button', name='Tambah ke pesanan').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    if method == 'cash':
        page.get_by_role('button', name='Uang pas').click()
        page.get_by_role('button', name='Selesaikan pembayaran').click()
    else:
        page.get_by_role('dialog').get_by_role('button', name=method, exact=True).click()
        page.get_by_text('Total yang harus dibayar').wait_for()  # choosing QRIS opens the code screen
        page.get_by_role('button', name='Sudah dibayar').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.get_by_role('button', name='Transaksi baru').click()


def add_expense(page, amount, category, note, from_drawer=True):
    page.get_by_role('button', name='Catat pengeluaran').first.click()
    dialog = page.get_by_role('dialog')
    page.locator('#expense-amount').fill(amount)
    dialog.get_by_role('radio', name=category).click()
    page.locator('#expense-note').fill(note)
    if not from_drawer:
        dialog.get_by_text('Dibayar dari uang laci').click()
    return dialog


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile, accept_downloads=True).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')
    main = page.locator('section').first

    # 1. Cost price on one product; the other stays without.
    page.goto(BASE + '/produk')
    page.get_by_role('button', name='Lewati, pakai contoh toko').click()  # first-time journey: take the example store
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    page.get_by_role('button', name=re.compile('^Kerupuk')).first.click()
    page.locator('#cost-price').fill('1200')
    page.get_by_text('Untung per porsi Rp800').wait_for()
    shot(page, f'{name}-w1-cost-price')
    page.get_by_role('button', name='Simpan produk').click()
    page.get_by_text(re.compile('disimpan|diperbarui')).first.wait_for()

    # 2. Two sales: Kerupuk cash (Rp2.000, cost 1.200) and Es Teh by QRIS (no cost); mark one item sold out.
    sell(page, is_mobile, 'Kerupuk', 'cash')
    sell(page, is_mobile, 'Es Teh', 'QRIS')
    page.get_by_role('button', name='Tandai stok habis').click()
    dialog.get_by_text('Air Mineral', exact=True).click()
    dialog.get_by_text('Habis, tidak bisa dijual').wait_for()
    page.get_by_role('button', name='Tutup').click()

    # 3. Kas: opening cash, two expenses (one from the drawer, one not).
    page.goto(BASE + '/kas')
    page.get_by_role('button', name='Ubah').click()
    page.locator('#opening-cash').fill('100000')
    page.get_by_role('button', name='Simpan modal awal').click()
    add_expense(page, '500', 'Belanja bahan', 'es batu')
    shot(page, f'{name}-w2-expense-sheet')
    page.get_by_role('button', name='Simpan pengeluaran').click()
    page.get_by_text('Pengeluaran dicatat').wait_for()
    add_expense(page, '20000', 'Gaji & upah', 'upah harian', from_drawer=False)
    page.get_by_role('button', name='Simpan pengeluaran').click()
    page.get_by_text('Rp101.500').wait_for()  # 100.000 + 2.000 cash − 500 drawer expense
    shot(page, f'{name}-w3-kas-today')
    drawer_text = main.inner_text()

    # 4. Close the day Rp1.000 short; sold-out flags reset; WhatsApp summary; then a late sale makes it stale.
    page.get_by_role('button', name='Tutup kasir', exact=True).click()
    page.locator('#counted-cash').fill('100500')
    dialog.get_by_text('Selisih: kurang Rp1.000').wait_for()
    shot(page, f'{name}-w4-close-sheet')
    dialog.get_by_role('button', name='Tutup kasir', exact=True).click()
    page.get_by_text('Kasir ditutup, selisih kurang Rp1.000').wait_for()
    summary = unquote(page.get_by_role('link', name='Kirim ringkasan').get_attribute('href'))
    shot(page, f'{name}-w5-kas-closed')
    after_close = page.evaluate(READ_DB)

    sell(page, is_mobile, 'Kerupuk', 'cash')
    page.goto(BASE + '/kas')
    page.get_by_text('Ada transaksi atau pengeluaran setelah kasir ditutup').wait_for()
    page.get_by_role('button', name='Buka kembali').click()
    dialog.get_by_role('button', name='Buka kembali').click()
    page.get_by_text('Kasir dibuka kembali').wait_for()
    page.get_by_role('button', name='Tutup kasir', exact=True).click()
    page.locator('#counted-cash').fill('103500')
    dialog.get_by_text('Pas, tidak ada selisih.').wait_for()
    dialog.get_by_role('button', name='Tutup kasir', exact=True).click()
    page.get_by_text('Kasir ditutup, uang laci pas').wait_for()
    toasts_gone(page)
    page.get_by_role('tab', name='Riwayat tutup').click()
    page.get_by_text('Pas', exact=True).wait_for()
    shot(page, f'{name}-w6-closing-history')
    history_rows = page.locator('main li, section li').count()
    page.get_by_role('tab', name='Pengeluaran').click()
    page.get_by_text('Total pengeluaran').wait_for()
    shot(page, f'{name}-w7-expenses')

    # 5. Reports: profit statement in cost mode, warning for the uncosted item, Excel carries both.
    page.goto(BASE + '/laporan')
    profit = page.get_by_role('region', name='Laba')
    profit.get_by_text('Laba bersih').wait_for()
    profit_text = profit.inner_text()
    profit.scroll_into_view_if_needed()
    shot(page, f'{name}-w8-profit')
    page.get_by_role('button', name='Ekspor laporan').click()
    dialog.get_by_role('radio', name=re.compile('Excel')).click()
    with page.expect_download() as info:
        dialog.get_by_role('button', name=re.compile('Unduh|Bagikan|Ekspor')).last.click()
    xlsx = Path(tempfile.mkdtemp()) / info.value.suggested_filename
    info.value.save_as(xlsx)
    wb = openpyxl.load_workbook(xlsx)
    summary_rows = {row[0]: row[1] for row in wb['Ringkasan'].iter_rows(values_only=True) if row[0]}
    expense_rows = [row for row in wb['Pengeluaran'].iter_rows(values_only=True)][1:] if 'Pengeluaran' in wb.sheetnames else []
    page.get_by_role('button', name='Tutup').click()

    # 6. Backup -> record one more expense -> restore the file -> the extra expense is gone.
    page.goto(BASE + '/pengaturan?tab=backup')
    page.get_by_text('belum pernah').wait_for()
    with page.expect_download() as info:
        page.get_by_role('button', name='Simpan cadangan').click()
    backup_path = Path(tempfile.mkdtemp()) / info.value.suggested_filename
    info.value.save_as(backup_path)
    backup = json.loads(backup_path.read_text())
    page.get_by_text('Cadangan disimpan').wait_for()
    shot(page, f'{name}-w9-backup')

    page.goto(BASE + '/kas')
    add_expense(page, '7000', 'Transportasi', 'setelah cadangan')
    page.get_by_role('button', name='Simpan pengeluaran').click()
    page.get_by_text('Pengeluaran dicatat').wait_for()
    before_restore = page.evaluate(READ_DB)

    page.goto(BASE + '/pengaturan?tab=backup')
    bad = Path(tempfile.mkdtemp()) / 'bukan-cadangan.json'
    bad.write_text('{"app": "lain"}')
    page.get_by_label('Berkas cadangan').set_input_files(str(bad))
    page.get_by_text('Ini bukan berkas cadangan Pikul.').wait_for()
    page.get_by_label('Berkas cadangan').set_input_files(str(backup_path))
    dialog.get_by_text('Pulihkan cadangan ini?').wait_for()
    restore_blocked = dialog.get_by_role('button', name='Ganti semua data').is_disabled()
    shot(page, f'{name}-w10-restore-sheet')
    dialog.get_by_text('Saya mengerti data di perangkat ini akan diganti.').click()
    dialog.get_by_role('button', name='Ganti semua data').click()
    page.wait_for_url(BASE + '/')
    page.get_by_role('button', name='Kerupuk').first.wait_for()
    after_restore = page.evaluate(READ_DB)

    browser.close()
    return {
        'drawer_ok': all(t in drawer_text for t in ['Rp100.000', '+ Rp2.000', '− Rp500', 'Rp101.500', 'QRIS']),
        'first_closing': after_close['live_closing'],
        'sold_out_after_close': after_close['sold_out'],
        'summary_ok': 'Seharusnya: Rp101.500' in summary and 'Selisih: kurang Rp1.000' in summary and summary.startswith('https://wa.me/?text=Tutup kasir'),
        'closing_history_rows': history_rows,
        'profit_ok': all(t in profit_text for t in ['Harga modal (HPP)', '− Rp2.400', 'Biaya operasional', '− Rp20.000', 'Belanja bahan', 'Rp500', 'Es Teh']),
        'xlsx_cogs': summary_rows.get('Harga modal (HPP)'),
        'xlsx_net_profit_reconciles': summary_rows.get('Laba bersih') == summary_rows.get('Penjualan bersih') - 2400 - 20000,
        'xlsx_expenses': [(r[1], r[3], r[4]) for r in expense_rows],
        'backup_file': {'app': backup['app'], 'orders': backup['counts']['orders'], 'has_outbox': 'outbox' in backup['tables']},
        'expenses_before_restore': before_restore['expenses'],
        'restore_needs_confirmation': restore_blocked,
        'after_restore': after_restore,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], json.dumps(run(p, *args), ensure_ascii=False))
print('ERRORS:', errors or 'none')
