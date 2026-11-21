import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "../db/localDb";
import type { DateRange } from "../lib/dateRange";
import type { Id, Order, Refund } from "../types";

export interface PeriodData {
  /** Orders whose sale business date is in range (excluding open), newest first. */
  sales: Order[];
  /** Refund/void records whose own business date is in range (ADR-002). */
  refundsInRange: Refund[];
  /** All refunds of the listed sales, any date — for the detail sheet. */
  refundsByOrder: ReadonlyMap<Id, Refund[]>;
  /** Sales + original orders of refunds in range. */
  ordersById: ReadonlyMap<Id, Order>;
  memberName: ReadonlyMap<Id, string>;
}

function groupByOrder(refunds: readonly Refund[]): Map<Id, Refund[]> {
  const map = new Map<Id, Refund[]>();
  for (const refund of refunds)
    map.set(refund.orderId, [...(map.get(refund.orderId) ?? []), refund]);
  return map;
}

/** One period's data from Dexie. Also used outside React (daily totals, ADR-020). */
export async function loadPeriodData(
  storeId: Id,
  range: DateRange,
): Promise<PeriodData> {
  const [from, to] = [
    [storeId, range.from],
    [storeId, range.to],
  ];

  const sales = await localDb.orders
    .where("[storeId+businessDate]")
    .between(from, to, true, true)
    .filter((o) => o.status !== "open" && !o.deletedAt)
    .toArray();
  sales.sort((a, b) =>
    (b.paidAt ?? b.updatedAt).localeCompare(a.paidAt ?? a.updatedAt),
  );

  const refundsInRange = await localDb.refunds
    .where("[storeId+businessDate]")
    .between(from, to, true, true)
    .toArray();
  const saleIds = sales.map((o) => o.id);
  const refundsOfSales =
    saleIds.length > 0
      ? await localDb.refunds.where("orderId").anyOf(saleIds).toArray()
      : [];

  const ordersById = new Map(sales.map((o) => [o.id, o]));
  const missing = [...new Set(refundsInRange.map((r) => r.orderId))].filter(
    (id) => !ordersById.has(id),
  );
  const extra = missing.length > 0 ? await localDb.orders.bulkGet(missing) : [];
  for (const order of extra) if (order) ordersById.set(order.id, order);

  const members = await localDb.storeMembers
    .where("storeId")
    .equals(storeId)
    .toArray();
  return {
    sales,
    refundsInRange,
    refundsByOrder: groupByOrder(refundsOfSales),
    ordersById,
    memberName: new Map(members.map((m) => [m.id, m.displayName])),
  };
}

/** Single live query used by History and Reports so both screens read identical data. */
export function usePeriodData(
  storeId: Id | null,
  range: DateRange,
): PeriodData | undefined {
  return useLiveQuery(
    async () => (storeId ? loadPeriodData(storeId, range) : undefined),
    [storeId, range.from, range.to],
  );
}
