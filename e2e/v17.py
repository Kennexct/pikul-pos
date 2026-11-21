"""v0.17 (ADR-020) against `wrangler pages dev` (DEV_MODE=1, ADMIN_PASSWORD set):
admin password sign-in (wrong password, then right) → landing content edit shows on the landing page →
campaign on "first register opening" → merchant signs up, opens the register, sees the banner once, sells →
daily totals reach the console (merchant list, summary) → record a payment → payments month + executive report.
Usage: python3 e2e/v17.py http://localhost:8788 OUT /tmp/wrangler.log ADMIN_PASSWORD"""
import re
import sys
import time

from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

BASE, OUT, LOG, PASSWORD = sys.argv[1:5]
errors = []


def shot(page, name):
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/{name}.png', full_page=False)


def latest_code(email):
    for _ in range(40):
        codes = re.findall(rf'login code for {re.escape(email)}: (\d{{6}})', open(LOG).read())
        if codes:
            return codes[-1]
        time.sleep(0.25)
    raise AssertionError('no code in log')


def watch(page, name, ok_status=()):
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))


def tab(page, label):
    page.get_by_role('tab', name=label).click()


def admin_sign_in(page, name):
    page.goto(BASE + '/admin/')
    page.get_by_role('heading', name='Konsol admin Pikul').wait_for()
    page.locator('#admin-password').fill('salah-sekali-bukan-ini')
    page.get_by_role('button', name='Masuk').click()
    page.get_by_role('alert').filter(has_text='Kata sandi salah').wait_for()
    shot(page, f'{name}-c1-login')
    page.locator('#admin-password').fill(PASSWORD)
    page.get_by_role('button', name='Masuk').click()
    page.get_by_role('tab', name='Ringkasan').wait_for()


def edit_landing(page, name, faq_q, faq_a):
    tab(page, 'Konten landing')
    page.get_by_role('heading', name='Konten halaman depan').wait_for()
    page.locator('#c-hero-title').fill('Kasir offline untuk warung Anda')
    page.get_by_role('button', name='Tambah pertanyaan').click()
    faqs = page.get_by_role('region', name='Tanya jawab (FAQ)')
    faqs.locator('input').last.fill(faq_q)
    faqs.locator('textarea').last.fill(faq_a)
    page.get_by_role('button', name='Simpan', exact=True).click()
    page.get_by_text('Konten disimpan').wait_for()
    shot(page, f'{name}-c2-content')


def add_register_campaign(page, name, title):
    tab(page, 'Kampanye')
    page.get_by_role('button', name=re.compile('Kampanye baru|Buat kampanye')).first.click()
    dialog = page.get_by_role('dialog')
    dialog.locator('#c-name').fill(f'Promo kasir {name}')
    dialog.locator('#c-title').fill(title)
    # New campaigns start at the next full hour; start this one a few minutes ago so it is live now.
    dialog.locator('#c-start').fill(page.evaluate("(() => { const d = new Date(Date.now() - 300000 - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); })()"))
    for label in ('Halaman depan', 'Aplikasi merchant'):
        sw = dialog.get_by_role('switch', name=re.compile(label))
        if sw.is_checked():
            dialog.get_by_text(label, exact=True).click()  # the visible label toggles the visually hidden input
    dialog.get_by_text('Saat buka kasir pertama hari itu', exact=True).click()
    assert dialog.get_by_role('switch', name=re.compile('Saat buka kasir')).is_checked()
    shot(page, f'{name}-c3-campaign')
    dialog.get_by_role('button', name='Simpan kampanye').click()
    dialog.wait_for(state='detached')
    page.get_by_text('Buka kasir').first.wait_for()


def merchant_day(p, name, viewport, is_mobile, email, title):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    watch(page, f'{name} merchant')
    page.goto(BASE + '/app/')
    page.locator('#signin-email').fill(email)
    page.get_by_role('button', name='Kirim kode masuk').click()
    page.locator('#signin-code').fill(latest_code(email))
    page.get_by_role('button', name='Masuk', exact=True).click()
    skip_with_sample_menu(page)
    page.get_by_role('button', name='Kerupuk').first.wait_for()
    # One-time notice about daily totals.
    page.get_by_text('Ringkasan penjualan harian').wait_for()
    shot(page, f'{name}-m1-notice')
    page.get_by_role('dialog').get_by_role('button').filter(has_text=re.compile('Mengerti|Oke|Tutup')).first.click()
    # Open the register → the campaign banner shows once.
    page.get_by_role('button', name='Kerupuk').first.click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('heading', name='Buka kasir').wait_for()
    dialog.get_by_role('button', name='Buka kasir').click()
    page.get_by_role('dialog').get_by_text(title).wait_for(timeout=8_000)
    shot(page, f'{name}-m2-register-banner')
    page.get_by_role('dialog').get_by_role('button', name=re.compile('Tutup')).first.click()
    page.get_by_role('dialog').wait_for(state='detached')
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.get_by_role('button', name='Transaksi baru').click()
    # Selling did not wait for the network; now the daily totals go out in the background.
    with page.expect_response(lambda r: '/api/merchant/daily' in r.url and r.status == 200, timeout=20_000):
        page.evaluate("window.dispatchEvent(new Event('online'))")
    # Reopening the app the same day: no second banner.
    page.reload()
    page.get_by_role('button', name='Kerupuk').first.wait_for()
    page.wait_for_timeout(3_000)
    assert page.get_by_text(title).count() == 0, 'banner shown twice'
    browser.close()


def run(p, name, viewport, is_mobile):
    stamp = int(time.time())
    email = f'{name}-{stamp}@warung.id'
    title = f'Promo pagi {name} {stamp}'
    faq_q = f'Pertanyaan uji {name} {stamp}?'
    faq_a = f'Bisa. <b>Teks</b> {stamp} tampil apa adanya.'
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = ctx.new_page()
    watch(page, name)

    admin_sign_in(page, name)
    edit_landing(page, name, faq_q, faq_a)
    add_register_campaign(page, name, title)

    # Landing page shows the saved text (as text, never HTML).
    land = ctx.new_page()
    watch(land, f'{name} landing')
    land.goto(BASE + '/')
    land.get_by_role('heading', name='Kasir offline untuk warung Anda').wait_for()
    land.get_by_text(faq_q).click()
    land.get_by_text(faq_a).wait_for()
    assert land.locator('[data-lp="faqs"] b').count() == 0, 'FAQ rendered as HTML'
    land.get_by_text(faq_q).scroll_into_view_if_needed()
    shot(land, f'{name}-l1-landing-faq')
    land.close()

    merchant_day(p, name, viewport, is_mobile, email, title)

    # Console: the merchant, its sales summary, record a payment.
    page.reload()
    tab(page, 'Merchant')
    page.get_by_role('searchbox', name='Cari merchant').fill(email)
    page.get_by_role('button', name=re.compile(re.escape(email))).click()
    sheet = page.get_by_role('dialog')
    sheet.get_by_text('Ringkasan penjualan').first.wait_for()
    sheet.get_by_text('Penjualan bersih').first.wait_for()
    assert sheet.get_by_text('Belum ada penjualan yang terkirim').count() == 0, 'summary empty'
    shot(page, f'{name}-c4-merchant')
    sheet.get_by_role('button', name='Catat pembayaran').click()
    sheet.locator('#pay-ref').fill('TRF-001')
    sheet.get_by_role('button', name='QRIS').click()
    shot(page, f'{name}-c5-record-payment')
    sheet.get_by_role('button', name='Catat pembayaran').click()
    page.get_by_text(re.compile('Pembayaran dicatat')).wait_for()
    sheet.get_by_text('TRF-001').wait_for()
    page.keyboard.press('Escape')
    sheet.wait_for(state='detached')

    tab(page, 'Pembayaran')
    page.get_by_text(email).first.wait_for()
    shot(page, f'{name}-c6-payments')
    tab(page, 'Laporan')
    page.get_by_role('heading', name='Laporan eksekutif').wait_for()
    page.get_by_text('Pendapatan langganan').first.wait_for()
    page.get_by_role('region', name='10 merchant teratas').get_by_text(email).wait_for()
    shot(page, f'{name}-c7-report')
    tab(page, 'Ringkasan')
    page.wait_for_timeout(800)
    shot(page, f'{name}-c8-overview')
    page.get_by_role('button', name='Keluar').click()
    page.locator('#admin-password').wait_for()
    browser.close()
    print(f'{name}: ok')


with sync_playwright() as p:
    run(p, 'tablet', {'width': 1024, 'height': 768}, False)
    run(p, 'phone', {'width': 390, 'height': 844}, True)
print('errors:', errors)
sys.exit(1 if errors else 0)
