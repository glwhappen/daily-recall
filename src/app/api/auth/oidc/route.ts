import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildAuthorizeUrl, createPkce, createState, oidcConfigured } from '@/server/auth/oidc';
import { requestOrigin } from '@/server/http';

export const dynamic = 'force-dynamic';

/** OIDC 流程的临时状态（state + PKCE），只在跳转期间用，10 分钟过期 */
const FLOW_COOKIE = 'dr_oidc_flow';

export async function GET(request: Request) {
  const origin = requestOrigin(request);

  if (!oidcConfigured()) {
    return NextResponse.redirect(`${origin}/?auth_error=oidc_not_configured`);
  }

  const redirectUri = `${origin}/api/auth/oidc/callback`;
  const { verifier, challenge } = createPkce();
  const state = createState();

  const jar = await cookies();
  jar.set(FLOW_COOKIE, JSON.stringify({ state, verifier, redirectUri }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  try {
    const target = await buildAuthorizeUrl({ redirectUri, state, challenge });
    return NextResponse.redirect(target);
  } catch (error) {
    console.error('[oidc] 构造授权地址失败：', error);
    return NextResponse.redirect(`${origin}/?auth_error=oidc_unreachable`);
  }
}
