"""v0.19 device sync (ADR-024, ADR-025) against the Vercel output served by scripts/vercel-local.mjs (DEV_MODE=1).
Two browser contexts are two devices on one account:
A signs up, sets up the store, adds a menu, opens its register and sells → syncs.
B signs in → "Mengunduh data toko…" → lands on the cashier with A's menu and sale; B's own register is not open;
Kas → "Semua perangkat" shows A's sale. B renames the store → A gets it.
C signs in while the server is unreachable → "Buat toko baru saja" → once online the app asks which store to keep →
"Pakai toko dari akun" saves a backup file and downloads A's store. Phone and tablet.
Usage: python3 e2e/v19.py http://localhost:4173 OUT"""
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from account import sign_in, sign_up  # noqa: E402
from sample_menu import add_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1:3]
APP = BASE + '/app'
errors = []
VIEWPORTS = {'phone': ({'width': 390, 'height': 844}, True), 'tablet': ({'width': 1024, 'height': 768}, False)}

QUEUE_MENU_JS = """
async () => {
  const db = await new Promise((ok, fail) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  const keys = (store) => new Promise((ok) => { const r = db.transaction(store).objectStore(store).getAllKeys(); r.onsuccess = () => ok(r.result); });
  const now = new Date().toISOString();
  const rows = [];
  for (const table of ['categories', 'variantGroups', 'products']) for (const id of await keys(table)) rows.push({ table, recordId: id, op: 'upsert', queuedAt: now, attempts: 0 });
  const tx = db.transaction('outbox', 'readwrite');
  rows.forEach((r) => tx.objectStore('outbox').add(r));
  await new Promise((ok) => { tx.oncomplete = ok; });
  db.close();
}
"""


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def new_page(browser, name, viewport, is_mobile):
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile, accept_downloads=True)
    ctx.add_init_script("localStorage.setItem('kk.dailyTotalsNotice.v2', '1')")  # daily totals notice (ADR-020), not under test here
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))
    return page


def open_register(page):
    page.goto(APP + '/kas')
    page.get_by_role('button', name='Buka kasir').first.click()
    page.get_by_role('dialog').get_by_role('button', name='Buka kasir').click()
    page.get_by_role('dialog').wait_for(state='detached')


def sell(page, product, is_mobile):
    page.goto(APP + '/')
    page.get_by_role('button', name=product).first.click()
    if page.get_by_role('dialog').count() and page.get_by_role('button', name='Tambah ke pesanan').count():
        page.get_by_role('button', name='Tambah ke pesanan').click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_role('button', name='Transaksi baru').click()


def sync_now(page):
    page.goto(APP + '/pengaturan?tab=sync')
    page.get_by_role('button', name='Sinkronkan sekarang').click()
    page.get_by_text('Data sudah tersinkron.').wait_for()
    page.wait_for_timeout(3_500)  # the server hands rows to other devices after a 3 s settle window


def device_a(browser, name, viewport, is_mobile, email):
    page = new_page(browser, f'{name} A', viewport, is_mobile)
    page.goto(APP + '/')
    page.get_by_role('heading', name='Daftar akun Pikul').wait_for()
    sign_up(page, email, store='Warung Sinkron')
    page.get_by_role('button', name='Lewati', exact=True).click()
    page.get_by_role('navigation').first.wait_for()
    add_sample_menu(page)
    page.evaluate(QUEUE_MENU_JS)  # the test menu is written straight to IndexedDB; queue it like a merchant's edit
    open_register(page)
    sell(page, 'Kerupuk', is_mobile)
    sync_now(page)
    shot(page, f'{name}-s1-a-synced')
    return page


def device_b(browser, name, viewport, is_mobile, email):
    page = new_page(browser, f'{name} B', viewport, is_mobile)
    page.goto(APP + '/#masuk')
    sign_in(page, email)
    page.get_by_role('button', name='Kerupuk').first.wait_for(timeout=20_000)  # straight to the cashier, no store setup
    assert page.get_by_text('Bahasa / Language').count() == 0, 'no first-time journey on the second device'
    shot(page, f'{name}-s2-b-cashier')
    page.goto(APP + '/riwayat')
    page.get_by_role('button', name=re.compile('INV-')).first.wait_for()
    page.goto(APP + '/kas')
    page.get_by_role('button', name='Buka kasir').first.wait_for()  # B's drawer is its own: not open yet
    page.get_by_role('heading', name='Semua perangkat').wait_for()
    card = page.locator('section[aria-labelledby="all-devices"]')
    assert 'Perangkat ini' in card.inner_text() and 'Perangkat 1' in card.inner_text(), card.inner_text()
    card.scroll_into_view_if_needed()
    shot(page, f'{name}-s3-b-all-devices')
    page.goto(APP + '/pengaturan?tab=store')
    field = page.get_by_label('Nama toko')
    field.fill('Warung Sinkron Baru')
    page.get_by_role('button', name='Simpan perubahan').click()
    page.get_by_text('Pengaturan toko disimpan').wait_for()
    sync_now(page)
    shot(page, f'{name}-s4-b-sync-settings')
    page.context.close()


def device_c(browser, name, viewport, is_mobile, email):
    page = new_page(browser, f'{name} C', viewport, is_mobile)
    page.route('**/api/sync/**', lambda route: route.abort())
    page.goto(APP + '/#masuk')
    sign_in(page, email)
    page.get_by_role('button', name='Buat toko baru saja').click()
    page.get_by_role('button', name='Lewati', exact=True).click()
    page.get_by_role('navigation').first.wait_for()
    page.unroute('**/api/sync/**')
    page.reload()
    page.get_by_role('heading', name='Toko mana yang dipakai di perangkat ini?').wait_for(timeout=20_000)
    shot(page, f'{name}-s5-c-choice')
    with page.expect_download() as download:
        page.get_by_role('button', name='Pakai toko dari akun').click()
    assert download.value.suggested_filename.endswith('.json'), download.value.suggested_filename
    page.get_by_role('button', name='Kerupuk').first.wait_for(timeout=20_000)
    shot(page, f'{name}-s6-c-account-store')
    page.context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    for name, (viewport, is_mobile) in VIEWPORTS.items():
        email = f'sinkron-{name}-{int(time.time() * 1000)}@warung.id'
        a = device_a(browser, name, viewport, is_mobile, email)
        device_b(browser, name, viewport, is_mobile, email)
        sync_now(a)
        a.goto(APP + '/pengaturan?tab=store')
        a.get_by_label('Nama toko').wait_for()
        got = a.get_by_label('Nama toko').input_value()
        assert got == 'Warung Sinkron Baru', f'store name edited on B reached A, got {got!r}'
        a.context.close()
        device_c(browser, name, viewport, is_mobile, email)
        print(f'{name}: ok')
    browser.close()

if errors:
    print('ERRORS:', *errors, sep='\n  ')
    sys.exit(1)
print('v19 passed')
