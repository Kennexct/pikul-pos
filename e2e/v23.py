"""v0.20.1 recognisable devices, against the Vercel output served by scripts/vercel-local.mjs (DEV_MODE=1).
Three browser contexts on one account, each with a real phone/tablet/computer user agent:
A signs up and syncs. B opens in a (simulated) private window: the sign-in page and the app warn about it; B signs in,
downloads the store and syncs, then its window closes. C signs in → Pengaturan → Sinkronisasi lists every device by
browser and system, "Perangkat ini" on C, "Jendela penyamaran" on B, last active, and "Tidak aktif 9 hari" once B has
been quiet for 9 days (the list response is aged in the test). C renames A to "Kasir depan" and removes B.
Usage: python3 e2e/v23.py http://localhost:4173 OUT"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from account import sign_in, sign_up  # noqa: E402

BASE, OUT = sys.argv[1:3]
APP = BASE + '/app'
errors = []
DAY_MS = 86_400_000

UA = {
    'android': 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'androidTablet': 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'iphone': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'ipad': 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'samsung': 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    'windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
}
RUNS = {
    'phone': ({'width': 390, 'height': 844}, True, ('android', 'Chrome · Android'), ('iphone', 'Safari · iPhone'), ('samsung', 'Samsung Internet · Android')),
    'tablet': ({'width': 1024, 'height': 768}, False, ('androidTablet', 'Chrome · Tablet Android'), ('ipad', 'Safari · iPad'), ('windows', 'Edge · Windows')),
}

# Chromium gives an incognito window a storage quota under twice the JS heap limit; headless does not, so B fakes it.
PRIVATE_WINDOW_JS = """
Object.defineProperty(navigator.storage, 'estimate', { value: async () => ({ quota: 120 * 1024 * 1024, usage: 0 }) });
"""
DEVICE_ID_JS = """
async () => {
  const db = await new Promise((ok, fail) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  const row = await new Promise((ok) => { const r = db.transaction('meta').objectStore('meta').get('deviceId'); r.onsuccess = () => ok(r.result); });
  db.close();
  return row.value;
}
"""


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def new_page(browser, name, viewport, is_mobile, ua, private=False):
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile, user_agent=UA[ua])
    ctx.add_init_script("localStorage.setItem('kk.dailyTotalsNotice.v2', '1')")  # daily totals notice (ADR-020), not under test here
    if private:
        ctx.add_init_script(PRIVATE_WINDOW_JS)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))
    return page


def sync_now(page):
    page.goto(APP + '/pengaturan?tab=sync')
    page.get_by_role('button', name='Sinkronkan sekarang').click()
    page.get_by_text('Data sudah tersinkron.').wait_for()
    page.wait_for_timeout(3_500)  # the server hands rows to other devices after a 3 s settle window


def run(browser, name, viewport, is_mobile, a, b, c):
    email = f'perangkat-{name}-{int(time.time() * 1000)}@warung.id'
    warning = 'Sepertinya ini jendela penyamaran.'

    pa = new_page(browser, f'{name} A', viewport, is_mobile, a[0])
    pa.goto(APP + '/')
    pa.get_by_role('heading', name='Daftar akun Pikul').wait_for()
    assert pa.get_by_text(warning).count() == 0, 'no private-window warning in a normal window'
    sign_up(pa, email, store='Warung Perangkat')
    pa.get_by_role('button', name='Lewati', exact=True).click()
    pa.get_by_role('navigation').first.wait_for()
    sync_now(pa)

    pb = new_page(browser, f'{name} B', viewport, is_mobile, b[0], private=True)
    pb.goto(APP + '/#masuk')
    pb.get_by_text(warning).wait_for()
    shot(pb, f'{name}-d1-private-signin')
    sign_in(pb, email)
    pb.get_by_role('navigation').first.wait_for(timeout=20_000)  # the account's store downloads, no store setup
    pb.get_by_text(warning).wait_for()
    shot(pb, f'{name}-d2-private-app')
    pb.get_by_role('button', name='Tutup peringatan').click()
    assert pb.get_by_text(warning).count() == 0, 'warning closes'
    sync_now(pb)
    b_id = pb.evaluate(DEVICE_ID_JS)
    pb.context.close()  # the private window closes: its data is gone

    pc = new_page(browser, f'{name} C', viewport, is_mobile, c[0])

    def age_b(route):
        resp = route.fetch()
        data = resp.json()
        for d in data.get('devices', []):
            if d['deviceId'] == b_id:
                d['lastSeen'] -= 9 * DAY_MS
        route.fulfill(response=resp, body=json.dumps(data))

    pc.route('**/api/sync/devices**', age_b)  # list, rename and remove all answer with the list
    pc.goto(APP + '/#masuk')
    sign_in(pc, email)
    pc.get_by_role('navigation').first.wait_for(timeout=20_000)
    sync_now(pc)
    section = pc.locator('section', has=pc.get_by_role('heading', name='Perangkat', exact=True)).last
    rows = section.locator('li')
    rows.nth(2).wait_for()
    texts = [rows.nth(i).inner_text() for i in range(rows.count())]
    assert c[1] in texts[0] and 'Perangkat ini' in texts[0], texts
    assert a[1] in texts[1] and 'Aktif sekarang' in texts[1], texts
    assert b[1] in texts[2] and 'Jendela penyamaran' in texts[2] and 'Tidak aktif 9 hari' in texts[2], texts
    assert section.get_by_role('button', name=f'Hapus {c[1]}').count() == 0, 'this device cannot be removed'
    section.scroll_into_view_if_needed()
    shot(pc, f'{name}-d3-device-list')

    section.get_by_role('button', name=f'Ganti nama {a[1]}').click()
    section.get_by_label('Nama perangkat').fill('Kasir depan')
    section.get_by_role('button', name='Simpan').click()
    section.get_by_text('Kasir depan').wait_for()
    assert a[1] in section.locator('li', has_text='Kasir depan').inner_text(), 'renamed device still shows its browser and system'

    section.get_by_role('button', name=f'Hapus {b[1]}').click()
    section.get_by_text(f'Hapus {b[1]} dari daftar?').wait_for()
    shot(pc, f'{name}-d4-remove-confirm')
    section.get_by_role('button', name='Hapus', exact=True).click()
    pc.get_by_text(f'{b[1]} dihapus dari daftar.').wait_for()
    assert rows.count() == 2, [rows.nth(i).inner_text() for i in range(rows.count())]
    shot(pc, f'{name}-d5-after-remove')
    pc.context.close()
    pa.context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    for name, (viewport, is_mobile, a, b, c) in RUNS.items():
        run(browser, name, viewport, is_mobile, a, b, c)
        print(f'{name}: ok')
    browser.close()

if errors:
    print('ERRORS:', *errors, sep='\n  ')
    sys.exit(1)
print('v23 passed')
