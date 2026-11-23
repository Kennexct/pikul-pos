"""v0.18 (ADR-022, ADR-023) against the Vercel output served by scripts/vercel-local.mjs (DEV_MODE=1, ADMIN_PASSWORD set):
merchant signs up (bad WhatsApp number first) → first-time setup has the store name prefilled →
a second device: wrong password, forgot password (no email: contact admin), right password →
admin console: merchant list shows the sign-up details, search by WhatsApp, sheet shows them, temporary password →
merchant signs in with it. Phone and tablet.
Usage: python3 e2e/v18.py http://localhost:4173 OUT ADMIN_PASSWORD"""
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from account import PASSWORD, sign_in, sign_up  # noqa: E402

BASE, OUT, ADMIN_PASSWORD = sys.argv[1:4]
errors = []
VIEWPORTS = {'phone': ({'width': 390, 'height': 844}, True), 'tablet': ({'width': 1024, 'height': 768}, False)}


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def new_page(browser, name, viewport, is_mobile):
    page = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))
    return page


def merchant(browser, name, viewport, is_mobile, email, store):
    page = new_page(browser, f'{name} sign-up', viewport, is_mobile)
    page.goto(BASE + '/app/')
    page.get_by_role('heading', name='Daftar akun Pikul').wait_for()  # a fresh device opens on "Daftar"
    sign_up_form = dict(store=store, owner='Siti Aminah', city='Yogyakarta')
    page.locator('#signup-ownerName').fill('Siti Aminah')
    page.locator('#signup-storeName').fill(store)
    page.locator('#signup-phone').fill('021 555 1234')
    page.locator('#signup-city').fill('Yogyakarta')
    page.locator('#signup-email').fill(email)
    page.locator('#signup-password').fill(PASSWORD)
    page.get_by_role('button', name='Daftar dan mulai 14 hari gratis').click()
    page.get_by_role('alert').filter(has_text='Nomor WhatsApp tidak valid').wait_for()
    shot(page, f'{name}-m1-signup-error')
    sign_up(page, email, phone='0813-1111-2222', **sign_up_form)
    page.get_by_role('button', name='Lanjut').click()
    assert page.locator('#store-name').input_value() == store, 'store name prefilled from sign-up'
    shot(page, f'{name}-m2-setup-prefilled')
    page.context.close()

    page = new_page(browser, f'{name} sign-in', viewport, is_mobile)
    page.goto(BASE + '/app/#masuk')
    page.get_by_role('heading', name='Masuk ke Pikul').wait_for()
    sign_in(page, email, 'salah-sekali-1')
    page.get_by_role('alert').filter(has_text='Email atau kata sandi salah').wait_for()
    page.get_by_role('button', name='Lupa kata sandi?').click()
    page.get_by_text('Hubungi admin Pikul').wait_for()
    shot(page, f'{name}-m3-forgot')
    page.get_by_role('button', name='Kembali ke masuk').click()
    sign_in(page, email)
    page.get_by_text('Bahasa / Language').wait_for()
    page.context.close()


def admin(browser, name, viewport, is_mobile, email, store):
    page = new_page(browser, f'{name} admin', viewport, is_mobile)
    page.goto(BASE + '/admin/')
    page.locator('#admin-password').fill(ADMIN_PASSWORD)
    page.get_by_role('button', name='Masuk').click()
    menu = page.get_by_role('button', name='Buka menu')
    page.get_by_role('button', name='Buka menu').or_(page.get_by_role('navigation', name='Menu konsol')).wait_for()
    if menu.is_visible():
        menu.click()
    page.get_by_role('navigation', name='Menu konsol').get_by_role('button', name=re.compile(r'^Merchant( \d+)?$')).click()
    page.get_by_role('button', name=re.compile(store)).wait_for()
    row = page.get_by_role('button', name=re.compile(store))
    for text in ('Siti Aminah', email, '+62 813-1111-2222', 'Yogyakarta'):
        assert text in row.inner_text(), f'list shows {text}'
    page.get_by_role('searchbox').fill('081311')
    page.wait_for_timeout(600)
    assert page.get_by_role('button', name=re.compile(store)).count() == 1, 'search by WhatsApp in 08… form'
    shot(page, f'{name}-c1-merchant-list')
    row.click()
    sheet = page.get_by_role('dialog')
    region = sheet.get_by_role('region', name='Profil toko')
    region.wait_for()
    for text in (store, 'Siti Aminah', email, '+62 813-1111-2222', 'Yogyakarta'):
        assert text in region.inner_text(), f'sheet shows {text}'
    assert region.get_by_role('link', name='+62 813-1111-2222').get_attribute('href') == 'https://wa.me/6281311112222'
    region.get_by_role('button', name='Buat kata sandi sementara').click()
    region.get_by_role('button', name='Ya, buat sekarang').click()
    temp = region.locator('p.select-all').inner_text().strip()
    assert re.fullmatch(r'[A-Za-z0-9]{12}', temp), temp
    region.scroll_into_view_if_needed()
    shot(page, f'{name}-c2-merchant-sheet')
    page.context.close()
    return temp


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    for name, (viewport, is_mobile) in VIEWPORTS.items():
        stamp = int(time.time() * 1000)
        email = f'siti-{name}-{stamp}@warung.id'
        store = f'Warung Siti {name.title()}'
        merchant(browser, name, viewport, is_mobile, email, store)
        temp = admin(browser, name, viewport, is_mobile, email, store)
        page = new_page(browser, f'{name} temp', viewport, is_mobile)
        page.goto(BASE + '/app/#masuk')
        sign_in(page, email, PASSWORD)
        page.get_by_role('alert').filter(has_text='Email atau kata sandi salah').wait_for()  # old password stopped working
        sign_in(page, email, temp)
        page.get_by_text('Bahasa / Language').wait_for()
        page.context.close()
        print(f'{name}: ok')
    browser.close()

if errors:
    print('ERRORS:', *errors, sep='\n  ')
    sys.exit(1)
print('v18 passed')
