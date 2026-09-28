/**
 * Next.js 启动钩子：服务起来时把数据库迁移跑掉。
 *
 * 放在这里而不是单独的 migrate 命令，是为了让 `docker compose up` 一步到位——
 * 自托管者不该被要求记住「先跑迁移再起服务」。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { runMigrations } = await import('./server/migrate');
  try {
    await runMigrations();
  } catch (error) {
    // 迁移失败不要让进程起不来：纯本地模式仍然可用，
    // 但要在日志里喊清楚，否则会变成「表不存在」这种难查的报错。
    console.error('[db] 迁移失败，服务端功能将不可用：', error);
  }
}
