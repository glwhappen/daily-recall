import { capabilities } from './config';

/**
 * 推导本站的公网地址。
 *
 * OIDC 的 redirect_uri 必须和 provider 里登记的一字不差，
 * 所以优先用显式配置的 PUBLIC_URL（反代后面靠 x-forwarded-* 猜容易出错）。
 */
export function requestOrigin(request: Request): string {
  const caps = capabilities();
  if (caps.publicUrl) return caps.publicUrl;

  const headers = request.headers;
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000';
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
