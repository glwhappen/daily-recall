import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exchangeCode, oidcConfigured, oidcProviderId } from '@/server/auth/oidc';
import { createSession } from '@/server/auth/session';
import { upsertOidcUser } from '@/server/auth/users';
import { requestOrigin } from '@/server/http';

export const dynamic = 'force-dynamic';

const FLOW_COOKIE = 'dr_oidc_flow';

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const url = new URL(request.url);

  const jar = await cookies();
  const rawFlow = jar.get(FLOW_COOKIE)?.value;
  jar.delete(FLOW_COOKIE);

  const providerError = url.searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(providerError)}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!oidcConfigured() || !code || !state || !rawFlow) {
    return NextResponse.redirect(`${origin}/?auth_error=oidc_bad_callback`);
  }

  let flow: { state: string; verifier: string; redirectUri: string };
  try {
    flow = JSON.parse(rawFlow) as typeof flow;
  } catch {
    return NextResponse.redirect(`${origin}/?auth_error=oidc_bad_callback`);
  }

  // state 必须和发起时一致，否则是 CSRF
  if (flow.state !== state) {
    return NextResponse.redirect(`${origin}/?auth_error=oidc_state_mismatch`);
  }

  try {
    const claims = await exchangeCode({
      code,
      // 用发起时存在 cookie 里的地址，保证与 authorize 阶段完全一致
      redirectUri: flow.redirectUri,
      verifier: flow.verifier,
    });

    const user = await upsertOidcUser({
      provider: oidcProviderId(),
      subject: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email_verified,
      name: claims.name ?? claims.preferred_username ?? null,
      image: claims.picture ?? null,
      groups: Array.isArray(claims.groups) ? claims.groups : [],
    });

    await createSession(user.id);
    return NextResponse.redirect(`${origin}/?auth=ok`);
  } catch (error) {
    console.error('[oidc] 登录失败：', error);
    return NextResponse.redirect(`${origin}/?auth_error=oidc_failed`);
  }
}
