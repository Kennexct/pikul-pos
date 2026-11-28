"""v0.22 flow (tablet + phone): the on-screen keyboard never covers a sheet (ADR-029).
Number fields (weight, price, cash, register float, expense) are typed with the in-app keypad, so the system keyboard
never opens (inputmode="none"). A text field (expense note) hides the keypad and, with a simulated on-screen keyboard
over the bottom of the screen, the sheet fits into the space above it: field and main button stay visible."""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

# iPad Safari lays the keyboard over the page and only shrinks window.visualViewport. Headless Chrome has no
# on-screen keyboard, so stand in a visualViewport we can shrink, and paint a grey block where the keys would be.
FAKE_KEYBOARD = """(() => {
  const events = new EventTarget();
  let covered = 0;
  const viewport = {
    get height() { return window.innerHeight - covered; },
    get width() { return window.innerWidth; },
    offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport });
  window.__keyboard = (px) => {
    covered = px;
    let el = document.getElementById('__kb');
    if (!el) {
      el = document.createElement('div');
      el.id = '__kb';
      el.textContent = 'on-screen keyboard (simulated)';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#cfd3da;color:#555;font:600 15px sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:none';
      document.body.appendChild(el);
    }
    el.style.height = px + 'px';
    el.style.display = px ? 'flex' : 'none';
    events.dispatchEvent(new Event('resize'));
  };
})()"""


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def run(p, name, viewport, is_mobile, keyboard_px):
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=True).new_page()
    page.add_init_script(FAKE_KEYBOARD)
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{name}: console {m.text}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')
    pad = dialog.get_by_role('group', name='Papan angka')

    def press(*keys):
        for key in keys:
            pad.get_by_role('button', name=key, exact=True).click()

    def inside_screen(locator, bottom_px=0):
        box = locator.bounding_box()
        return box is not None and box['y'] >= 0 and box['y'] + box['height'] <= viewport['height'] - bottom_px + 0.5

    page.goto(BASE + '/produk')
    skip_with_sample_menu(page)
    page.get_by_role('navigation').first.wait_for()

    # 1. Open the register with the keypad: the suggested float is replaced by the first key.
    page.goto(BASE + '/kas')
    page.get_by_role('button', name='Buka kasir').first.click()
    register_inputmode = page.locator('#opening-cash').get_attribute('inputmode')
    press('1', '5', '0', '000')
    float_value = page.locator('#opening-cash').input_value()
    shot(page, f'{name}-k1-open-register')
    dialog.get_by_role('button', name='Buka kasir').click()
    dialog.wait_for(state='detached')

    # 2. A product sold per kg with a flexible price, like Kenny's "Bayam / kg - Hidroponik".
    page.goto(BASE + '/pengaturan?tab=modes')
    page.get_by_text('Aktifkan satuan berat dan ukuran').click()
    page.get_by_text('Satuan berat dan ukuran aktif').wait_for()
    page.goto(BASE + '/produk')
    page.get_by_role('button', name='Produk', exact=True).first.click()
    page.locator('#product-name').fill('Bayam Hidroponik')
    dialog.get_by_role('radio', name='Kilogram (kg)').click()
    page.locator('#base-price').fill('23400')
    dialog.get_by_role('button', name=re.compile('^Pengaturan lain')).click()
    dialog.get_by_text('Harga bisa diubah saat jual').click()
    page.get_by_role('button', name='Simpan produk').click()
    page.locator('#product-name').wait_for(state='hidden')

    # 3. Weigh-out sheet: keypad, no system keyboard, "Tambah ke pesanan" on screen.
    page.goto(BASE + '/')
    page.get_by_role('button', name=re.compile('Bayam Hidroponik')).first.click()
    weight_inputmode = page.locator('#entry-quantity').get_attribute('inputmode')
    has_comma = pad.get_by_role('button', name='Koma').count() == 1
    press('1', 'Koma', '5')
    weight = page.locator('#entry-quantity').input_value()
    add = dialog.get_by_role('button', name=re.compile('Tambah ke pesanan'))
    add_label = add.inner_text().replace('\n', ' ')
    add_visible = inside_screen(add)
    shot(page, f'{name}-k2-weigh-keypad')
    # The price field takes the keypad when tapped; "000" is there for Rupiah, the first key replaces 23.400.
    page.locator('#entry-price').click()
    has_000 = pad.get_by_role('button', name='000').count() == 1
    press('2', '5', '000')
    price = page.locator('#entry-price').input_value()
    add_label_new_price = add.inner_text().replace('\n', ' ')
    shot(page, f'{name}-k3-price-keypad')
    add.click()

    # 4. Cash payment with the keypad.
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    cash_inputmode = page.locator('#cash-received').get_attribute('inputmode')
    press('5', '0', '000')
    change = dialog.get_by_text('Kembalian').locator('..').inner_text().replace('\n', ' ')
    pay_visible = inside_screen(dialog.get_by_role('button', name='Selesaikan pembayaran'))
    shot(page, f'{name}-k4-cash-keypad')
    dialog.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.get_by_role('button', name='Transaksi baru').click()

    # 5. Expense: amount by keypad; the note opens the system keyboard, the keypad steps aside and the sheet
    #    fits above the (simulated) keyboard with the note and "Simpan pengeluaran" visible.
    page.goto(BASE + '/kas')
    page.get_by_role('button', name='Catat pengeluaran').first.click()
    press('1', '2', '000')
    page.locator('#expense-note').click()
    pad_hidden_for_text = pad.count() == 0
    page.evaluate(f'window.__keyboard({keyboard_px})')
    page.wait_for_timeout(500)
    page.keyboard.type('es batu 2 kantong')
    save = dialog.get_by_role('button', name='Simpan pengeluaran')
    note_above_keyboard = inside_screen(page.locator('#expense-note'), keyboard_px)
    save_above_keyboard = inside_screen(save, keyboard_px)
    shot(page, f'{name}-k5-note-above-keyboard')
    page.evaluate('window.__keyboard(0)')
    page.locator('#expense-amount').click()
    pad_back_for_number = pad.count() == 1
    save.click()
    page.get_by_text('Pengeluaran dicatat').wait_for()

    browser.close()
    return {
        'inputmode_none': [register_inputmode, weight_inputmode, cash_inputmode],
        'float': float_value,
        'weight': weight,
        'keys': {'comma_on_weight': has_comma, '000_on_price': has_000},
        'add_label': add_label,
        'add_label_new_price': add_label_new_price,
        'price': price,
        'add_visible': add_visible,
        'change': change,
        'pay_visible': pay_visible,
        'pad_hidden_for_text': pad_hidden_for_text,
        'note_above_keyboard': note_above_keyboard,
        'save_above_keyboard': save_above_keyboard,
        'pad_back_for_number': pad_back_for_number,
    }


with sync_playwright() as p:
    for args in [('tablet', {'width': 1133, 'height': 744}, False, 400), ('phone', {'width': 390, 'height': 844}, True, 340)]:
        print(args[0], json.dumps(run(p, *args), ensure_ascii=False))
print('ERRORS:', errors or 'none')
