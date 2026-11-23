import type { HelpContent } from './help';

export const HELP_ID: HelpContent = {
  intro: [
    { title: 'Jual dalam tiga ketukan', body: 'Ketuk menu, ketuk Bayar, pilih cara bayar. Struk bisa dicetak atau dikirim lewat WhatsApp.' },
    { title: 'Belum bayar? Simpan dulu', body: 'Pesanan meja atau bon pelanggan bisa disimpan dan dibayar nanti dari menu Pesanan.' },
    { title: 'Tutup kasir setiap malam', body: 'Hitung uang di laci, ketik jumlahnya, dan aplikasi menunjukkan apakah pas, kurang, atau lebih.' },
    { title: 'Data ada di perangkat ini', body: 'Aplikasi tetap jalan tanpa internet. Simpan cadangan seminggu sekali supaya data aman kalau perangkat rusak.' },
  ],
  topics: {
    jual: {
      title: 'Menjual dan menerima pembayaran',
      summary: 'Layar Kasir dipakai untuk mencatat setiap penjualan. Semua langsung tersimpan di perangkat, dengan atau tanpa internet.',
      steps: [
        'Ketuk menu yang dipesan. Ketuk lagi untuk menambah jumlah.',
        'Periksa pesanan di sebelah kanan (di HP: ketuk "Lihat pesanan"). Jumlah dan catatan bisa diubah di sana.',
        'Ketuk Bayar, lalu pilih cara bayar.',
        'Untuk tunai, ketuk "Uang pas" atau nominal yang diterima. Kembalian dihitung otomatis.',
        'Ketuk "Selesaikan pembayaran". Struk muncul dan siap dicetak atau dikirim.',
      ],
      notes: ['Keranjang tidak hilang kalau aplikasi tertutup tidak sengaja.', 'Salah input setelah dibayar? Lihat topik "Riwayat, void, dan refund".'],
      keywords: 'kasir transaksi bayar tunai kembalian keranjang',
    },
    varian: {
      title: 'Varian, add-on, dan mode penjualan',
      summary: 'Varian adalah jenis dari satu menu dengan harga sendiri (Kopi: Latte, Americano, Espresso). Add-on adalah pilihan tambahan untuk menu itu (es, gula, ukuran, topping). Mode penjualan membedakan harga makan di tempat, bungkus, atau ojek online.',
      steps: [
        'Di Produk, buka menu lalu pilih "Ada varian" di bagian Harga. Isi nama dan harga setiap varian; harga Takeaway dan modal ada di Detail varian.',
        'Buat grup add-on di Produk, tab Add-on (misalnya Es: es normal, sedikit es, tanpa es). Beri tambahan harga kalau perlu, misalnya Grande +Rp4.000.',
        'Pasang grup add-on di menu, di bagian Add-on pada formulir produk.',
        'Di Kasir, ketuk menunya: pilih varian dulu, lalu add-on, lalu "Tambah ke pesanan".',
        'Ganti mode (Dine In, Takeaway, dan lainnya) di atas daftar menu. Harga di keranjang ikut berubah.',
      ],
      notes: [
        'Di struk dan laporan, menu bervarian tertulis "Kopi – Latte", jadi penjualan setiap varian terlihat terpisah.',
        'Varian yang habis bisa ditandai sendiri di daftar stok habis; varian lain tetap bisa dijual.',
        'Tiga cara harga per mode: sama dengan harga dasar, harga khusus per produk atau varian, atau naik sekian persen.',
        'Kasir tetap memakai mode terakhir sampai Anda menggantinya.',
      ],
      keywords: 'varian add-on addon modifier topping es gula ukuran tall grande venti takeaway bungkus dine in gofood grab markup level',
    },
    diskon: {
      title: 'Diskon',
      summary: 'Potongan untuk satu pesanan, dalam persen atau rupiah.',
      steps: ['Di keranjang, ketuk "Tambah diskon".', 'Pilih diskon yang sudah disiapkan, atau ketik persen atau rupiah sendiri.', 'Total langsung berubah. Hapus diskon dari tempat yang sama.'],
      notes: ['Pemilik bisa membatasi diskon kasir di Pengaturan, tab Staf & PIN. Di atas batas itu, aplikasi meminta PIN pemilik.'],
      keywords: 'potongan promo persen',
    },
    simpan: {
      title: 'Simpan pesanan (bayar nanti atau bon)',
      summary: 'Untuk pelanggan yang makan dulu baru bayar, atau langganan yang bayar belakangan.',
      steps: [
        'Isi keranjang seperti biasa, lalu ketuk Simpan.',
        'Beri label, misalnya "Meja 3" atau "Bon Bu Sari". Pilih pelanggan kalau ini bon.',
        'Saat pelanggan membayar, buka menu Pesanan, ketuk pesanannya, lalu Bayar.',
      ],
      notes: [
        'Pesanan dihitung sebagai penjualan pada hari dibayar, bukan hari disimpan.',
        'Bon yang punya nama pelanggan muncul di Pelanggan, tab "Belum bayar".',
        'Pesanan yang batal bisa dibatalkan dengan alasan, dan tetap tercatat.',
      ],
      keywords: 'open bill meja hutang kasbon tersimpan',
    },
    qris: {
      title: 'QRIS statis',
      summary: 'Unggah gambar QRIS toko Anda sekali, lalu tampilkan ke pelanggan setiap ada pembayaran QRIS.',
      steps: [
        'Buka Pengaturan, tab Pembayaran, bagian QRIS, lalu unggah foto atau gambar QRIS.',
        'Saat membayar, pilih QRIS. Kode tampil besar bersama total yang harus dibayar.',
        'Setelah uang masuk di aplikasi bank atau dompet Anda, ketuk "Sudah dibayar".',
      ],
      notes: ['Aplikasi tidak tahu apakah uang sudah masuk. Selalu periksa notifikasi dari bank sebelum menekan "Sudah dibayar".', 'Nomor referensi bisa dicatat kalau diperlukan untuk pencocokan.'],
      keywords: 'qr scan barcode gopay ovo dana transfer',
    },
    struk: {
      title: 'Struk: cetak atau kirim WhatsApp',
      summary: 'Setiap penjualan punya struk dengan nomor unik.',
      steps: [
        'Setelah pembayaran, struk tampil otomatis. Ketuk Cetak atau WhatsApp.',
        'Untuk mengirim ulang, buka Riwayat, ketuk transaksinya, lalu pilih Cetak atau WhatsApp.',
        'Atur nama toko, alamat, teks kaki struk, dan ukuran kertas (58 atau 80 mm) di Pengaturan, tab Toko & Struk.',
      ],
      notes: ['Kalau pesanan punya pelanggan dengan nomor HP, WhatsApp langsung terbuka ke nomor itu.', 'Cetak memakai printer yang terpasang di perangkat.'],
      keywords: 'nota bon kertas printer thermal kirim',
    },
    riwayat: {
      title: 'Riwayat, void, dan refund',
      summary: 'Semua penjualan ada di Riwayat. Void membatalkan seluruh transaksi di hari yang sama. Refund mengembalikan sebagian atau semua item.',
      steps: [
        'Buka Riwayat dan pilih periode. Cari dengan nomor struk, label, atau nama pelanggan.',
        'Ketuk transaksi untuk melihat rinciannya.',
        'Pilih Void (hari yang sama, seluruh transaksi) atau Refund (pilih item dan jumlahnya), lalu pilih alasan.',
      ],
      notes: [
        'Refund dihitung pada hari refund dilakukan, bukan hari penjualannya.',
        'Siapa yang boleh void dan refund, dan sampai berapa hari, diatur pemilik di Pengaturan, tab Staf & PIN.',
        'Transaksi tidak pernah dihapus. Void dan refund tercatat beserta pelakunya.',
      ],
      keywords: 'batal salah input kembalikan uang retur hapus transaksi',
    },
    laporan: {
      title: 'Laporan, laba, dan ekspor',
      summary: 'Laporan menunjukkan penjualan, jam ramai, cara bayar, menu terlaris, dan laba untuk periode yang Anda pilih. Hanya pemilik yang bisa membukanya.',
      steps: [
        'Buka Laporan dan pilih periode.',
        'Penjualan bersih adalah penjualan dikurangi refund pada periode itu.',
        'Bagian Laba muncul kalau Anda mengisi harga modal produk atau mencatat pengeluaran.',
        'Ketuk Ekspor untuk membuat berkas Excel, PDF, atau CSV.',
      ],
      notes: [
        'Dengan harga modal: laba = penjualan − modal menu terjual − biaya operasional. Belanja bahan tidak dikurangkan lagi karena sudah masuk harga modal.',
        'Tanpa harga modal: yang ditampilkan adalah penjualan dikurangi semua pengeluaran.',
        'Laporan hanya memuat transaksi dari perangkat ini.',
      ],
      keywords: 'omzet untung rugi excel pdf csv rekap harian bulanan hpp margin',
    },
    kas: {
      title: 'Kas, pengeluaran, dan tutup kasir',
      summary: 'Layar Kas menjawab pertanyaan "uang di laci harusnya berapa?" dan mencatat uang yang keluar.',
      steps: [
        'Sebelum penjualan pertama, kasir meminta "Buka kasir": hitung uang kembalian di laci dan ketik jumlahnya.',
        'Setiap ada uang keluar (belanja bahan, gas, upah), ketuk "Catat pengeluaran". Matikan "Dibayar dari uang laci" kalau uangnya bukan dari laci.',
        'Malam hari, ketuk "Tutup kasir", hitung uang di laci, dan ketik jumlahnya.',
        'Aplikasi mencatat selisihnya. Ringkasan bisa dikirim ke pemilik lewat WhatsApp.',
      ],
      notes: [
        'Uang seharusnya = modal awal + penjualan tunai − refund tunai − pengeluaran dari laci.',
        'Ada penjualan setelah kasir ditutup? Pemilik bisa "Buka kembali" lalu menutup lagi.',
        'Saat menutup, menu bertanda Habis bisa dikembalikan otomatis untuk besok.',
      ],
      keywords: 'laci setoran selisih kurang lebih closing shift biaya belanja buka kasir modal',
    },
    produk: {
      title: 'Produk, harga modal, dan stok habis',
      summary: 'Kelola menu, foto, kategori, harga per mode, dan tandai menu yang sedang habis.',
      steps: [
        'Buka Produk untuk menambah atau mengubah menu, termasuk foto dan kategori.',
        'Isi "Harga modal" (biaya membuat satu porsi) kalau ingin melihat laba di Laporan.',
        'Menu habis hari ini? Di Kasir, ketuk tombol kotak bersilang di samping pencarian, lalu nyalakan menunya.',
      ],
      notes: ['Tab Kategori: tambah, ganti nama, ubah urutan, atau hapus kategori. Produk dari kategori yang dihapus pindah ke Tanpa kategori.', 'Produk dengan varian punya tombol panah di daftar untuk melihat harga tiap varian.', 'Menu Habis tetap terlihat di kasir tetapi tidak bisa dijual. Kasir juga boleh mengubahnya.', 'Produk nonaktif disembunyikan dari kasir, tetapi tetap ada di riwayat.', 'Mengubah harga modal tidak mengubah laba penjualan yang sudah lewat.'],
      keywords: 'menu barang foto kategori hpp sold out kosong stok',
    },
    timbang: {
      title: 'Jual per berat dan harga yang bisa diubah',
      summary: 'Untuk pedagang pasar: jual per kilo, ons, liter, atau meter, dan ketik harga hari ini langsung di kasir.',
      steps: [
        'Buka Pengaturan, tab Toko & Struk, nyalakan "Aktifkan satuan berat dan ukuran", lalu simpan.',
        'Di Produk, pilih "Dijual per" (misalnya kg) dan isi harga per satuan itu.',
        'Untuk barang yang harganya naik-turun, buka "Pengaturan lain" lalu nyalakan "Harga bisa diubah saat jual".',
        'Di Kasir, ketuk barangnya, lalu ketik beratnya (misalnya 0,75), atau pilih Nominal dan ketik uang pembeli (misalnya Rp10.000).',
        'Kalau harga hari ini berbeda, ganti harganya di kotak yang sama, lalu "Tambah ke pesanan".',
      ],
      notes: [
        'Total baris = harga × berat, dibulatkan ke rupiah. Kalau memakai Nominal, pembeli membayar persis sejumlah itu.',
        'Setiap timbangan menjadi baris sendiri. Ubah berat atau harga lewat tombol di baris keranjang.',
        'Harga normal tetap tercatat. Di Riwayat, transaksi yang harganya diubah diberi tanda, dan ekspor Item memuat kolom Harga Normal.',
        'Refund barang timbangan mengembalikan satu baris utuh.',
        'Aplikasi belum tersambung ke timbangan digital. Berat diketik sendiri.',
      ],
      keywords: 'timbang kilo kg ons gram liter meter pasar sayur ikan daging harga bebas nego tawar',
    },
    pelanggan: {
      title: 'Pelanggan dan yang belum bayar',
      summary: 'Simpan nama dan nomor HP langganan, lihat berapa kali mereka belanja, dan siapa yang masih punya bon.',
      steps: [
        'Di keranjang, ketuk "Tambah pelanggan" untuk memilih atau menambah pelanggan.',
        'Buka menu Pelanggan untuk melihat kunjungan dan total belanja.',
        'Tab "Belum bayar" berisi pelanggan yang punya pesanan tersimpan. Ketuk namanya, lalu "Ingatkan via WhatsApp".',
      ],
      notes: ['Hanya nomor HP Indonesia (08… atau +628…) yang diterima.', 'Menghapus pelanggan menghapus nomor HP dan catatannya. Namanya tetap ada di struk lama.'],
      keywords: 'langganan hutang piutang bon nomor hp kontak',
    },
    staf: {
      title: 'Kasir, PIN pemilik, dan izin',
      summary: 'PIN pemilik melindungi Laporan, Produk, dan Pengaturan. Kasir punya PIN sendiri supaya setiap transaksi tercatat atas nama yang benar.',
      steps: [
        'Buka Pengaturan, tab Staf & PIN, lalu buat PIN pemilik. Catat kode pemulihan yang muncul dan simpan di tempat aman.',
        'Tambah kasir dan beri masing-masing PIN.',
        'Ganti penjual lewat tombol inisial di pojok kiri bawah (di HP: tab Akun).',
        'Atur siapa yang boleh void, refund, dan memberi diskon besar.',
      ],
      notes: [
        'Menjual tidak perlu PIN pemilik. Yang dikunci hanya bagian pemilik, dan terkunci lagi setelah 5 menit tidak dipakai.',
        'Lupa PIN pemilik? Pakai kode pemulihan. Kalau keduanya hilang, bagian pemilik tidak bisa dibuka lagi.',
        'Salah PIN berkali-kali membuat aplikasi menunggu sebelum bisa mencoba lagi.',
      ],
      keywords: 'karyawan pegawai kunci password sandi hak akses owner',
    },
    offline: {
      title: 'Tanpa internet, sinkronisasi, dan beberapa perangkat',
      summary: 'Pikul menyimpan semuanya di perangkat ini, jadi tetap bisa dipakai saat sinyal hilang. Saat online, data toko disinkronkan ke server Pikul.',
      steps: [
        'Jualan seperti biasa. Tidak ada yang perlu dilakukan saat internet mati; perubahan terkirim sendiri saat online lagi.',
        'Di perangkat kedua, cukup masuk dengan akun yang sama. Menu, staf, pelanggan, dan penjualan diunduh otomatis.',
        'Lihat status dan daftar perangkat di Pengaturan, tab Sinkronisasi.',
      ],
      notes: [
        'Setiap perangkat punya laci kas sendiri: buka dan tutup kasir di masing-masing perangkat. Pemilik melihat semuanya di Kas, bagian "Semua perangkat".',
        'Laporan memuat penjualan dari semua perangkat yang sudah tersinkron.',
        'Kalau dua perangkat mengubah produk yang sama saat offline, perubahan yang terakhir yang dipakai.',
        'Data toko di server hanya bisa dibuka dengan akun Anda. Tetap buat cadangan secara rutin.',
      ],
      keywords: 'sinyal online sinkron sync wifi kuota hilang',
    },
    cadangan: {
      title: 'Cadangan dan pindah perangkat',
      summary: 'Cadangan adalah satu berkas berisi seluruh data toko. Pakai untuk berjaga-jaga atau untuk pindah ke perangkat baru.',
      steps: [
        'Buka Pengaturan, tab Cadangan, lalu ketuk "Simpan cadangan". Berkas masuk ke folder Unduhan.',
        'Kirim berkas itu ke Google Drive atau WhatsApp Anda sendiri.',
        'Di perangkat baru: buka aplikasi, lewati pengenalan, buka Pengaturan, tab Cadangan, "Pilih berkas cadangan", lalu konfirmasi.',
      ],
      notes: [
        'Memulihkan cadangan mengganti semua data di perangkat itu. Yang dicatat setelah cadangan dibuat tidak ikut.',
        'Berkas memuat nomor HP pelanggan. Jangan dibagikan ke orang lain.',
        'Jangan memakai cadangan yang sama di dua perangkat sekaligus: nomor struk bisa kembar.',
      ],
      keywords: 'backup restore pulihkan ganti hp tablet rusak hilang',
    },
    pasang: {
      title: 'Pasang di layar utama',
      summary: 'Pikul bisa dipasang seperti aplikasi biasa supaya terbuka penuh dan lebih cepat.',
      steps: [
        'Android (Chrome): ketuk menu tiga titik, lalu "Tambahkan ke layar utama" atau "Instal aplikasi".',
        'iPhone atau iPad (Safari): ketuk tombol Bagikan, lalu "Tambah ke Layar Utama".',
        'Buka Pikul dari ikon di layar utama.',
      ],
      notes: ['Buka aplikasi sekali saat ada internet setelah memasang, supaya semua bagian tersimpan untuk dipakai offline.'],
      keywords: 'install pwa aplikasi ikon homescreen',
    },
  },
};
