"""v0.19.5 admin shows the latest shop profile: a merchant signs up, then changes name, WhatsApp and address in
Pengaturan > Toko & Struk and syncs → the console's merchant list and sheet show the new details, not the sign-up ones.
Against the Vercel output served by scripts/vercel-local.mjs (DEV_MODE=1, ADMIN_PASSWORD set). Phone and tablet.
Usage: python3 e2e/v21.py http://localhost:4173 OUT ADMIN_PASSWORD"""
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from account import sign_up  # noqa: E402

BASE, OUT, ADMIN_PASSWORD = sys.argv[1:4]
APP = BASE + '/app'
errors = []
VIEWPORTS = {'phone': ({'width': 390, 'height': 844}, True), 'tablet': ({'width': 1024, 'height': 768}, False)}
NEW_PHONE, NEW_PHONE_SHOWN, NEW_ADDRESS = '0813 9999 0001', '+62 813-9999-0001', 'Jl. Kenanga No. 7, Bekasi'


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def new_page(browser, name, viewport, is_mobile):
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    ctx.add_init_script("localStorage.setItem('kk.dailyTotalsNotice.v2', '1')")
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))
    return page


def merchant(browser, name, viewport, is_mobile, email, old, new):
    page = new_page(browser, f'{name} merchant', viewport, is_mobile)
    page.goto(APP + '/')
    page.get_by_role('heading', name='Daftar akun Pikul').wait_for()
    sign_up(page, email, store=old, phone='0812 3456 7890', city='Bandung')
    page.get_by_role('button', name='Lewati', exact=True).click()
    page.get_by_role('navigation').first.wait_for()
    page.goto(APP + '/pengaturan?tab=store')
    page.get_by_label('Nama toko').fill(new)
    page.get_by_label('No. HP / WhatsApp').fill(NEW_PHONE)
    page.get_by_label('Alamat').fill(NEW_ADDRESS)
    page.get_by_role('button', name='Simpan perubahan').click()
    page.get_by_text('Pengaturan toko disimpan').wait_for()
    page.goto(APP + '/pengaturan?tab=sync')
    page.get_by_role('button', name='Sinkronkan sekarang').click()
    page.get_by_text('Data sudah tersinkron.').wait_for()
    page.context.close()


def admin(browser, name, viewport, is_mobile, email, old, new):
    page = new_page(browser, f'{name} admin', viewport, is_mobile)
    page.goto(BASE + '/admin/')
    page.locator('#admin-password').fill(ADMIN_PASSWORD)
    page.get_by_role('button', name='Masuk').click()
    menu = page.get_by_role('button', name='Buka menu')
    menu.or_(page.get_by_role('navigation', name='Menu konsol')).wait_for()
    if menu.is_visible():
        menu.click()
    page.get_by_role('navigation', name='Menu konsol').get_by_role('button', name=re.compile(r'^Merchant( \d+)?$')).click()
    page.get_by_role('searchbox').fill(email)
    page.wait_for_timeout(600)
    row = page.get_by_role('button', name=re.compile(re.escape(new)))
    row.wait_for()
    assert old not in row.inner_text(), 'list no longer shows the sign-up name'
    assert NEW_PHONE_SHOWN in row.inner_text(), 'list shows the new WhatsApp'
    shot(page, f'{name}-p1-list')
    row.click()
    region = page.get_by_role('dialog').get_by_role('region', name='Profil toko')
    region.wait_for()
    for text in (new, NEW_PHONE_SHOWN, NEW_ADDRESS, 'Bandung', email):
        assert text in region.inner_text(), f'sheet shows {text}'
    assert region.get_by_role('link', name=NEW_PHONE_SHOWN).get_attribute('href') == 'https://wa.me/6281399990001'
    region.scroll_into_view_if_needed()
    shot(page, f'{name}-p2-sheet')
    page.context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    for name, (viewport, is_mobile) in VIEWPORTS.items():
        stamp = int(time.time() * 1000)
        email = f'profil-{name}-{stamp}@warung.id'
        old, new = f'Warung Lama {name.title()}', f'Warung Baru {name.title()}'
        merchant(browser, name, viewport, is_mobile, email, old, new)
        admin(browser, name, viewport, is_mobile, email, old, new)
    browser.close()

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('ok')
