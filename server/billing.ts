import { accountFromBearer, entitledUntil, planOf } from './auth';
import { randomToken } from './crypto';
import { isFailedStatus, isPaidStatus, validSignature } from './midtrans';
import { offers, priceNow } from './catalog';
import { DAY_MS, type ApiResponse, type Deps, type Payment } from './types';

const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });

const view = (p: Payment) => ({ orderId: p.orderId, plan: p.plan, planName: p.planName, amount: p.amount, days: p.days, status: p.status, createdAt: p.createdAt, paidAt: p.paidAt, method: p.method });

export async function checkout(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await accountFromBearer(deps, auth);
  if (!a) return bad('signed_out', 401);
  const planId = (body as { plan?: unknown })?.plan;
  const plan = (await deps.repo.listPlans()).find((p) => p.id === planId && p.active);
  if (!plan) return bad('invalid_plan');
  const now = deps.now();
  // Price is decided here, never by the client (ADR-014); the payment keeps a snapshot.
  const { amount, campaign } = priceNow(plan, await deps.repo.listCampaigns(), now);
  const orderId = `KK-${now.toString(36)}-${randomToken(4)}`.toUpperCase();
  await deps.repo.createPayment({ orderId, accountId: a.id, plan: plan.id, planName: plan.name, amount, days: plan.days, campaignId: campaign?.id ?? null, status: 'pending', createdAt: now, paidAt: null, method: null });
  const snap = await deps.midtrans.createSnap({ orderId, amount, itemId: plan.id, itemName: `KasirKu ${plan.name}`.slice(0, 50), email: a.email, finishUrl: `${deps.appOrigin}/app/pengaturan?tab=subscription&bayar=${encodeURIComponent(orderId)}` });
  return { status: 200, body: { orderId, redirectUrl: snap.redirectUrl } };
}

/** Applies a confirmed payment once. Extends from the later of now, the paid-until date and the trial end. */
async function applyPaid(deps: Deps, p: Payment, method: string | null): Promise<void> {
  const now = deps.now();
  if (!(await deps.repo.markPaymentPaid(p.orderId, now, method))) return; // already applied
  const a = await deps.repo.findAccountById(p.accountId);
  if (!a) return;
  const from = Math.max(now, a.paidUntil ?? 0, a.trialEndsAt);
  await deps.repo.setPaidUntil(a.id, from + p.days * DAY_MS);
}

/** Midtrans HTTP notification. Always answers 200 for well-formed, verified notifications so Midtrans stops retrying. */
export async function notification(deps: Deps, body: unknown): Promise<ApiResponse> {
  const n = (body ?? {}) as Record<string, unknown>;
  if (!(await validSignature(n, deps.midtrans.serverKey))) return bad('bad_signature', 403);
  const p = await deps.repo.findPayment(n.order_id as string);
  if (!p) return { status: 200, body: { ok: true, ignored: 'unknown_order' } };
  if (Math.round(Number(n.gross_amount)) !== p.amount) return bad('amount_mismatch', 400);
  const status = String(n.transaction_status ?? '');
  const fraud = typeof n.fraud_status === 'string' ? n.fraud_status : null;
  if (isPaidStatus(status, fraud)) await applyPaid(deps, p, typeof n.payment_type === 'string' ? n.payment_type : null);
  else if (p.status === 'pending' && isFailedStatus(status)) await deps.repo.setPaymentStatus(p.orderId, 'failed');
  else if (p.status === 'pending' && status === 'expire') await deps.repo.setPaymentStatus(p.orderId, 'expired');
  return { status: 200, body: { ok: true } };
}

/** Called by the app when it returns from Snap: asks Midtrans directly in case the notification is late. */
export async function paymentStatus(deps: Deps, auth: string | null, orderId: string): Promise<ApiResponse> {
  const a = await accountFromBearer(deps, auth);
  if (!a) return bad('signed_out', 401);
  const p = await deps.repo.findPayment(orderId);
  if (!p || p.accountId !== a.id) return bad('not_found', 404);
  if (p.status === 'pending') {
    const s = await deps.midtrans.getStatus(orderId);
    if (s && s.grossAmount === p.amount && isPaidStatus(s.transactionStatus, s.fraudStatus)) await applyPaid(deps, p, s.paymentType);
  }
  const fresh = (await deps.repo.findPayment(orderId))!;
  return { status: 200, body: view(fresh) };
}

export async function overview(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await accountFromBearer(deps, auth);
  if (!a) return bad('signed_out', 401);
  const [list, plans, campaigns] = await Promise.all([deps.repo.listPayments(a.id), deps.repo.listPlans(), deps.repo.listCampaigns()]);
  const payments = list.map(view);
  return {
    status: 200,
    body: {
      account: { email: a.email, plan: planOf(a), until: entitledUntil(a), trialEndsAt: a.trialEndsAt, paidUntil: a.paidUntil },
      plans: offers(plans, campaigns, deps.now()),
      payments,
    },
  };
}
