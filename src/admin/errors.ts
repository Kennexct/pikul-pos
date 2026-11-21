import { t } from '../i18n';
import { AdminError } from './api';

const ERRORS: Record<string, string> = {
  offline: t('Tidak ada internet.'),
  forbidden: t('Server admin masih meminta login. Set ADMIN_OPEN=1 di server lalu muat ulang halaman.'),
  signed_out: t('Server admin masih meminta login. Set ADMIN_OPEN=1 di server lalu muat ulang halaman.'),
  session_too_old: t('Server admin masih meminta login. Set ADMIN_OPEN=1 di server lalu muat ulang halaman.'),
  preview_upload: t('Unggah gambar butuh server admin. Di mode pratinjau, simpan kampanye tanpa gambar.'),
  not_found: t('Data tidak ditemukan. Muat ulang halaman.'),
  invalid_plan_id: t('Kode paket hanya huruf kecil, angka, dan tanda minus (2–24 karakter).'),
  plan_exists: t('Kode paket ini sudah dipakai.'),
  invalid_name: t('Nama paket wajib diisi (maks. 40 karakter).'),
  invalid_amount: t('Harga minimal Rp1.000 dan bilangan bulat.'),
  invalid_days: t('Masa aktif 1–1.095 hari.'),
  invalid_features: t('Maksimal 8 baris fitur, masing-masing 80 karakter.'),
  invalid_text: t('Periksa judul dan teks (judul wajib, maks. 80 karakter; teks maks. 400).'),
  invalid_image: t('Gambar harus PNG, JPG, atau WebP, atau tautan https.'),
  image_too_large: t('Gambar maksimal 500 KB.'),
  invalid_link: t('Tautan harus diawali https:// atau / (halaman di situs ini).'),
  invalid_cta: t('Teks tombol maksimal 30 karakter.'),
  no_placement: t('Pilih minimal satu tempat tampil.'),
  invalid_dates: t('Waktu selesai harus setelah waktu mulai.'),
  invalid_plan: t('Paket promo tidak ditemukan.'),
  invalid_promo: t('Harga promo harus di bawah harga normal paket dan minimal Rp1.000.'),
};

export const errorText = (e: unknown) => (e instanceof AdminError ? (ERRORS[e.code] ?? t('Terjadi kesalahan di server. Coba lagi sebentar.')) : t('Terjadi kesalahan di server. Coba lagi sebentar.'));
export const isAuthError = (e: unknown) => e instanceof AdminError && (e.status === 401 || e.status === 403);
