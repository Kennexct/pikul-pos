"""Builds the landing page in two forms from one source (ADR-013):
  python3 scripts/landing/build.py static  -> index.html (served at / by Cloudflare Pages)
  python3 scripts/landing/build.py dc OUT  -> design-canvas artboard (Main.dc.html) with /_blob images
"""
import sys

MODE = sys.argv[1] if len(sys.argv) > 1 else 'static'
if MODE == 'dc':
    IMG = {'pos': '/_blob/78ffea9e09d2c13a7cdb2981122c0f16', 'varian': '/_blob/3352e6f59e01b531438b26af34fa6595', 'tutup': '/_blob/f9b05dfd9b8b4b6ea43ebdb7e43332bb', 'timbang': '/_blob/0c7655b6f9bbb378b65e22295b7da530', 'bon': '/_blob/363d76b7946e84651fb5e5272efda5d9'}
else:
    IMG = {'pos': '/landing/pos.png', 'varian': '/landing/varian.png', 'tutup': '/landing/tutup-kasir.png', 'timbang': '/landing/timbang.png', 'bon': '/landing/bon.png'}
APP = '/app/'
G = '#0b7a5a'; INK = '#0f1a16'; SOFT = '#3d4a44'; MUTED = '#5b6862'; LINE = '#e3e8e5'; CANVAS = '#f6f8f7'

def ic(path): return f'<svg aria-hidden="true" style="flex: none" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="{G}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
I = {
'wifi':'<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M19 12.9a10 10 0 0 0-2.4-1.6"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8A15 15 0 0 0 10.7 5"/><circle cx="12" cy="20" r="0.5"/>',
'timer':'<circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2"/><path d="M10 2h4"/><path d="M12 2v4"/>',
'store':'<path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
'wallet':'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2"/><path d="M3 10h18"/>',
'receipt':'<path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5z"/><path d="M9 9h6M9 13h6"/>',
'layers':'<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
'rotate':'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
'chart':'<path d="M3 3v18h18"/><path d="M8 17V11M13 17V7M18 17v-4"/>',
'users':'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
'lock':'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
'save':'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
'qr':'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
'scale':'<path d="M12 3v18M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z"/>',
'globe':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
'tag':'<path d="M20 12 12 20l-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1"/>',
}
check = f'<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{G}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
clock = f'<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{MUTED}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'

SIZE = {'pos': (1024, 768), 'bon': (1024, 768), 'tutup': (1024, 768), 'varian': (390, 844), 'timbang': (390, 844)}
def shot(key, alt, w='100%', hero=False):
    iw, ih = SIZE[key]
    load = 'fetchpriority="high"' if hero else 'loading="lazy" decoding="async"'
    return f'<div{"" if hero else " data-reveal"} style="border-radius: 16px; border: 1px solid {LINE}; background: #fff; padding: 8px; box-shadow: 0 1px 2px rgba(15,26,22,.04), 0 12px 32px -12px rgba(15,26,22,.18)"><img src="{IMG[key]}" alt="{alt}" width="{iw}" height="{ih}" {load} style="display: block; width: {w}; height: auto; border-radius: 10px"></div>'
def eyebrow(t): return f'<p style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: {G}">{t}</p>'
def h2(t, id_=''): return f'<h2{f" id={chr(34)}{id_}{chr(34)}" if id_ else ""} style="margin: 0; font-size: clamp(28px, 4vw, 40px); line-height: 1.15; letter-spacing: -0.02em; font-weight: 800; color: {INK}">{t}</h2>'

usp = [('wifi','Jalan tanpa internet','Semua data tersimpan di perangkat. Sinyal hilang, penjualan tetap tercatat dan struk tetap keluar.'),
       ('timer','Siap dalam 2 menit','Daftar dengan email, pilih jenis usaha, dan contoh menu langsung jadi. Tanpa install dari toko aplikasi.'),
       ('store','Dibuat untuk cara jual kita','Bon pelanggan, QRIS statis, harga Dine In / Takeaway / ojol, jual per kilo, harga nego di meja kasir.'),
       ('wallet','Tahu uang dan untung tiap malam','Tutup kasir: uang laci seharusnya vs yang dihitung. Laba dari harga modal, bukan tebakan.')]
usp_html = ''.join(f'<div style="border-top: 2px solid {INK}; padding-top: 18px; display: flex; flex-direction: column; gap: 8px"><h3 style="margin: 0; display: flex; gap: 10px; align-items: flex-start; font-size: 18px; line-height: 1.3; font-weight: 800; letter-spacing: -0.01em; color: {INK}">{ic(I[i])}{a}</h3><p style="margin: 0; font-size: 15px; line-height: 1.6; color: {SOFT}">{b}</p></div>' for i,a,b in usp)

deep = [('varian','Layar pilih varian dan add-on di kasir','Varian &amp; add-on','Kopi → Latte → sedikit es, tanpa gula, Grande.','Setiap varian punya harga sendiri, termasuk harga Takeaway. Add-on seperti es, gula, dan ukuran bisa wajib atau opsional, dengan tambahan harga. Di struk dan laporan tertulis "Kopi – Latte", jadi Anda tahu minuman mana yang paling laku.', True),
        ('timbang','Layar isi berat atau nominal untuk barang timbangan','Untuk pedagang pasar','Jual per kilo, atau "beli sepuluh ribu".','Ketik beratnya (0,75 kg) atau uang pembeli (Rp10.000) dan beratnya dihitung sendiri. Harga hari ini beda? Ganti langsung di kasir; harga normal tetap tercatat.', True),
        ('bon','Daftar pelanggan yang belum bayar','Bon pelanggan','Catat bon, ingatkan lewat WhatsApp.','Simpan pesanan atas nama pelanggan dan bayar nanti. Lihat siapa yang belum bayar, berapa, dan sejak kapan, lalu kirim pengingat sopan dengan satu ketukan.', False),
        ('tutup','Layar tutup kasir dengan selisih uang laci','Tutup kasir','Uang di laci harusnya berapa? Sekarang ketahuan.','Modal awal + penjualan tunai − refund − pengeluaran dari laci. Hitung uangnya, ketik, dan lihat pas, kurang, atau lebih. Ringkasan bisa dikirim ke pemilik lewat WhatsApp.', False)]
deep_html = ''
for n,(k,alt,eb,title,body,phone) in enumerate(deep):
    text = f'<div style="flex: 1 1 360px; min-width: 0; display: flex; flex-direction: column; justify-content: center">{eyebrow(eb)}<h3 style="margin: 0; font-size: clamp(24px, 3vw, 32px); line-height: 1.2; letter-spacing: -0.02em; font-weight: 800; color: {INK}">{title}</h3><p style="margin: 16px 0 0; font-size: 17px; line-height: 1.65; color: {SOFT}; max-width: 520px">{body}</p></div>'
    img = f'<div style="flex: 1 1 420px; min-width: 0; display: flex; justify-content: center">{shot(k, alt, "min(100%, 380px)" if phone else "100%")}</div>'
    deep_html += f'<div style="display: flex; flex-wrap: wrap; gap: 48px; align-items: center">{text+img if n%2==0 else img+text}</div>'

feats = [('receipt','Kasir &amp; struk','Cetak struk 58/80 mm atau kirim lewat WhatsApp.'),('layers','Varian &amp; add-on','Harga per varian, add-on wajib atau opsional.'),('tag','Mode penjualan','Dine In, Takeaway, ojol; markup otomatis.'),('qr','QRIS statis','Tampilkan QRIS toko bersama total yang harus dibayar.'),('scale','Jual per berat','kg, ons, gram, liter, meter; per nominal.'),('rotate','Void &amp; refund','Dengan alasan, batas hari, dan izin pemilik.'),('chart','Laporan &amp; laba','Jam ramai, menu terlaris, ekspor Excel/PDF/CSV.'),('users','Pelanggan &amp; bon','Riwayat belanja dan pengingat bayar.'),('wallet','Kas &amp; pengeluaran','Belanja bahan, gas, upah; tutup kasir harian.'),('lock','Staf &amp; PIN','PIN per kasir, bagian pemilik terkunci.'),('save','Cadangan data','Simpan semua data ke satu berkas, pulihkan kapan saja.'),('globe','Indonesia &amp; English','Ganti bahasa per perangkat.')]
feat_html = ''.join(f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 18px 0; border-bottom: 1px solid {LINE}"><div style="flex: none; margin-top: 2px">{ic(I[i])}</div><div><h3 style="margin: 0; font-size: 16px; font-weight: 700; color: {INK}">{a}</h3><p style="margin: 4px 0 0; font-size: 14px; line-height: 1.55; color: {MUTED}">{b}</p></div></div>' for i,a,b in feats)

who = [('Kedai kopi','Varian minuman, es/gula/ukuran, harga Takeaway dan ojol.'),('Bakso &amp; warung makan','Pesanan per meja, simpan dulu bayar nanti, level pedas.'),('Gorengan &amp; jajanan','Satu ketuk per item, uang pas, antrean cepat.'),('Lapak pasar','Per kilo atau per nominal, harga harian, bon langganan.')]
who_html = ''.join(f'<div style="padding: 24px; border-radius: 14px; background: #fff; border: 1px solid {LINE}"><h3 style="margin: 0; font-size: 18px; font-weight: 700; color: {INK}">{a}</h3><p style="margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: {SOFT}">{b}</p></div>' for a,b in who)

steps = [('1','Daftar dengan email','Masukkan email, ketik kode yang kami kirim. Masa coba 14 hari langsung mulai.'),('2','Pilih jenis usaha','Bakso, kopi, gorengan, warung makan, atau mulai kosong. Contoh menu langsung jadi.'),('3','Mulai jualan','Ubah menu dan harga kapan saja. Pasang di layar utama tablet atau HP Anda.')]
steps_html = ''.join(f'<div style="display: flex; gap: 16px; align-items: flex-start"><div style="flex: none; width: 40px; height: 40px; border-radius: 999px; background: {G}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px">{n}</div><div><h3 style="margin: 6px 0 0; font-size: 18px; font-weight: 700; color: {INK}">{a}</h3><p style="margin: 6px 0 0; font-size: 15px; line-height: 1.6; color: {SOFT}">{b}</p></div></div>' for n,a,b in steps)

li = lambda xs, mark: ''.join(f'<li style="display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.5; color: {SOFT}"><span style="flex: none; margin-top: 1px">{mark}</span>{x}</li>' for x in xs)
all_feats = ['Kasir, struk, QRIS statis','Varian, add-on, mode penjualan','Jual per berat &amp; harga bebas','Laporan, laba, ekspor Excel/PDF','Pelanggan &amp; bon, kas &amp; tutup kasir','Staf &amp; PIN, cadangan ke berkas','Tanpa batas transaksi']
btn = 'display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none'
wrap = 'width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; box-sizing: border-box'

def plan_card(name, price, unit, note, badge, badge_cls, items, cta, primary, paid=True):
    bstyle = 'background: #e7f4ee; color: #075c44' if badge_cls == 'brand' else 'background: #f1f4f2; color: #3d4a44'
    border = f'2px solid {G}' if primary else f'1px solid {LINE}'
    cta_style = f'{btn}; margin-top: auto; background: {G}; color: #fff' if primary else f'{btn}; margin-top: auto; background: #fff; color: {INK}; border: 1px solid #c9d2cd'
    mark = ' data-plan-card' if paid else ''
    return f'''<div{mark} style="background: #fff; border: {border}; border-radius: 18px; padding: 28px; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px"><h3 style="margin: 0; font-size: 20px; font-weight: 800; color: {INK}">{name}</h3>{f'<span style="padding: 4px 10px; border-radius: 999px; {bstyle}; font-size: 13px; font-weight: 700">{badge}</span>' if badge else ''}</div>
<p style="margin: 0; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap"><span style="font-size: 40px; font-weight: 800; letter-spacing: -0.03em; color: {INK}">{price}</span><span style="font-size: 15px; color: {MUTED}">{unit}</span></p>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: {SOFT}">{note}</p>
<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px">{li(items, check)}</ul>
<a href="{APP}" style="{cta_style}">{cta}</a>
</div>'''

pricing = (plan_card('Coba gratis', 'Rp0', '14 hari', 'Semua fitur, tanpa kartu kredit. Cukup daftar dengan email.', 'Mulai di sini', 'brand', all_feats, 'Coba gratis 14 hari', True, paid=False)
         + plan_card('Bulanan', 'Rp49.000', '/ 30 hari', 'Lanjut setelah masa coba.', '', '', ['Semua fitur di masa coba', 'Perpanjang kapan saja, tanpa hari hilang', 'Data tetap milik Anda'], 'Mulai dengan masa coba', False)
         + plan_card('Tahunan', 'Rp490.000', '/ 365 hari', 'Hemat dua bulan dibanding bayar bulanan.', 'Hemat 2 bulan', 'neutral', ['Semua fitur di masa coba', 'Sekali bayar untuk setahun', 'Data tetap milik Anda'], 'Mulai dengan masa coba', False))

soon = ['Cadangan otomatis ke cloud','Data tersinkron antar perangkat','Laporan gabungan semua kasir']

faqs = [('Benar-benar bisa tanpa internet?','Ya. Daftar dan masuk pertama kali butuh internet. Setelah itu Pikul menyimpan semua data di perangkat: penjualan, struk, laporan, dan tutup kasir tetap jalan saat sinyal hilang.'),
        ('Apa yang terjadi kalau masa coba habis?','Laporan, riwayat, ekspor, dan cadangan data tetap bisa dibuka. Hanya penjualan baru yang berhenti sampai Anda memperpanjang. Data tidak pernah dihapus.'),
        ('Bagaimana cara membayar?','Pembayaran langganan online sedang kami siapkan. Selama masa coba, semua fitur bisa dipakai gratis tanpa kartu kredit.'),
        ('Data saya aman di mana?','Di perangkat Anda sendiri. Akun hanya dipakai untuk masuk dan langganan. Simpan cadangan rutin lewat Pengaturan → Cadangan; cadangan otomatis ke cloud sedang disiapkan.'),
        ('Perangkat apa yang dibutuhkan?','Tablet atau HP Android/iPhone dengan browser modern, atau laptop. Untuk cetak struk, pakai printer yang sudah terpasang di perangkat.'),
        ('Apakah QRIS-nya otomatis terkonfirmasi?','Belum. Pikul menampilkan QRIS statis toko Anda; kasir menekan "Sudah dibayar" setelah melihat notifikasi dari bank.')]
faq_html = ''.join(f'<details style="border-bottom: 1px solid {LINE}; padding: 4px 0"><summary style="cursor: pointer; list-style: none; padding: 18px 0; font-size: 17px; font-weight: 700; color: {INK}">{q}</summary><p style="margin: 0 0 20px; font-size: 16px; line-height: 1.65; color: {SOFT}; max-width: 760px">{a}</p></details>' for q,a in faqs)

# Pikul logo (ADR-016, brand kit v1): mark on a pandan tile + ExtraBold wordmark.
logo = f'<span style="display: inline-flex; align-items: center; gap: 10px"><svg aria-hidden="true" width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="14.4" fill="{G}"/><g transform="translate(7.86 10.13) scale(0.7543)"><circle cx="32" cy="14" r="6.5" fill="#f2a93b"/><path d="M7 32Q32 22 57 32" fill="none" stroke="#f6f1e7" stroke-width="6" stroke-linecap="round"/><rect x="13" y="29" width="4" height="11" fill="#f6f1e7"/><rect x="47" y="29" width="4" height="11" fill="#f6f1e7"/><path d="M4 39.5h22a11 11 0 0 1-22 0z" fill="#f6f1e7"/><path d="M38 39.5h22a11 11 0 0 1-22 0z" fill="#f6f1e7"/></g></svg><span style="font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: {INK}">Pikul</span></span>'
navlink = f'color: {SOFT}; text-decoration: none; font-size: 15px; font-weight: 600; padding: 10px 0'

body = f'''<div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: {CANVAS}; color: {INK}; min-width: 0">
<header style="position: sticky; top: 0; z-index: 10; background: rgba(246,248,247,.92); backdrop-filter: blur(8px); border-bottom: 1px solid {LINE}">
<div style="{wrap}; display: flex; align-items: center; gap: 12px 28px; min-height: 64px">
<a href="#top" aria-label="Pikul, ke atas" style="text-decoration: none">{logo}</a>
<nav class="lp-nav" aria-label="Navigasi halaman" style="display: flex; gap: 4px 24px; flex: 1 1 auto"><a href="#fitur" style="{navlink}">Fitur</a><a href="#untuk-siapa" style="{navlink}">Untuk siapa</a><a href="#harga" style="{navlink}">Harga</a><a href="#faq" style="{navlink}">FAQ</a></nav>
<a href="{APP}" class="lp-signin" style="{navlink}; color: {INK}; white-space: nowrap">Masuk</a>
<a href="{APP}" style="{btn}; min-height: 44px; padding: 0 18px; font-size: 15px; background: {G}; color: #fff; white-space: nowrap">Coba gratis</a>
</div>
</header>

<main id="top">
<section style="padding: 72px 0 56px">
<div style="{wrap}; display: flex; flex-wrap: wrap; gap: 56px; align-items: center">
<div style="flex: 1 1 440px; min-width: 0">
<h1 style="margin: 0; font-size: clamp(38px, 5.6vw, 64px); line-height: 1.05; letter-spacing: -0.035em; font-weight: 800; color: {INK}">Kasir yang tetap jalan, walau sinyal hilang.</h1>
<p style="margin: 22px 0 0; font-size: clamp(17px, 2vw, 20px); line-height: 1.6; color: {SOFT}; max-width: 560px">Untuk warung, kedai kopi, gorengan, sampai lapak pasar. Catat penjualan, bon pelanggan, dan uang laci di tablet atau HP yang sudah Anda punya. Coba gratis 14 hari.</p>
<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px">
<a href="{APP}" style="{btn}; background: {G}; color: #fff">Coba gratis 14 hari</a>
<a href="#fitur" style="{btn}; background: #fff; color: {INK}; border: 1px solid #c9d2cd">Lihat fitur</a>
</div>
<ul style="list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-wrap: wrap; gap: 10px 24px">
<li style="display: flex; gap: 8px; align-items: center; font-size: 15px; font-weight: 600; color: {SOFT}">{check}Tanpa kartu kredit</li>
<li style="display: flex; gap: 8px; align-items: center; font-size: 15px; font-weight: 600; color: {SOFT}">{check}Jalan offline</li>
<li style="display: flex; gap: 8px; align-items: center; font-size: 15px; font-weight: 600; color: {SOFT}">{check}Bahasa Indonesia &amp; English</li>
</ul>
</div>
<div class="lp-hero-shot" style="flex: 1 1 520px; min-width: 0">{shot('pos', 'Layar kasir Pikul di tablet dengan menu kedai kopi', hero=True)}</div>
</div>
</section>

<section aria-labelledby="usp-title" style="padding: 40px 0 72px">
<div style="{wrap}">
<h2 id="usp-title" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Kenapa Pikul</h2>
<div class="lp-usp">{usp_html}</div>
</div>
</section>

<section id="fitur" style="padding: 72px 0; background: #fff; border-top: 1px solid {LINE}; border-bottom: 1px solid {LINE}">
<div style="{wrap}; display: flex; flex-direction: column; gap: 96px">
<div data-reveal style="max-width: 720px">{eyebrow('Yang membuatnya berbeda')}{h2('Dibuat dari cara pedagang Indonesia benar-benar berjualan.')}</div>
{deep_html}
</div>
</section>

<section aria-labelledby="semua-fitur" style="padding: 88px 0">
<div style="{wrap}">
<div style="max-width: 720px; margin-bottom: 36px">{eyebrow('Semua fitur')}{h2('Semua yang dibutuhkan satu toko, dalam satu aplikasi.', 'semua-fitur')}</div>
<div class="lp-feats">{feat_html}</div>
</div>
</section>

<section id="untuk-siapa" style="padding: 24px 0 88px">
<div style="{wrap}; display: flex; flex-wrap: wrap; gap: 48px">
<div style="flex: 1 1 320px; min-width: 0">{eyebrow('Untuk siapa')}{h2('Satu kasir, empat cara berjualan.')}<p style="margin: 16px 0 0; font-size: 17px; line-height: 1.65; color: {SOFT}">Pilih jenis usaha saat pertama buka, dan Pikul menyiapkan contoh menu yang cocok. Semuanya bisa diubah.</p></div>
<div style="flex: 2 1 560px; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px">{who_html}</div>
</div>
</section>

<section aria-labelledby="cara-mulai" style="padding: 80px 0; background: #fff; border-top: 1px solid {LINE}; border-bottom: 1px solid {LINE}">
<div style="{wrap}">
<div style="max-width: 720px; margin-bottom: 40px">{eyebrow('Cara mulai')}{h2('Dari daftar sampai transaksi pertama: tiga langkah.', 'cara-mulai')}</div>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 32px">{steps_html}</div>
</div>
</section>

<section id="harga" style="padding: 96px 0">
<div style="{wrap}">
<div style="max-width: 720px; margin: 0 auto 48px; text-align: center">{eyebrow('Harga')}{h2('Coba 14 hari gratis. Lanjut kalau cocok.')}<p style="margin: 16px 0 0; font-size: 17px; line-height: 1.65; color: {SOFT}">Satu harga, semua fitur. Tanpa biaya per transaksi.</p></div>
<div id="paket-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 1080px; margin: 0 auto">{pricing}</div>
<div style="max-width: 1080px; margin: 24px auto 0; padding: 20px 24px; border: 1px dashed #c9d2cd; border-radius: 14px; display: flex; flex-wrap: wrap; gap: 12px 28px; align-items: center">
<p style="margin: 0; font-size: 15px; font-weight: 700; color: {INK}">Segera hadir untuk pelanggan:</p>
<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 10px 24px">{li(soon, clock)}</ul>
</div>
<p style="margin: 20px auto 0; max-width: 900px; text-align: center; font-size: 14px; color: {MUTED}">Harga dapat berubah sebelum peluncuran resmi.</p>
</div>
</section>

<section id="faq" style="padding: 80px 0; background: #fff; border-top: 1px solid {LINE}">
<div style="{wrap}; max-width: 880px">
{eyebrow('Pertanyaan umum')}{h2('Yang sering ditanyakan')}
<div style="margin-top: 24px; border-top: 1px solid {LINE}">{faq_html}</div>
</div>
</section>

<section aria-labelledby="cta-akhir" style="padding: 88px 0; background: #0a3d2e">
<div style="{wrap}; display: flex; flex-wrap: wrap; gap: 32px; align-items: center; justify-content: space-between">
<div style="flex: 1 1 480px; min-width: 0">
<h2 id="cta-akhir" style="margin: 0; font-size: clamp(30px, 4vw, 44px); line-height: 1.1; letter-spacing: -0.025em; font-weight: 800; color: #fff">Buka toko digital Anda hari ini.</h2>
<p style="margin: 14px 0 0; font-size: 18px; line-height: 1.6; color: #c6e3d6">Dua menit dari sekarang, transaksi pertama Anda sudah tercatat.</p>
</div>
<a href="{APP}" style="{btn}; background: #fff; color: #0a3d2e">Coba gratis 14 hari</a>
</div>
</section>
</main>

<footer style="padding: 32px 0; border-top: 1px solid {LINE}">
<div style="{wrap}; display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; justify-content: space-between">
{logo}
<p style="margin: 0; font-size: 14px; color: {MUTED}"><strong style="color: {INK}">Jualan ringan. Catatan beres.</strong> Aplikasi kasir offline untuk UMKM Indonesia. Tersedia dalam Bahasa Indonesia dan English.</p>
</div>
</footer>
</div>'''

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">'
CSS = f'body{{margin:0}}'
CSS += '.lp-usp{display:grid;gap:28px 32px;grid-template-columns:1fr}@media(min-width:600px){.lp-usp{grid-template-columns:repeat(2,1fr)}}@media(min-width:1000px){.lp-usp{grid-template-columns:repeat(4,1fr)}}'
CSS += f'.lp-feats{{display:grid;column-gap:40px;grid-template-columns:1fr;border-top:1px solid {LINE}}}@media(min-width:640px){{.lp-feats{{grid-template-columns:repeat(2,1fr)}}}}@media(min-width:1000px){{.lp-feats{{grid-template-columns:repeat(3,1fr)}}}}'
CSS += '@media(max-width:719px){.lp-nav{display:none!important}.lp-signin{margin-left:auto}}'
# Motion: the hero screenshot settles in once (transform only, so it never delays LCP); sections below the fold
# rise as they scroll in (live.ts adds .lp-pending only to elements still off-screen, so no-JS shows everything).
CSS += '@keyframes lp-settle{from{transform:translateY(28px)}}.lp-hero-shot{animation:lp-settle .7s cubic-bezier(.25,1,.5,1) both}'
CSS += '[data-reveal]{transition:opacity .6s cubic-bezier(.25,1,.5,1),transform .6s cubic-bezier(.25,1,.5,1)}[data-reveal].lp-pending{opacity:0;transform:translateY(24px)}'
CSS += '@media(prefers-reduced-motion:reduce){.lp-hero-shot{animation:none}[data-reveal]{transition:none}[data-reveal].lp-pending{opacity:1;transform:none}}'
CSS += f'a{{color:{G}}}a:hover{{opacity:.92}}a:focus-visible,summary:focus-visible{{outline:3px solid {G};outline-offset:3px;border-radius:6px}}summary::-webkit-details-marker{{display:none}}'

if MODE == 'dc':
    out = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Pikul — aplikasi kasir untuk UMKM</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>{CSS}</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":7400}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
    open(sys.argv[2], 'w').write(out)
else:
    out = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pikul — aplikasi kasir offline untuk UMKM Indonesia</title>
<meta name="description" content="Aplikasi kasir untuk warung, kedai kopi, gorengan, dan lapak pasar. Jalan tanpa internet, bon pelanggan, QRIS, jual per kilo, tutup kasir. Coba gratis 14 hari.">
<meta name="theme-color" content="#0b7a5a">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<meta property="og:site_name" content="Pikul">
<meta property="og:title" content="Pikul — kasir yang tetap jalan, walau sinyal hilang">
<meta property="og:description" content="Aplikasi kasir offline untuk UMKM Indonesia. Coba gratis 14 hari.">
<meta property="og:image" content="/landing/pos.png">
{FONTS}
<style>{CSS}</style>
</head>
<body>
{body}
<!-- ADR-014: live plans + campaign pop-up from /api/public/landing; the prices above are the no-JS fallback. -->
<script type="module" src="/src/landing/live.ts"></script>
</body>
</html>
'''
    open('index.html', 'w').write(out)
print(MODE, len(out))
