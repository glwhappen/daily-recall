/**
 * 数据库迁移。
 *
 * 刻意内联成 TS 字符串而不是读 .sql 文件：Next.js 的产物只打包被 import 到的东西，
 * 外部 SQL 文件在 standalone 构建里容易漏掉，运行时才发现表建不出来。
 */

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_init',
    sql: `
      create table if not exists users (
        id             text primary key,
        email          text unique,
        email_verified timestamptz,
        password_hash  text,
        name           text,
        image          text,
        preferences    jsonb not null default '{}'::jsonb,
        created_at     timestamptz not null default now()
      );

      -- OIDC 身份绑定：一个用户可以绑多个 provider，sub 是唯一标识
      create table if not exists identities (
        id         text primary key,
        user_id    text not null references users(id) on delete cascade,
        provider   text not null,
        subject    text not null,
        groups     jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        unique (provider, subject)
      );

      create table if not exists sessions (
        id         text primary key,
        user_id    text not null references users(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );
      create index if not exists sessions_user on sessions (user_id);

      -- 作答记录。主键是客户端生成的 UUID：同步靠它去重，合并就是集合并集。
      create table if not exists answers (
        id          text primary key,
        user_id     text not null references users(id) on delete cascade,
        question_id text not null,
        target_date date not null,
        offset_days integer not null,
        value       text not null,
        kind        text not null,
        answered_at timestamptz not null,
        answered_on date not null,
        session_id  text not null,
        revision_of text,
        created_at  timestamptz not null default now()
      );
      create index if not exists answers_user_lookup on answers (user_id, question_id, target_date);
      create index if not exists answers_user_day on answers (user_id, answered_on);

      -- 题目反馈：一人一题一票，可以是赞也可以是踩
      create table if not exists question_feedback (
        user_id     text not null references users(id) on delete cascade,
        question_id text not null,
        vote        text not null check (vote in ('up', 'down')),
        created_at  timestamptz not null default now(),
        primary key (user_id, question_id)
      );
      create index if not exists feedback_question on question_feedback (question_id, vote);

      -- 点踩的题对该用户永久隐藏（个人偏好，不影响别人的题库）
      create table if not exists question_blocks (
        user_id     text not null references users(id) on delete cascade,
        question_id text not null,
        created_at  timestamptz not null default now(),
        primary key (user_id, question_id)
      );

      -- 管理员在后台下线的题目。
      -- 不改 questions/*.yaml：那是 Git 管理的唯一事实源，容器里也只读，
      -- 改了会在下次部署时丢掉、并且和仓库版本对不上。这里存一份运行时叠加。
      create table if not exists disabled_questions (
        question_id text primary key,
        disabled_by text references users(id) on delete set null,
        reason      text,
        created_at  timestamptz not null default now()
      );
    `,
  },
];
