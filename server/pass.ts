import { importJWK, SignJWT, createRemoteJWKSet, jwtVerify, type JWK } from 'jose';
import type { GoogleVerifier, PassSigner } from './types';

export const PASS_ISSUER = 'pikul';
export const PASS_TTL_S = 30 * 24 * 3600; // re-checked long before this; the device decides by `until`

export async function passSigner(privateJwk: JWK): Promise<PassSigner> {
  const key = await importJWK(privateJwk, 'ES256');
  return {
    sign: ({ sub, email, plan, until }) =>
      new SignJWT({ email, plan, until })
        .setProtectedHeader({ alg: 'ES256', kid: privateJwk.kid })
        .setSubject(sub)
        .setIssuer(PASS_ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${PASS_TTL_S}s`)
        .sign(key),
  };
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function googleVerifier(clientId: string): GoogleVerifier {
  return {
    async verify(idToken) {
      try {
        const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId });
        if (payload.email_verified !== true || typeof payload.email !== 'string' || typeof payload.sub !== 'string') return null;
        return { sub: payload.sub, email: payload.email };
      } catch {
        return null;
      }
    },
  };
}
