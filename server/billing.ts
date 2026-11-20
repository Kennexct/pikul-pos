import { entitledUntil, accountFromBearer, planOf } from './auth';
import { offers } from './catalog';
import type { ApiResponse, Deps } from './types';

const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });

/** Subscription screen: the account's entitlement and the plans with today's price. No payment provider is connected. */
export async function overview(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await accountFromBearer(deps, auth);
  if (!a) return bad('signed_out', 401);
  const [plans, campaigns] = await Promise.all([deps.repo.listPlans(), deps.repo.listCampaigns()]);
  return {
    status: 200,
    body: {
      account: { email: a.email, plan: planOf(a), until: entitledUntil(a), trialEndsAt: a.trialEndsAt, paidUntil: a.paidUntil },
      plans: offers(plans, campaigns, deps.now()),
    },
  };
}
