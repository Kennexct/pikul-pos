"""v0.21 send receipts (ADR-028) against the Vercel output served by scripts/vercel-local.mjs (DEV_MODE=1, console mailer).
Signed-in store: add a customer with phone + email, sell to them. Receipt sheet: WhatsApp opens the customer's own
chat with a short message and the /r/<token> link; the link page shows the receipt with a preview image; Email queues
and the server sends it (dev log); "Simpan gambar" / "Bagikan gambar" makes a PNG. Void in Riwayat → the page says
"Dibatalkan". Phone and tablet. (Stores without an account keep the full text receipt: flow.py / customers.py.)
Usage: python3 e2e/v25.py http://localhost:4173 OUT API_LOG"""
import os
import re
import sys
import time
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from account import sign_up  # noqa: E402
from sample_menu import add_sample_menu  # noqa: E402

BASE, OUT, API_LOG = sys.argv[1:4]
APP = BASE + '/app'
errors = []
VIEWPORTS = {'phone': ({'width': 390, 'height': 844}, True), 'tablet': ({'width': 1024, 'height': 768}, False)}


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def new_page(browser, name, viewport, is_mobile):
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile, accept_downloads=True)
    ctx.add_init_script("localStorage.setItem('kk.dailyTotalsNotice.v2', '1')")
    ctx.route(re.compile(r'^https://(wa\.me|api\.whatsapp\.com)/.*'), lambda route: route.fulfill(status=200, body='wa'))
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 500 and errors.append(f'{name}: {r.status} {r.url}'))
    return page


def open_register(page):
    page.goto(APP + '/kas')
    page.get_by_role('button', name='Buka kasir').first.click()
    page.get_by_role('dialog').get_by_role('button', name='Buka kasir').click()
    page.get_by_role('dialog').wait_for(state='detached')


def add_customer(page):
    page.goto(APP + '/pelanggan')
    page.get_by_role('button', name='Tambah pelanggan').first.click()
    page.locator('#customer-name').fill('Bu Sari')
    page.locator('#customer-phone').fill('0812-3456-7890')
    page.locator('#customer-email').fill('Sari@Mail.com')
    page.get_by_role('button', name='Simpan pelanggan').click()
    page.get_by_text('Bu Sari disimpan').wait_for()


def sell_to_customer(page, is_mobile):
    page.goto(APP + '/')
    page.get_by_role('button', name='Kerupuk').first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Tambah pelanggan').click()
    page.get_by_role('searchbox', name='Cari pelanggan').fill('0812')
    page.get_by_role('dialog').get_by_role('button', name=re.compile('Bu Sari')).click()
    page.get_by_role('button', name=re.compile('Bu Sari.*Ganti')).wait_for()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()


def wa_href(page):
    link = page.get_by_role('link', name=re.compile('WhatsApp'))
    page.wait_for_function("() => [...document.querySelectorAll('a')].some((a) => a.textContent.includes('WhatsApp') && a.href.includes('%2Fr%2F'))", timeout=10_000)
    return link.get_attribute('href')


def wait_page(browser, url, text, tries=40):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    for _ in range(tries):
        res = page.goto(url)
        if res.status == 200 and text in page.content():
            return page
        page.wait_for_timeout(500)
    raise AssertionError(f'{url} never showed {text!r}')


def signed_in(browser, name, viewport, is_mobile):
    page = new_page(browser, name, viewport, is_mobile)
    page.goto(APP + '/')
    page.get_by_role('heading', name='Daftar akun Pikul').wait_for()
    sign_up(page, f'struk-{name}-{int(time.time() * 1000)}@warung.id', store='Warung Struk')
    page.get_by_role('button', name='Lewati', exact=True).click()
    page.get_by_role('navigation').first.wait_for()
    add_sample_menu(page)
    open_register(page)
    add_customer(page)
    sell_to_customer(page, is_mobile)
    page.get_by_role('button', name='Email').wait_for()
    shot(page, f'{name}-r1-receipt-actions')

    # WhatsApp: the customer's own chat, a short message, the web link.
    href = wa_href(page)
    assert href.startswith('https://wa.me/6281234567890?text='), href
    text = unquote(href.split('?text=', 1)[1])
    assert '*Warung Struk*' in text and 'Lihat struk: ' in text and 'Kerupuk' not in text, text
    link = re.search(r'(http\S+/r/[A-Za-z0-9_-]{22})', text).group(1)
    with page.context.expect_page() as popup:
        page.get_by_role('link', name=re.compile('WhatsApp')).click()
    popup.value.close()

    # The link page (another browser, no account) shows the receipt with a preview image.
    web = wait_page(browser, link, 'Kerupuk')
    html = web.content()
    assert 'og:image' in html and 'Bu Sari' in html and 'noindex' in html, html[:400]
    assert 'sari@mail.com' not in html.lower() and '6281234567890' not in html, 'no customer phone or email on the page'
    img = web.request.get(link + '.png')
    assert img.status == 200 and img.headers['content-type'] == 'image/png' and len(img.body()) > 2_000, (img.status, len(img.body()))
    web.wait_for_timeout(300)
    web.screenshot(path=f'{OUT}/{name}-r2-web-receipt.png', full_page=True)
    with open(f'{OUT}/{name}-r3-receipt-image.png', 'wb') as f:
        f.write(img.body())

    # Email: prefilled from the customer, sent by the server (dev log).
    page.get_by_role('button', name='Email').click()
    field = page.locator('#receipt-email')
    assert field.input_value() == 'sari@mail.com', field.input_value()
    shot(page, f'{name}-r4-email-sheet')
    page.get_by_role('dialog', name='Kirim struk lewat email').get_by_role('button', name='Kirim').click()
    page.get_by_text('Struk dikirim ke sari@mail.com').wait_for()
    for _ in range(40):
        if 'receipt "Struk' in open(API_LOG).read() and 'to sari@mail.com' in open(API_LOG).read():
            break
        page.wait_for_timeout(250)
    else:
        raise AssertionError('receipt email not sent')

    # Image: download on a desktop browser (no file share in headless Chromium).
    with page.expect_download() as download:
        page.get_by_role('button', name=re.compile('(Simpan|Bagikan) gambar')).click()
    assert download.value.suggested_filename.startswith('struk-INV-'), download.value.suggested_filename
    page.get_by_role('button', name='Transaksi baru').click()

    # Void in Riwayat → the shared copy updates.
    page.goto(APP + '/riwayat')
    page.get_by_role('button', name=re.compile('INV-')).first.click()
    page.get_by_role('button', name='Void', exact=True).click()
    page.get_by_role('button', name='Void Rp').click()
    page.get_by_text('di-void').wait_for()
    page.goto(APP + '/pengaturan?tab=sync')
    page.get_by_role('button', name='Sinkronkan sekarang').click()
    page.get_by_text('Data sudah tersinkron.').wait_for()
    web = wait_page(browser, link, 'Dibatalkan')
    web.screenshot(path=f'{OUT}/{name}-r5-web-voided.png', full_page=True)
    web.context.close()
    page.context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    for name, (viewport, is_mobile) in VIEWPORTS.items():
        signed_in(browser, name, viewport, is_mobile)
        print(f'{name}: ok')
    browser.close()

if errors:
    print('ERRORS:', *errors, sep='\n  ')
    sys.exit(1)
print('v25 passed')
