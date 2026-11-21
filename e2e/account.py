"""Merchant sign-up / sign-in helpers for e2e flows (ADR-023: email + password, no email codes)."""

PASSWORD = 'rahasia-pikul-1'


def sign_up(page, email, store='Warung Uji', owner='Budi Santoso', phone='0812 3456 7890', city='Bandung', password=PASSWORD):
    """On /app/ with no account: fill the "Daftar" tab and submit. Leaves the page on the first-time journey."""
    if page.get_by_role('radio', name='Daftar').get_attribute('aria-checked') != 'true':
        page.get_by_role('radio', name='Daftar').click()
    page.locator('#signup-ownerName').fill(owner)
    page.locator('#signup-storeName').fill(store)
    page.locator('#signup-phone').fill(phone)
    page.locator('#signup-city').fill(city)
    page.locator('#signup-email').fill(email)
    page.locator('#signup-password').fill(password)
    page.get_by_role('button', name='Daftar dan mulai 14 hari gratis').click()
    page.get_by_text('Bahasa / Language').wait_for()


def sign_in(page, email, password=PASSWORD):
    if page.get_by_role('radio', name='Masuk').get_attribute('aria-checked') != 'true':
        page.get_by_role('radio', name='Masuk').click()
    page.locator('#signin-email').fill(email)
    page.locator('#signin-password').fill(password)
    page.get_by_role('button', name='Masuk', exact=True).click()
