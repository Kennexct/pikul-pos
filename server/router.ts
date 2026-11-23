import { googleSignIn, refresh, requestCode, signOut, verifyCode } from './auth';
import { overview } from './billing';
import { adminArchiveCampaign, adminCatalog, adminMe, adminSaveCampaign, adminSavePlan, adminToggleCampaign, adminUploadImage, appPopupData, landingData, MAX_IMAGE_BYTES, publicImage } from './admin';
import { adminLogin, adminLogout } from './adminAuth';
import { adminMerchantSummary, adminReport } from './analytics';
import { DAILY_BODY_LIMIT, postDaily } from './daily';
import { syncClaim, syncDevices, syncPull, syncPush, syncRenameDevice, syncReplace, syncStore } from './sync';
import { PUSH_BODY_LIMIT } from './syncCheck';
import { adminTempPassword, authOptions, changePassword, passwordLogin, resetPassword, signUp } from './signup';
import { adminContent, adminSaveContent } from './siteContent';
import { adminCancelPayment, adminGrant, adminMerchant, adminMerchants, adminOverview, adminPayments, adminRecordPayment } from './merchants';
import type { ApiResponse, Deps, RequestCtx } from './types';

const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

const MAX_BODY = 16_384;

const NO_CTX: RequestCtx = { ip: '', query: new URLSearchParams() };

function bodyLimit(method: string, path: string): number {
  if (method !== 'POST') return MAX_BODY;
  if (path === '/api/admin/images') return Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1_024;
  if (path === '/api/merchant/daily') return DAILY_BODY_LIMIT;
  if (path === '/api/sync/push') return PUSH_BODY_LIMIT;
  return MAX_BODY;
}

export async function route(deps: Deps, method: string, path: string, auth: string | null, rawBody: string, ctx: RequestCtx = NO_CTX): Promise<ApiResponse> {
  const limit = bodyLimit(method, path);
  if (rawBody.length > limit) return { status: 413, body: { error: 'too_large' } };
  let body: unknown = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { error: 'invalid_json' } };
    }
  }
  const key = `${method} ${path}`;
  switch (key) {
    case 'GET /api/auth/options':
      return authOptions(deps);
    case 'POST /api/auth/signup':
      return signUp(deps, body, ctx);
    case 'POST /api/auth/login':
      return passwordLogin(deps, body, ctx);
    case 'POST /api/auth/reset':
      return resetPassword(deps, body);
    case 'POST /api/auth/password':
      return changePassword(deps, auth, body);
    case 'POST /api/auth/code':
      return requestCode(deps, body);
    case 'POST /api/auth/verify':
      return verifyCode(deps, body);
    case 'POST /api/auth/google':
      return googleSignIn(deps, body);
    case 'POST /api/auth/refresh':
      return refresh(deps, body);
    case 'POST /api/auth/signout':
      return signOut(deps, body);
    case 'GET /api/billing':
      return overview(deps, auth);
    case 'GET /api/public/landing':
      return landingData(deps);
    case 'GET /api/public/app':
      return appPopupData(deps);
    case 'POST /api/admin/images':
      return adminUploadImage(deps, auth, body);
    case 'POST /api/admin/login':
      return adminLogin(deps, body, ctx);
    case 'POST /api/admin/logout':
      return adminLogout(deps, auth);
    case 'GET /api/admin/overview':
      return adminOverview(deps, auth);
    case 'GET /api/admin/merchants':
      return adminMerchants(deps, auth, ctx);
    case 'POST /api/merchant/daily':
      return postDaily(deps, auth, body);
    case 'GET /api/sync/store':
      return syncStore(deps, auth);
    case 'POST /api/sync/claim':
      return syncClaim(deps, auth, body);
    case 'POST /api/sync/push':
      return syncPush(deps, auth, body);
    case 'GET /api/sync/pull':
      return syncPull(deps, auth, ctx);
    case 'POST /api/sync/replace':
      return syncReplace(deps, auth, body);
    case 'GET /api/sync/devices':
      return syncDevices(deps, auth);
    case 'POST /api/sync/devices/name':
      return syncRenameDevice(deps, auth, body);
    case 'GET /api/admin/report':
      return adminReport(deps, auth, ctx);
    case 'GET /api/admin/content':
      return adminContent(deps, auth);
    case 'POST /api/admin/content':
      return adminSaveContent(deps, auth, body);
    case 'POST /api/admin/content/reset':
      return adminSaveContent(deps, auth, null, true);
    case 'GET /api/admin/payments':
      return adminPayments(deps, auth, ctx);
    case 'GET /api/admin/me':
      return adminMe(deps, auth);
    case 'GET /api/admin/catalog':
      return adminCatalog(deps, auth);
    case 'POST /api/admin/plans':
      return adminSavePlan(deps, auth, body);
    case 'POST /api/admin/campaigns':
      return adminSaveCampaign(deps, auth, null, body);
  }
  const img = new RegExp(`^GET /api/public/images/${UUID}$`).exec(key);
  if (img?.[1]) return publicImage(deps, img[1]);
  const m = new RegExp(`^(GET|POST) /api/admin/merchants/${UUID}(/payments|/grants|/summary|/temp-password)?$`).exec(key);
  if (m?.[2]) {
    const [, verb, id, sub] = m;
    if (verb === 'GET' && !sub) return adminMerchant(deps, auth, id);
    if (verb === 'POST' && sub === '/payments') return adminRecordPayment(deps, auth, id, body);
    if (verb === 'POST' && sub === '/grants') return adminGrant(deps, auth, id, body);
    if (verb === 'POST' && sub === '/temp-password') return adminTempPassword(deps, auth, id);
    if (verb === 'GET' && sub === '/summary') return adminMerchantSummary(deps, auth, id, ctx);
  }
  const pc = new RegExp(`^POST /api/admin/payments/${UUID}/cancel$`).exec(key);
  if (pc?.[1]) return adminCancelPayment(deps, auth, pc[1], body);
  const c = new RegExp(`^POST /api/admin/campaigns/${UUID}(/toggle|/archive)?$`).exec(key);
  if (c?.[1]) {
    const id = c[1];
    if (c[2] === '/toggle') return adminToggleCampaign(deps, auth, id, body);
    if (c[2] === '/archive') return adminArchiveCampaign(deps, auth, id);
    return adminSaveCampaign(deps, auth, id, body);
  }
  return { status: 404, body: { error: 'not_found' } };
}
