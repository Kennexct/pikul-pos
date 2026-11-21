import { useLiveQuery } from 'dexie-react-hooks';
import { Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { card, sectionTitle } from '../../components/ui/styles';
import { localDb } from '../../db/localDb';
import { devicesDay, type DevicesDay } from '../../lib/devicesDay';
import { formatRupiah } from '../../lib/money';
import { isCountedSale } from '../../lib/reports';
import { getDeviceId } from '../../services/device';
import { cachedDevices, refreshDevices } from '../../services/syncBinding';
import type { BusinessDate, Id } from '../../types';
import { t } from '../../i18n';

function useDevicesDay(storeId: Id, date: BusinessDate, names: ReadonlyMap<Id, string>): DevicesDay | undefined {
  return useLiveQuery(async () => {
    const key = [storeId, date];
    const sales = await localDb.orders.where('[storeId+businessDate]').equals(key).filter(isCountedSale).toArray();
    const refunds = await localDb.refunds.where('[storeId+businessDate]').equals(key).toArray();
    const closings = await localDb.dayClosings.where('[storeId+businessDate]').equals(key).toArray();
    const ordersById = new Map(sales.map((o) => [o.id, o]));
    const missing = [...new Set(refunds.map((r) => r.orderId))].filter((id) => !ordersById.has(id));
    for (const o of missing.length > 0 ? await localDb.orders.bulkGet(missing) : []) if (o) ordersById.set(o.id, o);
    return devicesDay({ sales, refunds, closings, ordersById, names, here: await getDeviceId() });
  }, [storeId, date, names]);
}

/** Kas → "Semua perangkat" (ADR-025): owner sees every device's day and the store total. Hidden until another device has records that day. */
export function AllDevicesCard({ storeId, date }: { storeId: Id; date: BusinessDate }) {
  const [names, setNames] = useState<ReadonlyMap<Id, string>>(new Map());
  useEffect(() => {
    const keep = (list: Array<{ deviceId: Id; name: string }>) => setNames(new Map(list.map((d) => [d.deviceId, d.name])));
    void cachedDevices().then(keep);
    void refreshDevices().then(keep);
  }, []);
  const day = useDevicesDay(storeId, date, names);
  if (!day || day.rows.length < 2) return null;

  return (
    <section className={`${card} p-4`} aria-labelledby="all-devices">
      <h2 id="all-devices" className={sectionTitle}>
        {t('Semua perangkat')}
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {day.rows.map((r, i) => (
          <li key={r.deviceId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <Smartphone aria-hidden size={17} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 font-semibold">{(i === 0 ? t('Perangkat ini') : r.name) || t('Perangkat lain')}</span>
            <span className="num text-[14px]">{t('Tunai {0}', formatRupiah(r.cash))}</span>
            <span className={`text-[13px] ${r.closing ? (r.closing.difference === 0 ? 'text-brand-700' : 'text-warn-700') : 'text-muted'}`}>
              {r.closing
                ? r.closing.difference === 0
                  ? t('Sudah tutup, pas')
                  : t('Sudah tutup, selisih {0}', formatRupiah(r.closing.difference))
                : t('Belum tutup')}
            </span>
          </li>
        ))}
      </ul>
      <p className="num mt-2 border-t border-line pt-2 text-[14px] font-semibold">
        {t('Total toko: {0} dari {1} transaksi, tunai {2}', formatRupiah(day.total.net), day.total.transactions, formatRupiah(day.total.cash))}
      </p>
    </section>
  );
}
