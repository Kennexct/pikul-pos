"""Staff & PIN flow (tablet + phone): owner PIN, add cashier, switch seller, PIN-approved discount and void,
owner gate, Kunci, lockout. Verifies approver + audit records in IndexedDB."""
import re
import sys

from playwright.sync_api import sync_playwright
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1], sys.argv[2]
errors = []

READ_DB = """async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (name) => new Promise((res, rej) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const [refunds, audits, members, orders] = await Promise.all([all('refunds'), all('auditEvents'), all('storeMembers'), all('orders')]);
  const owner = members.find((m) => m.role === 'owner');
  const dika = members.find((m) => m.displayName === 'Dika');
  const refund = refunds[0];
  const order = orders[0];
  return {
    void_actor_is_dika: refund && refund.actorId === dika.id,
    void_approved_by_owner: refund && refund.approvedById === owner.id,
    sale_by_dika: order.cashierId === dika.id,
    discount_approved_by_owner: order.orderDiscount && order.orderDiscount.approvedById === owner.id,
    audit_actions: [...new Set(audits.map((a) => a.action))].sort(),
    hashes_ok: members.every((m) => m.pinHash.startsWith('pbkdf2-sha256$')),
    plain_pin_or_code_stored: /"(1234|5678)"/.test(JSON.stringify([members, audits])),
  };
}"""



def open_register(page, label='Buka kasir'):
    """v0.16 (ADR-017): the register must be opened before the first sale; open it with the suggested float."""
    back = page.url
    page.goto(BASE + '/kas')
    page.get_by_role('button', name=label).first.click()
    page.get_by_role('dialog').get_by_role('button', name=label).click()
    page.get_by_role('dialog').wait_for(state='detached')
    page.goto(back)

def enter_pin(page, label, pin):
    pad = page.get_by_role('group', name=label)
    for digit in pin:
        pad.get_by_role('button', name=digit, exact=True).click()
    pad.get_by_role('button', name='OK').click()


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = browser.new_context(locale='id-ID', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile).new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))

    # 1. Owner sets a PIN and gets a recovery code once.
    page.goto(BASE + '/pengaturan?tab=staff')
    skip_with_sample_menu(page)  # first-time journey: empty store + test-only sample menu (ADR-018)
    page.get_by_role('navigation').first.wait_for()  # the store exists once the app shell is up
    open_register(page)
    page.get_by_role('navigation').first.wait_for()
    page.locator('#owner-pin-new').fill('1234')
    page.locator('#owner-pin-confirm').fill('1234')
    page.get_by_role('button', name='Aktifkan PIN').click()
    code = page.get_by_test_id('recovery-code').inner_text()
    assert re.fullmatch(r'[A-Z2-9]{4}-[A-Z2-9]{4}', code), code
    shot(page, f'{name}-s1-recovery')
    page.get_by_role('button', name='Sudah saya catat').click()

    # 2. Add a cashier.
    page.locator('#cashier-name').fill('Dika')
    page.locator('#cashier-pin').fill('5678')
    page.get_by_role('button', name='Tambah', exact=True).click()
    page.get_by_text('Dika ditambahkan').wait_for()
    shot(page, f'{name}-s2-staff')

    # 3. Switch seller to Dika — owner mode locks, so Settings shows the gate.
    if is_mobile:
        page.get_by_role('link', name='Akun', exact=True).click()  # v0.19.1: phone tab Akun replaces Lainnya
        page.get_by_role('button', name='Ganti kasir').click()
    else:
        page.get_by_role('button', name=re.compile('^Akun')).click()
    page.get_by_role('dialog').get_by_role('button', name=re.compile('Dika')).click()
    shot(page, f'{name}-s3-pinpad')
    enter_pin(page, 'PIN Dika', '5678')
    page.get_by_role('dialog').wait_for(state='detached')
    if not is_mobile:
        page.get_by_text('Khusus pemilik').wait_for()

    # 4. Reload: Dika is still the seller. Sell with an over-limit discount approved by the owner PIN.
    page.goto(BASE + '/')
    page.get_by_role('button', name='Kerupuk').first.click()
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Tambah diskon').click()
    page.locator('#discount-value').fill('50')
    page.get_by_role('button', name='Setujui dengan PIN pemilik').click()
    enter_pin(page, 'PIN pemilik', '1234')
    page.get_by_role('group', name='PIN pemilik').wait_for(state='detached')
    page.get_by_role('button', name='Bayar').click()  # phone: the cart sheet reopens by itself
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_role('button', name='Transaksi baru').click()

    # 5. Void as Dika: wrong owner PIN first, then the right one.
    page.goto(BASE + '/riwayat')
    page.get_by_role('button', name='INV-').first.click()
    page.get_by_role('button', name=re.compile('^Void')).click()
    enter_pin(page, 'PIN pemilik', '0000')
    page.get_by_text('PIN salah. Sisa 4 percobaan.').wait_for()
    shot(page, f'{name}-s4-approval-wrong')
    enter_pin(page, 'PIN pemilik', '1234')
    page.get_by_role('button', name=re.compile('^Void Rp')).click()
    page.get_by_text('di-void').wait_for()
    page.get_by_role('button', name='Tutup').click()
    db = page.evaluate(READ_DB)

    # 6. The approval did not unlock owner screens: Reports still asks for the PIN.
    page.get_by_role('link', name=re.compile('^Laporan')).first.click()
    page.get_by_text('Khusus pemilik').wait_for()
    shot(page, f'{name}-s5-gate')
    enter_pin(page, 'PIN pemilik', '1234')
    page.get_by_role('heading', name='Laporan').wait_for()

    # 7. Kunci locks owner mode again.
    if is_mobile:
        page.get_by_role('link', name='Akun', exact=True).click()  # v0.19.1: phone tab Akun replaces Lainnya
    page.get_by_role('button', name='Kunci').click()
    page.get_by_role('link', name=re.compile('^Laporan')).first.click()
    page.get_by_text('Khusus pemilik').wait_for()

    # 8. Five wrong PINs lock the pad.
    for _ in range(5):
        enter_pin(page, 'PIN pemilik', '0000')
        page.wait_for_timeout(250)
    page.get_by_text(re.compile('Terlalu banyak percobaan')).wait_for()
    locked = page.get_by_role('group', name='PIN pemilik').get_by_role('button', name='1', exact=True).is_disabled()
    shot(page, f'{name}-s6-lockout')
    browser.close()
    return {**db, 'keys_disabled_when_locked': locked}


with sync_playwright() as p:
    for args in [('tablet', {'width': 1024, 'height': 768}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(args[0], run(p, *args))
print('ERRORS:', errors or 'none')
