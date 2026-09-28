import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as cryptoVerify,
} from 'node:crypto';

/**
 * 标准 OIDC 授权码流程 + PKCE。
 *
 * 不绑定任何具体厂商：Authentik / Keycloak / Google / GitHub(经 broker) 都一样，
 * 换 provider 只需要改 OIDC_ISSUER 三个环境变量。
 * 刻意不引认证框架：流程本身就是几个 HTTP 请求，自己写反而更好读、更好查。
 */

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
}

interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

const DISCOVERY_TTL = 3_600_000;
const JWKS_TTL = 3_600_000;

let discoveryCache: { at: number; value: Discovery } | undefined;
let jwksCache: { at: number; uri: string; keys: Jwk[] } | undefined;

export function oidcConfigured(): boolean {
  return Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID);
}

function issuer(): string {
  return (process.env.OIDC_ISSUER ?? '').replace(/\/$/, '');
}

/** 写进 identities.provider 的值，用于区分同一个用户的不同登录方式 */
export function oidcProviderId(): string {
  try {
    return new URL(issuer()).host;
  } catch {
    return issuer();
  }
}

export function oidcDisplayName(): string {
  return process.env.OIDC_NAME || oidcProviderId();
}

async function discover(): Promise<Discovery> {
  if (discoveryCache && Date.now() - discoveryCache.at < DISCOVERY_TTL) {
    return discoveryCache.value;
  }
  const res = await fetch(`${issuer()}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery 失败：HTTP ${res.status}`);
  const value = (await res.json()) as Discovery;
  discoveryCache = { at: Date.now(), value };
  return value;
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function createState(): string {
  return randomBytes(16).toString('base64url');
}

export async function buildAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  challenge: string;
}): Promise<string> {
  const d = await discover();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OIDC_CLIENT_ID ?? '',
    redirect_uri: opts.redirectUri,
    scope: process.env.OIDC_SCOPES || 'openid profile email',
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
  });
  return `${d.authorization_endpoint}?${params.toString()}`;
}

export interface OidcClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  groups?: string[];
}

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<OidcClaims> {
  const d = await discover();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: process.env.OIDC_CLIENT_ID ?? '',
    code_verifier: opts.verifier,
  });
  if (process.env.OIDC_CLIENT_SECRET) {
    body.set('client_secret', process.env.OIDC_CLIENT_SECRET);
  }

  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OIDC 换取令牌失败：HTTP ${res.status} ${detail.slice(0, 200)}`);
  }

  const tokens = (await res.json()) as { id_token?: string; access_token?: string };

  if (tokens.id_token) {
    return toClaims(await verifyIdToken(tokens.id_token, d));
  }
  // 少数 provider 不返回 id_token，退回 userinfo（依赖 TLS）
  if (tokens.access_token && d.userinfo_endpoint) {
    const info = await fetch(d.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!info.ok) throw new Error(`OIDC userinfo 失败：HTTP ${info.status}`);
    return toClaims((await info.json()) as Record<string, unknown>);
  }
  throw new Error('OIDC 返回的令牌里没有可用的身份信息');
}

/** 从 claim 里逐个字段安全取出，而不是把整个 payload 断言成目标类型 */
function toClaims(payload: Record<string, unknown>): OidcClaims {
  const subject = payload.sub;
  if (typeof subject !== 'string' || !subject) {
    throw new Error('OIDC 没有返回 sub，无法确定用户身份');
  }
  const str = (key: string): string | undefined =>
    typeof payload[key] === 'string' ? (payload[key] as string) : undefined;

  return {
    sub: subject,
    email: str('email'),
    email_verified:
      typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
    name: str('name'),
    preferred_username: str('preferred_username'),
    picture: str('picture'),
    groups: Array.isArray(payload.groups)
      ? payload.groups.filter((g): g is string => typeof g === 'string')
      : undefined,
  };
}

async function fetchJwks(uri: string): Promise<Jwk[]> {
  if (jwksCache && jwksCache.uri === uri && Date.now() - jwksCache.at < JWKS_TTL) {
    return jwksCache.keys;
  }
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`获取 JWKS 失败：HTTP ${res.status}`);
  const data = (await res.json()) as { keys?: Jwk[] };
  const keys = data.keys ?? [];
  jwksCache = { at: Date.now(), uri, keys };
  return keys;
}

const ALGORITHMS: Record<string, string> = {
  RS256: 'RSA-SHA256',
  RS384: 'RSA-SHA384',
  RS512: 'RSA-SHA512',
  ES256: 'SHA256',
  ES384: 'SHA384',
  ES512: 'SHA512',
};

/**
 * 校验 id_token：签名 + iss + aud + exp。
 * 这是认证的信任根，不能省。用 Node 内置 crypto 验，不引 jose/jsonwebtoken。
 */
async function verifyIdToken(idToken: string, d: Discovery): Promise<Record<string, unknown>> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('id_token 格式不正确');
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString()) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as Record<
    string,
    unknown
  >;

  const expectedIssuer = issuer();
  if (payload.iss !== expectedIssuer && payload.iss !== `${expectedIssuer}/`) {
    throw new Error(`id_token 的 iss 不匹配：${String(payload.iss)}`);
  }

  const clientId = process.env.OIDC_CLIENT_ID ?? '';
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(clientId)) {
    throw new Error('id_token 的 aud 不匹配');
  }

  const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  if (expiresAt && expiresAt < Date.now()) {
    throw new Error('id_token 已过期');
  }

  await verifySignature(header, `${headerPart}.${payloadPart}`, signaturePart, d);

  return payload;
}

async function verifySignature(
  header: { alg?: string; kid?: string },
  signingInput: string,
  signaturePart: string,
  d: Discovery,
): Promise<void> {
  const signature = Buffer.from(signaturePart, 'base64url');

  // HS256：用 client_secret 做 HMAC。
  // 不是首选（共享密钥），但不少 provider 在没配签名证书时就这么干——
  // Authentik 就是其中之一。不支持的后果是「登录永远失败」，所以必须兜住。
  if (header.alg === 'HS256' || header.alg === 'HS384' || header.alg === 'HS512') {
    const secret = process.env.OIDC_CLIENT_SECRET;
    if (!secret) {
      throw new Error(`id_token 用 ${header.alg} 签名，但没有配置 OIDC_CLIENT_SECRET`);
    }
    const digest = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[header.alg];
    const expected = createHmac(digest, secret).update(signingInput).digest();
    if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) {
      throw new Error('id_token 签名校验失败');
    }
    return;
  }

  const algorithm = header.alg ? ALGORITHMS[header.alg] : undefined;
  if (!algorithm) throw new Error(`不支持的签名算法：${String(header.alg)}`);

  if (!d.jwks_uri) throw new Error('provider 没有提供 jwks_uri，无法校验签名');
  const keys = await fetchJwks(d.jwks_uri);
  const jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
  if (!jwk) throw new Error('JWKS 里找不到匹配的密钥');

  const publicKey = createPublicKey({ key: jwk as never, format: 'jwk' });
  const valid = cryptoVerify(algorithm, Buffer.from(signingInput), publicKey, signature);
  if (!valid) throw new Error('id_token 签名校验失败');
}
