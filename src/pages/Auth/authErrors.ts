import { ApiError } from '../../services/account';
import { t } from '../../i18n';

const ERRORS: Record<string, string> = {
  invalid_email: t('Alamat email tidak valid.'),
  wrong_credentials: t('Email atau kata sandi salah.'),
  locked: t('Terlalu banyak percobaan. Tunggu 15 menit, lalu coba lagi.'),
  email_taken: t('Email ini sudah terdaftar. Silakan masuk.'),
  weak_password: t('Kata sandi minimal 8 karakter.'),
  wrong_password: t('Kata sandi lama salah.'),
  invalid_owner_name: t('Isi nama pemilik (minimal 2 huruf).'),
  invalid_store_name: t('Isi nama toko (minimal 2 huruf).'),
  invalid_phone: t('Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.'),
  invalid_city: t('Isi kota atau kabupaten.'),
  too_many_signups: t('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam 1 jam.'),
  no_account: t('Belum ada akun dengan email ini. Daftar dulu.'),
  email_disabled: t('Reset lewat email belum tersedia. Hubungi admin Pikul.'),
  too_soon: t('Tunggu 1 menit sebelum meminta kode baru.'),
  invalid_code: t('Kode salah. Periksa lagi email Anda.'),
  code_expired: t('Kode sudah kedaluwarsa. Minta kode baru.'),
  too_many_attempts: t('Terlalu banyak percobaan. Minta kode baru.'),
  invalid_token: t('Masuk dengan Google gagal. Coba lagi.'),
  signed_out: t('Sesi berakhir. Silakan masuk lagi.'),
  offline: t('Tidak ada internet. Masuk dan daftar butuh koneksi; setelah itu kasir bisa dipakai offline.'),
};

export const authMessage = (e: unknown) => (e instanceof ApiError ? (ERRORS[e.code] ?? t('Terjadi kesalahan di server. Coba lagi sebentar.')) : t('Terjadi kesalahan di server. Coba lagi sebentar.'));
