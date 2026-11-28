import { localDb } from '../db/localDb';
import { normalizeEmail, normalizePhone } from '../lib/customers';
import { nowIso } from '../lib/id';
import type { Customer, Id } from '../types';
import { newMeta } from './catalog';
import { saveAndQueue } from './sync';
import { t } from '../i18n';

const NAME_MAX = 80;
const NOTE_MAX = 200;

export interface CustomerInput {
  /** Present when editing. */
  id?: Id;
  name: string;
  /** Raw user input; empty = no phone. */
  phone: string;
  /** Raw user input; empty = no email. Absent = keep the saved one. */
  email?: string;
  note: string;
}

/** Create or update a customer (ADR-005): name required, phone optional but valid and unique per store. */
export async function saveCustomer(storeId: Id, input: CustomerInput): Promise<Customer> {
  const name = input.name.trim();
  if (name.length === 0) throw new Error(t('Nama pelanggan wajib diisi.'));
  if (name.length > NAME_MAX) throw new Error(t('Nama maksimal {0} karakter.', NAME_MAX));
  const note = input.note.trim();
  if (note.length > NOTE_MAX) throw new Error(t('Catatan maksimal {0} karakter.', NOTE_MAX));

  let phone: string | undefined;
  if (input.phone.trim() !== '') {
    const normalized = normalizePhone(input.phone);
    if (!normalized) throw new Error(t('Nomor HP tidak valid. Contoh: 0812-3456-7890.'));
    const owner = await localDb.customers
      .where('phone')
      .equals(normalized)
      .filter((c) => c.storeId === storeId && !c.deletedAt && c.id !== input.id)
      .first();
    if (owner) throw new Error(t('Nomor ini sudah dipakai oleh {0}.', owner.name));
    phone = normalized;
  }

  const existing = input.id ? await localDb.customers.get(input.id) : undefined;
  if (input.id && (!existing || existing.deletedAt)) throw new Error(t('Pelanggan tidak ditemukan.'));

  let email = existing?.email;
  if (input.email !== undefined) {
    const typed = input.email.trim();
    email = typed === '' ? undefined : (normalizeEmail(typed) ?? undefined);
    if (typed !== '' && !email) throw new Error(t('Alamat email tidak valid. Contoh: nama@email.com.'));
  }

  const customer: Customer = { ...(existing ?? newMeta(storeId)), name, phone, email, note: note || undefined, updatedAt: nowIso() };
  await saveAndQueue('customers', customer);
  return customer;
}

/** Saves the address the cashier typed when emailing a receipt (ADR-028). */
export async function setCustomerEmail(customerId: Id, email: string): Promise<void> {
  const customer = await localDb.customers.get(customerId);
  const normalized = normalizeEmail(email);
  if (!customer || customer.deletedAt || !normalized || customer.email === normalized) return;
  await saveAndQueue('customers', { ...customer, email: normalized, updatedAt: nowIso() });
}

/**
 * Removes a customer from the list and erases their contact data (phone, email, note).
 * Their name stays on past receipts as part of the transaction record.
 */
export async function deleteCustomer(customerId: Id): Promise<void> {
  const customer = await localDb.customers.get(customerId);
  if (!customer || customer.deletedAt) throw new Error(t('Pelanggan tidak ditemukan.'));
  const now = nowIso();
  await saveAndQueue('customers', { ...customer, phone: undefined, email: undefined, note: undefined, deletedAt: now, updatedAt: now });
}
