import { googleSignIn, refresh, requestCode, signOut, verifyCode } from './auth';
import { overview } from './billing';
import { adminArchiveCampaign, adminCatalog, adminMe, adminSaveCampaign, adminSavePlan, adminToggleCampaign, adminUploadImage, appPopupData, landingData, MAX_IMAGE_BYTES, publicImage } from './admin';
import { adminLogin, adminLogout } from './adminAuth';
import { adminCancelPayment, adminGrant, adminMerchant, adminMerchants, adminOverview, adminPayments, adminRecordPayment } from './merchants';
import type { ApiResponse, Deps, RequestCtx } from './types';

const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

const MAX_BODY = 16_384;

const NO_CTX: RequestCtx = { ip: '', query: new URLSearchParams() };

export async function route(deps: Deps, method: string, path: string, auth: string | null, rawBody: string, ctx: RequestCtx = NO_CTX): Promise<ApiResponse> {
  const limit = method === 'POST' && path === '/api/admin/images' ? Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1_024 : MAX_BODY;
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
  if (img) return publicImage(deps, img[1]);
  const m = new RegExp(`^(GET|POST) /api/admin/merchants/${UUID}(/payments|/grants)?$`).exec(key);
  if (m) {
    if (m[1] === 'GET' && !m[3]) return adminMerchant(deps, auth, m[2]);
    if (m[1] === 'POST' && m[3] === '/payments') return adminRecordPayment(deps, auth, m[2], body);
    if (m[1] === 'POST' && m[3] === '/grants') return adminGrant(deps, auth, m[2], body);
  }
  const pc = new RegExp(`^POST /api/admin/payments/${UUID}/cancel$`).exec(key);
  if (pc) return adminCancelPayment(deps, auth, pc[1], body);
  const c = new RegExp(`^POST /api/admin/campaigns/${UUID}(/toggle|/archive)?$`).exec(key);
  if (c) {
    if (c[2] === '/toggle') return adminToggleCampaign(deps, auth, c[1], body);
    if (c[2] === '/archive') return adminArchiveCampaign(deps, auth, c[1]);
    return adminSaveCampaign(deps, auth, c[1], body);
  }
  return { status: 404, body: { error: 'not_found' } };
}
