"""v0.20 (ADR-027): reopening the register on the same day starts a NEW shift.
Closed shifts stay locked, the new shift's opening cash comes from the last count and can be changed,
Kas shows every shift plus the day's total, and "Riwayat tutup" names each shift.
Usage: python3 e2e/v23.py http://localhost:4173/app OUT"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sample_menu import skip_with_sample_menu  # noqa: E402

BASE, OUT = sys.argv[1:3]
errors = []
results = {}


def shot(page, name):
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/{name}.png')


def check(name, key, value):
    results[f'{name}:{key}'] = value


def sell(page, is_mobile, product):
    page.goto(BASE + '/')
    page.get_by_role('button', name=re.compile(f'^{product}')).first.click()
    page.wait_for_timeout(300)
    if is_mobile:
        page.get_by_role('button', name='Lihat pesanan').click()
    page.get_by_role('button', name='Bayar').click()
    page.get_by_role('button', name='Uang pas').click()
    page.get_by_role('button', name='Selesaikan pembayaran').click()
    page.get_by_text('Pembayaran berhasil').wait_for()
    page.get_by_role('button', name='Transaksi baru').click()


def close_register(page, counted, button=re.compile('^Tutup (kasir|shift)')):
    dialog = page.get_by_role('dialog')
    page.get_by_role('button', name=button).first.click()
    dialog.locator('#counted-cash').fill(counted)
    dialog.get_by_role('button', name=button).click()
    page.get_by_text(re.compile('Kasir ditutup')).wait_for()


def run(p, name, viewport, is_mobile):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = browser.new_context(locale='id-ID', timezone_id='Asia/Jakarta', viewport=viewport, is_mobile=is_mobile, has_touch=is_mobile)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{name} console: {m.text}'))
    page.on('response', lambda r: r.status >= 400 and errors.append(f'{name}: {r.status} {r.url}'))
    dialog = page.get_by_role('dialog')

    page.goto(BASE + '/')
    skip_with_sample_menu(page)

    # 1. Shift 1: open with Rp50.000, sell one Kerupuk (Rp2.000), close counting Rp52.000 (exact).
    page.goto(BASE + '/kas')
    page.get_by_role('button', name='Buka kasir').first.click()
    dialog.locator('#opening-cash').fill('50000')
    dialog.get_by_role('button', name='Buka kasir').click()
    page.get_by_text('Kasir dibuka · modal Rp50.000').wait_for()
    sell(page, is_mobile, 'Kerupuk')
    page.goto(BASE + '/kas')
    close_register(page, '52000')
    shot(page, f'{name}-s1-shift1-closed')
    check(name, 'shift1_can_be_reopened_before_next', page.get_by_role('button', name='Buka kembali').count() == 1)

    # 2. The cashier is told which shift closed and opens a new one; the float is prefilled and editable.
    page.goto(BASE + '/')
    page.get_by_text(re.compile(r'Shift 1 ditutup \d\d[.:]\d\d')).wait_for()
    shot(page, f'{name}-s2-cashier-banner')
    page.get_by_role('button', name='Buka shift baru').click()
    dialog.get_by_role('heading', name='Buka shift baru').wait_for()
    check(name, 'prefilled_from_last_count', dialog.locator('#opening-cash').input_value().replace('.', '') == '52000')
    check(name, 'names_closed_shift', bool(re.search(r'Shift 1 ditutup \d\d[.:]\d\d', dialog.inner_text())))
    shot(page, f'{name}-s3-new-shift-sheet')
    dialog.locator('#opening-cash').fill('50000')  # the owner took Rp2.000 out of the drawer
    dialog.get_by_role('button', name='Buka shift 2').click()
    page.get_by_text('Shift 2 dibuka · modal Rp50.000').wait_for()
    check(name, 'opening_cash_editable', True)

    # 3. Shift 2 counts only its own sale, and shift 1 is locked.
    sell(page, is_mobile, 'Air Mineral')
    page.goto(BASE + '/kas')
    page.get_by_role('heading', name=re.compile('Kas laci · Shift 2')).wait_for()
    drawer2 = page.get_by_role('region', name='Kas laci').inner_text()
    check(name, 'shift2_starts_from_its_own_float', 'Rp50.000' in drawer2)
    check(name, 'shift1_sale_not_counted_again', '+ Rp2.000' not in drawer2 and '+ Rp4.000' in drawer2)
    check(name, 'closed_shift_locked', page.get_by_role('button', name='Buka kembali').count() == 0)
    shifts = page.get_by_role('region', name='Semua shift hari ini')
    shifts_text = shifts.inner_text()
    check(name, 'shift_list_shows_both', 'Shift 1' in shifts_text and 'Shift 2' in shifts_text and 'Sedang berjalan' in shifts_text)
    shot(page, f'{name}-s4-shifts-card')
    shifts.get_by_role('button', name=re.compile('^Shift 1')).click()
    page.get_by_role('heading', name=re.compile('Kas laci · Shift 1')).wait_for()
    check(name, 'shift1_figures_kept', 'Rp52.000' in page.get_by_role('region', name='Kas laci').inner_text())
    shot(page, f'{name}-s5-shift1-selected')

    # 4. Close shift 2; the day's total adds both shifts and the history names each shift.
    shifts.get_by_role('button', name=re.compile('^Shift 2')).click()
    page.get_by_role('heading', name=re.compile('Kas laci · Shift 2')).wait_for()
    close_register(page, '51000')  # Air Mineral Rp4.000 ⇒ expected Rp54.000, Rp3.000 short
    page.get_by_text(re.compile('Kasir ditutup, selisih kurang Rp3.000')).wait_for()
    page.get_by_text('Selisih laci (2 shift ditutup)').wait_for()
    day = page.get_by_role('region', name='Semua shift hari ini').inner_text()
    check(name, 'day_total_sums_shifts', 'Rp6.000' in day)  # 2.000 + 4.000 net sales
    check(name, 'day_difference_sums_shifts', 'Kurang Rp3.000' in day)
    shot(page, f'{name}-s6-day-total')
    page.get_by_role('tab', name='Riwayat tutup').click()
    history = page.get_by_role('list').first.inner_text()
    check(name, 'history_names_shifts', 'Shift 1' in history and 'Shift 2' in history)
    shot(page, f'{name}-s7-closing-history')

    # 5. After the last shift closed, the cashier can still open another one.
    page.goto(BASE + '/')
    page.get_by_text(re.compile(r'Shift 2 ditutup \d\d[.:]\d\d')).wait_for()
    page.get_by_role('button', name='Buka shift baru').click()
    dialog.get_by_role('button', name='Buka shift 3').wait_for()
    check(name, 'third_shift_offered', dialog.locator('#opening-cash').input_value().replace('.', '') == '51000')
    shot(page, f'{name}-s8-third-shift')
    browser.close()


with sync_playwright() as p:
    run(p, 'tablet', {'width': 1024, 'height': 768}, False)
    run(p, 'phone', {'width': 390, 'height': 844}, True)
failed = [k for k, v in results.items() if not v]
print('CHECKS:', len(results), 'failed:', failed or 'none')
print('ERRORS:', errors or 'none')
