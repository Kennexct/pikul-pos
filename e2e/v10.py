"""v0.10 flow (tablet + phone): first-time journey with a business template, the Langkah awal banner and checklist,
the help page (search, topic, replay intro) and contextual help. A reload must not show the journey again."""
import json
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (name) => new Promise((res, rej) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const [stores, products, methods, categories, meta] = await Promise.all(['stores', 'products', 'paymentMethods', 'categories', 'meta'].map(all));
  return {
    stores: stores.map((s) => s.name),
    products: products.length,
    categories: categories.map((c) => c.name),
    methods: methods.sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.type),
    meta: meta.map((m) => m.key).filter((k) => ['onboardedAt', 'checklistDismissed'].includes(k)).sort(),
  };
}"""


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')

    # 1. Journey: nothing exists until it is finished.
    page.goto(BASE + '/')
    page.get_by_role('heading', name='Bahasa / Language').wait_for()
    shot(page, f'{name}-x0-language')
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('heading', name='Toko Anda').wait_for()
    stores_before = page.evaluate(READ_DB)['stores'] if page.evaluate("async () => (await indexedDB.databases()).some((d) => d.name === 'kasirku')") else []
    page.locator('#store-name').fill('Kopi Senja')
    page.get_by_role('radio', name=re.compile('Kopi & minuman')).click()
    shot(page, f'{name}-x1-store')
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('heading', name='Cara pembayaran').wait_for()
    page.get_by_text('Transfer bank', exact=True).click()  # switch it off
    shot(page, f'{name}-x2-payments')
    page.get_by_role('button', name='Lanjut').click()
    page.get_by_role('heading', name='Cara kerja Pikul').wait_for()
    shot(page, f'{name}-x3-intro')
    page.get_by_role('button', name='Mulai jualan').click()

    # 2. Cashier opens with the chosen menu and the Langkah awal banner; first sale ticks a step.
    page.get_by_role('button', name=re.compile('Kentang Goreng')).first.wait_for()
    banner_start = page.get_by_role('link', name=re.compile('Langkah awal')).inner_text()
    shot(page, f'{name}-x4-pos')
    page.get_by_role('button', name=re.compile('Roti Bakar')).first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    method_names = [b.inner_text().strip() for b in dialog.locator('button[aria-pressed]').all()]
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    receipt = page.locator('.receipt').inner_text()
    page.get_by_role('button', name='Transaksi baru').click()
    banner_after_sale = page.get_by_role('link', name=re.compile('Langkah awal')).inner_text()

    # 3. Help page: checklist, search, a topic, replay the intro.
    page.get_by_role('link', name=re.compile('Langkah awal')).click()
    page.get_by_role('heading', name='Bantuan').wait_for()
    checklist = page.get_by_role('region', name='Langkah awal').inner_text()
    shot(page, f'{name}-x5-help')
    page.get_by_role('searchbox').fill('refund')
    topics_for_refund = page.locator('h2 button[aria-expanded]').all_inner_texts()
    page.get_by_role('button', name='Riwayat, void, dan refund').click()
    page.get_by_text('Refund dihitung pada hari refund dilakukan').wait_for()
    shot(page, f'{name}-x6-help-topic')
    page.get_by_role('button', name=re.compile('pengenalan|Pengenalan')).click()
    intro_cards = dialog.locator('li').count()
    page.get_by_role('button', name='Mengerti').click()

    # 4. Contextual help on Kas; dismiss the banner; reload does not restart the journey.
    page.goto(BASE + '/kas')
    page.get_by_role('button', name='Bantuan untuk halaman ini').click()
    dialog.get_by_text('Uang seharusnya = modal awal').wait_for()
    shot(page, f'{name}-x7-context-help')
    page.get_by_role('button', name='Tutup', exact=True).click()
    page.goto(BASE + '/')
    page.get_by_role('button', name='Sembunyikan langkah awal').click()
    page.get_by_role('link', name=re.compile('Langkah awal')).wait_for(state='hidden')
    page.reload()
    page.get_by_role('button', name=re.compile('Kentang Goreng')).first.wait_for()
    banner_gone = page.get_by_role('link', name=re.compile('Langkah awal')).count() == 0

    db = page.evaluate(READ_DB)
    browser.close()
    return {
        'nothing_created_before_finish': stores_before == [],
        'banner_start': banner_start.replace('\n', ' '),
        'banner_after_sale': banner_after_sale.replace('\n', ' '),
        'pay_methods': method_names,
        'receipt_has_store_name': 'Kopi Senja' in receipt,
        'checklist_ok': '1 dari 6 selesai' in checklist and 'Pasang PIN pemilik' in checklist,
        'topics_for_refund': topics_for_refund,
        'intro_cards': intro_cards,
        'banner_gone_after_dismiss_and_reload': banner_gone,
        **db,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], json.dumps(run(p, *args), ensure_ascii=False))
print('ERRORS:', errors or 'none')
