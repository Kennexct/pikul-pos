"""v0.15 admin console against `wrangler pages dev` (DEV_MODE=1, ADMIN_EMAILS=admin@pikul.test):
a merchant is refused; the admin edits a plan and schedules a campaign (banner upload, link, promo price, landing + app);
the landing page shows live prices and the pop-up once; a merchant sees the in-app pop-up once and the promo price.
Usage: python3 e2e/v15.py http://localhost:8788 OUT /tmp/wrangler.log [skip-setup]
(run after v14.py: it changes the prices; skip-setup re-runs the checks against an existing campaign)"""
import os
import re
import sys
import time
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

BASE, OUT, LOG = sys.argv[1:4]
ADMIN = 'admin@pikul.test'
FIXTURE = os.path.join(os.path.dirname(__file__), 'fixtures', 'photo.jpg')
errors = []


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def latest_code(email, after=0):
    for _ in range(40):
        codes = re.findall(rf'login code for {re.escape(email)}: (\d{{6}})', open(LOG).read())
        if len(codes) > after:
            return codes[-1]
        time.sleep(0.25)
    raise AssertionError('no code in log')


def code_count(email):
    return len(re.findall(rf'login code for {re.escape(email)}:', open(LOG).read()))


def new_page(p, viewport, is_mobile, name):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))
    return browser, page


def admin_sign_in(page, email):
    page.goto(BASE + '/admin/')
    page.get_by_role('heading', name='Konsol admin').wait_for()
    n = code_count(email)
    page.locator('#admin-email').fill(email)
    page.get_by_role('button', name='Kirim kode').click()
    page.locator('#admin-code').fill(latest_code(email, n))
    page.get_by_role('button', name='Masuk', exact=True).click()


def admin_flow(p, viewport, is_mobile, name, first):
    browser, page = new_page(p, viewport, is_mobile, name)
    # 1. A merchant account is refused
    admin_sign_in(page, f'merchant-{name}-{int(time.time())}@warung.id')
    page.get_by_role('alert').filter(has_text='bukan admin').wait_for()
    shot(page, f'{name}-b1-refused')
    # 2. Admin signs in, sees the seeded plans
    time.sleep(61 if not first else 0)  # resend limit per email
    admin_sign_in(page, ADMIN)
    page.get_by_role('heading', name='Konsol admin Pikul').wait_for()
    page.locator('#monthly-name').wait_for()
    shot(page, f'{name}-b2-plans')
    if first:
        page.locator('#monthly-amount').fill('59000')
        page.locator('#monthly-features').fill('Semua fitur\nTanpa batas transaksi\nData tetap milik Anda')
        page.locator('form').filter(has=page.locator('#monthly-name')).get_by_role('button', name='Simpan').click()
        page.get_by_text('Paket "Bulanan" tersimpan.').wait_for()
        # 3. New campaign: banner, link, landing + app, promo on yearly, live from a minute ago
        page.get_by_role('tab', name=re.compile('Kampanye promo')).click()
        page.get_by_role('button', name='Kampanye baru').click()
        page.locator('#c-name').fill('Promo akhir tahun')
        page.locator('input[type=file]').set_input_files(FIXTURE)
        page.get_by_role('button', name='Ganti gambar').wait_for()
        page.locator('#c-title').fill('Diskon 20% paket tahunan')
        page.locator('#c-body').fill('Hanya sampai akhir Desember.')
        page.locator('#c-link').fill('javascript:alert(1)')
        page.get_by_role('button', name='Simpan kampanye').click()
        page.get_by_text('Tautan harus diawali').wait_for()
        page.locator('#c-link').fill('https://wa.me/6281200000000')
        page.locator('#c-ctaLabel').fill('Tanya via WhatsApp')
        now = datetime.now()
        page.locator('#c-start').fill((now - timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M'))
        page.locator('#c-end').fill((now + timedelta(days=10)).strftime('%Y-%m-%dT%H:%M'))
        page.get_by_role('switch', name=re.compile('Aplikasi merchant')).check(force=True)
        page.locator('#c-plan').select_option('yearly')
        page.locator('#c-promo').fill('392000')
        shot(page, f'{name}-b3-campaign-form')
        page.get_by_role('button', name='Simpan kampanye').click()
        page.get_by_text('Kampanye "Promo akhir tahun" tersimpan.').wait_for()
    page.get_by_role('tab', name=re.compile('Kampanye promo')).click()
    page.get_by_text('Tayang sekarang').wait_for()
    shot(page, f'{name}-b4-campaigns')
    browser.close()


def landing_flow(p, viewport, is_mobile, name):
    browser, page = new_page(p, viewport, is_mobile, name)
    page.goto(BASE + '/')
    dialog = page.get_by_role('dialog', name='Diskon 20% paket tahunan')
    dialog.wait_for(timeout=8000)
    assert dialog.get_by_role('img', name='Diskon 20% paket tahunan').count() == 1
    link = dialog.get_by_role('link', name='Tanya via WhatsApp')
    assert link.get_attribute('href') == 'https://wa.me/6281200000000' and link.get_attribute('rel') == 'noopener noreferrer'
    shot(page, f'{name}-c1-landing-popup')
    page.keyboard.press('Escape')
    assert dialog.count() == 0
    grid = page.locator('#paket-grid')
    grid.get_by_text('Rp59.000').wait_for()
    assert grid.get_by_text('Rp392.000').count() == 1 and grid.locator('s', has_text='Rp490.000').count() == 1
    assert grid.locator('[data-plan-card=monthly]').get_by_text('Tanpa batas transaksi').count() == 1
    page.locator('#harga').scroll_into_view_if_needed()
    shot(page, f'{name}-c2-landing-prices')
    page.reload()
    page.wait_for_timeout(3500)
    assert page.get_by_role('dialog').count() == 0, 'pop-up shown twice'
    browser.close()


def merchant_flow(p, viewport, is_mobile, name):
    browser, page = new_page(p, viewport, is_mobile, name)
    email = f'm-{name}-{int(time.time())}@warung.id'
    page.goto(BASE + '/app/')
    page.locator('#signin-email').fill(email)
    page.get_by_role('button', name='Kirim kode masuk').click()
    page.locator('#signin-code').fill(latest_code(email))
    page.get_by_role('button', name='Masuk', exact=True).click()
    page.get_by_role('button', name='Lewati, pakai contoh toko').click()
    dialog = page.get_by_role('dialog', name='Diskon 20% paket tahunan')
    dialog.wait_for(timeout=8000)
    shot(page, f'{name}-d1-app-popup')
    dialog.get_by_role('button', name='Tutup').click()
    page.goto(BASE + '/app/pengaturan?tab=subscription')
    page.get_by_text('Promo sampai').wait_for()
    plans = page.locator('li', has_text='Tahunan').first
    assert '392.000' in plans.inner_text() and plans.locator('s').inner_text().find('490.000') >= 0
    shot(page, f'{name}-d2-subscription')
    page.goto(BASE + '/app/')
    page.get_by_role('button', name='Kerupuk').first.wait_for()
    page.wait_for_timeout(3000)
    assert page.get_by_role('dialog').count() == 0, 'in-app pop-up shown twice'
    browser.close()


with sync_playwright() as p:
    if len(sys.argv) < 5:
        admin_flow(p, {'width': 1024, 'height': 768}, False, 'tablet', True)
    landing_flow(p, {'width': 1280, 'height': 800}, False, 'desktop')
    landing_flow(p, {'width': 390, 'height': 844}, True, 'phone')
    merchant_flow(p, {'width': 1024, 'height': 768}, False, 'tablet')
    merchant_flow(p, {'width': 390, 'height': 844}, True, 'phone')
    admin_flow(p, {'width': 390, 'height': 844}, True, 'phone', False)
print('errors:', errors)
sys.exit(1 if errors else 0)
