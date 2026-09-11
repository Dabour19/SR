/**
 * Firebase ID token verification for Cloudflare Workers (no firebase-admin).
 * Verifies an RS256 JWT against Google's public JWK set using WebCrypto.
 *
 * Checks: signature, exp, iss, aud, and that the token's `sub` matches the
 * claimed player id. The expected Firebase project id comes from env.
 */

const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface CachedKeys {
  keys: JsonWebKey[]; // raw JWKs; import lazily per kid
  expiresAt: number;
}
let cache: CachedKeys | null = null;

interface JwtHeader { kid?: string; alg?: string; }
interface JwtPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  [k: string]: unknown;
}

function b64urlToUint8(input: string): Uint8Array<ArrayBuffer> {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function fetchJwks(): Promise<JsonWebKey[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.keys;
  const res = await fetch(JWK_URL);
  if (!res.ok) throw new Error('jwks fetch failed');
  const data = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  cache = { keys: data.keys, expiresAt: Date.now() + 60 * 60 * 1000 }; // 1h
  return cache.keys;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  uid?: string;
}

export async function verifyIdToken(
  token: string,
  projectId: string | undefined,
  expectedUid?: string
): Promise<VerifyResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, error: 'malformed token' };

    const header = JSON.parse(new TextDecoder().decode(b64urlToUint8(parts[0]))) as JwtHeader;
    if (header.alg !== 'RS256') return { ok: false, error: 'bad alg' };

    const jwks = await fetchJwks();
    const jwk = jwks.find((k) => (k as any).kid === header.kid);
    if (!jwk) return { ok: false, error: 'unknown kid' };

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToUint8(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return { ok: false, error: 'bad signature' };

    const payload = JSON.parse(new TextDecoder().decode(b64urlToUint8(parts[1]))) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if ((payload.exp ?? 0) < now) return { ok: false, error: 'expired' };
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      return { ok: false, error: 'bad iss' };
    }
    if (projectId && payload.aud !== projectId) return { ok: false, error: 'bad aud' };
    if (expectedUid && payload.sub !== expectedUid) return { ok: false, error: 'uid mismatch' };

    return { ok: true, uid: payload.sub };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
