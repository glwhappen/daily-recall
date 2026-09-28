/**
 * 能力开关。
 *
 * 设计目标：不配任何东西也能跑。部署者按需要逐项打开，
 * 每打开一层带来的复杂度都由他自己承担，没打开的路径完全不参与。
 */

export interface Capabilities {
  /** 是否启用服务端能力（云端同步）。没配数据库就是纯本地模式 */
  server: boolean;
  /** 是否允许注册登录 */
  auth: boolean;
  /** 是否接受题目反馈（点赞/点踩） */
  feedback: boolean;
  /** 允许哪些邮箱进后台（逗号分隔）；OIDC 管理员组见 adminGroups */
  adminEmails: string[];
  /** OIDC 里视为管理员的组 */
  adminGroups: string[];
  /** 站点公网地址，用于拼 OIDC 回调地址 */
  publicUrl: string;
}

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw !== 'false' && raw !== '0';
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function capabilities(): Capabilities {
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  return {
    server: hasDatabase,
    // 配了数据库就默认打开，想关掉显式设 false——多数自托管者要的就是「开箱有账号」
    auth: hasDatabase && flag('AUTH_ENABLED', true),
    feedback: hasDatabase && flag('FEEDBACK_ENABLED', true),
    adminEmails: list('ADMIN_EMAILS').map((e) => e.toLowerCase()),
    adminGroups: list('ADMIN_GROUPS'),
    publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  };
}

/** 暴露给前端的部分（不含任何敏感配置） */
export function publicCapabilities(): Pick<Capabilities, 'server' | 'auth' | 'feedback'> & {
  oidc: boolean;
  password: boolean;
} {
  const caps = capabilities();
  return {
    server: caps.server,
    auth: caps.auth,
    feedback: caps.feedback,
    // 前端据此决定显示哪些登录按钮
    oidc: caps.auth && Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID),
    password: caps.auth && flag('AUTH_PASSWORD_ENABLED', true),
  };
}

export function isAdmin(user: { email?: string | null; groups?: string[] }): boolean {
  const caps = capabilities();
  const email = user.email?.toLowerCase();
  if (email && caps.adminEmails.includes(email)) return true;
  const groups = user.groups ?? [];
  return groups.some((g) => caps.adminGroups.includes(g));
}
