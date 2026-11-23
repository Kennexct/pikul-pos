"""v0.20 product form: new category typed but not added is created on save; price field replaces its 0;
"Simpan & tambah lagi" keeps the category; variants by quick fill + Enter; blank trailing row dropped. Phone and tablet.
Usage: python3 e2e/v20.py http://localhost:4173/app OUT"""
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from sample_menu import skip_with_sample_menu
BASE, OUT = sys.argv[1:3]
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
GET_JS = """async () => { const db = await new Promise((ok)=>{const r=indexedDB.open('kasirku'); r.onsuccess=()=>ok(r.result);});
 const all=(s)=>new Promise((ok)=>{const r=db.transaction(s).objectStore(s).getAll(); r.onsuccess=()=>ok(r.result);});
 const cats=await all('categories'); const prods=await all('products'); db.close();
 return prods.filter(p=>p.name.includes('Uji')).map(p=>({name:p.name, price:p.basePrice, cat:(cats.find(c=>c.id===p.categoryId)||{}).name, variants:(p.variants||[]).map(v=>v.name+':'+v.price)})); }"""
errors=[]
def run(p, name, vp, mobile):
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(locale='id-ID', viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=2)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type=='error' and errors.append(m.text))
    page.goto(BASE); skip_with_sample_menu(page)
    page.goto(BASE + '/produk'); page.wait_for_timeout(800)
    page.get_by_role('button', name='Produk', exact=True).first.click()
    d = page.get_by_role('dialog'); d.locator('#product-name').wait_for()
    page.wait_for_timeout(500); page.screenshot(path=f'{OUT}/{name}-1-empty.png')
    page.keyboard.type('Es Teh Uji')
    d.get_by_role('button', name='Kategori baru').click()
    d.get_by_label('Nama kategori baru').fill('Minuman Dingin')
    d.locator('#base-price').click(); page.keyboard.type('10000')
    if d.locator('#base-price').input_value() != '10.000':
        errors.append(f"{name}: price field shows {d.locator('#base-price').input_value()}")
    page.screenshot(path=f'{OUT}/{name}-2-filled.png')
    d.get_by_role('button', name='Simpan & tambah lagi').click()
    page.wait_for_timeout(600)
    # second product with variants
    page.keyboard.type('Kopi Uji')
    d.get_by_role('radio', name='Ada varian').click()
    page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/{name}-3-variants-fresh.png')
    d.get_by_role('button', name='Kecil · Sedang · Besar').click()
    prices = d.locator('input[id^="variant-price-"]')
    prices.nth(0).click(); page.keyboard.type('15000'); page.keyboard.press('Enter')
    page.keyboard.press('Enter'); page.keyboard.type('18000'); page.keyboard.press('Enter')
    page.keyboard.press('Enter'); page.keyboard.type('21000'); page.keyboard.press('Enter')  # adds blank 4th row
    page.wait_for_timeout(200)
    d.get_by_role('button', name='Detail: harga lain, modal, urutan').first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/{name}-4-variants.png', full_page=False)
    d.get_by_role('button', name='Simpan produk').click()
    d.wait_for(state='detached')
    saved = page.evaluate(GET_JS)
    print(name, json.dumps(saved))
    expected = [{'name': 'Es Teh Uji', 'price': 10000, 'cat': 'Minuman Dingin', 'variants': []},
                {'name': 'Kopi Uji', 'price': 15000, 'cat': 'Minuman Dingin', 'variants': ['Kecil:15000', 'Sedang:18000', 'Besar:21000']}]
    if sorted(saved, key=lambda r: r['name']) != expected:
        errors.append(f'{name}: saved products differ: {saved}')
    page.get_by_role('button', name='Produk', exact=True).first.click()
    d = page.get_by_role('dialog'); d.locator('#product-name').wait_for()
    d.get_by_role('button', name='Pengaturan lain').click()
    page.wait_for_timeout(300)
    d.locator('#product-name').evaluate('e => e.closest(".overflow-y-auto").scrollTo(0, 9999)')
    page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/{name}-5-more.png')
    b.close()
with sync_playwright() as p:
    run(p, 'phone', {'width':390,'height':844}, True)
    run(p, 'tablet', {'width':1024,'height':768}, False)
print('ERRORS:', errors or 'none')
