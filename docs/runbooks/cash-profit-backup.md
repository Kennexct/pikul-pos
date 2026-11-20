# Runbook — Kas, close of day, profit, backup (v0.9)

| Symptom | Cause | Action |
| --- | --- | --- |
| "Uang di laci seharusnya" looks too low | Opening cash not typed, or an expense was marked "Dibayar dari uang laci" by mistake | Kas → Modal awal → Ubah. For the expense: delete it (owner) and record it again with the switch off. |
| Cash from a bon paid today is missing from yesterday's totals | By design since v0.9: a saved order counts on the day it is **paid** | Look at today's Kas and reports. |
| "Hari ini sudah ditutup." | The day already has a closing | Owner: Kas → Buka kembali, then close again. Both closings are kept in the audit trail. |
| Warning "Ada transaksi atau pengeluaran setelah kasir ditutup" | A sale, refund or expense happened after closing | Owner reopens and closes again so the record matches. Selling was never blocked. |
| "Kasir kemarin belum ditutup" | Yesterday has sales and no closing | Press "Tutup kemarin", count, close. |
| Menu still "Habis" in the morning | The switch "Sediakan lagi … menu yang habis" was turned off at closing, or the day was not closed | Kasir → sold-out list → switch back. |
| Laba looks too high | Some sold items have no cost price (warning names them), or add-ons carry no cost | Produk → fill "Harga modal". Past sales keep the cost they were sold with. |
| Belanja bahan not subtracted from Laba bersih | By design when cost prices are used (they already contain ingredients) | Nothing to do. Without any cost prices the report switches to "Sisa setelah pengeluaran" and subtracts everything. |
| "Ini bukan berkas cadangan Pikul." / "Berkas rusak…" | Wrong or damaged file | Pick the `pikul-cadangan-….json` file (older `kasirku-cadangan-….json` files restore too). Nothing on the device changed. |
| "Cadangan ini dibuat dengan versi aplikasi yang lebih baru." | The app on this device is older than the one that made the file | Reload/update the app (close and reopen while online), then restore. |
| "Pemulihan gagal, data di perangkat ini tidak berubah." | Storage full or the browser blocked the write | Free storage, retry. The old data is intact. |
| After restore the app asks who is selling / the cart is empty | Expected: the seller and cart belonged to the old data | Choose the seller (PINs are the ones in the backup). |
| Two devices show the same receipt numbers | The same backup was restored on a second device and both are selling | Use one device until sync exists. |
| Lost phone, no backup | Data is only on the device | Not recoverable. Back up weekly (Settings → Cadangan shows the age). |

Backup file hygiene: it contains customer phone numbers and PIN hashes — keep it in the owner's own Drive/WhatsApp, never in a shared group.

## First-time journey and help (v0.10)
| Symptom | Cause | Action |
| --- | --- | --- |
| The journey appears on a device that had data | Browser data was cleared, or a different browser/profile is used | Restore from a backup file: finish or skip the journey, then Pengaturan → Cadangan. |
| Wrong business template chosen | — | Edit or delete the example products in Produk; there is no "re-run" (it would discard sales). |
| "Langkah awal" banner is gone | It was dismissed or all steps are done | The checklist stays on the Bantuan page until complete. |
| A checklist step will not tick | It follows the data: e.g. QRIS needs an uploaded image, backup needs "Simpan cadangan" pressed on this device | Do the step; it ticks by itself. |

## Language (v0.11)
| Symptom | Cause | Action |
| --- | --- | --- |
| App opened in English on a new device | The device language is English | Pengaturan/Settings → Toko & Struk/Shop & Receipt → Bahasa/Language, or the picker on the PIN screen. |
| Categories or payment names stayed Indonesian after switching | They are the shop's own data, created in the language chosen at setup | Rename them in Products / Settings. |
| The app "blinks" when the language is changed | It reloads to rebuild labels and date formats | Expected. The cart and seller are kept; owner mode locks. |
| One device in English, another in Indonesian | Language is per device | Expected; receipts and exports follow the device that produced them. |

## Register open/close, categories (v0.16, ADR-017)
| Symptom | Cause | Action |
| --- | --- | --- |
| "Buka kasir" pops up on the first tap of the day | By design: today's register has no opening count yet | Count the drawer, type the amount and press "Buka kasir". Rp0 is allowed. "Nanti saja" closes it; Bayar asks again. |
| The pop-up does not appear on a device that already sold today | A sale already counts on the day (device updated mid-day), so the register is treated as open | Nothing to do. Check Kas → Modal awal and change it if needed. |
| "Kasir hari ini sudah ditutup" on the cashier | The day was closed; selling still works after one warning | Owner: Kas → Buka kembali, then close again so the count matches. |
| Who changed the opening cash? | — | Audit events `register_opened` and `opening_cash_changed` (old → new) with the seller. |
| A category disappeared from the cashier tabs | It was deleted in Produk → Kategori | Its products are under "Tanpa kategori" (cashier tab "Semua"). Create the category again and reassign products. |
| Category order on the cashier is wrong | Order follows Produk → Kategori | Use the up/down arrows there. |
