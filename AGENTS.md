# AGENTS.md — Daily Recall

面向 AI 编码代理的项目约定。产品说明见 `README.md`，出题规范见 `docs/question-guide.md`，
任务与已知问题见 `TODO.md`，项目档案见 `PROJECT.md`。

## 项目速览

- **一句话**：每天问几道关于「昨天」的题，同一个日子隔几天再问一次，用跨天答案的差异观察记忆漂移。
- **形态**：Next.js 服务端应用 + 可选的 PostgreSQL。**不配任何东西也能跑**（退化成纯本地模式）。
- **技术栈**：Next.js App Router + React + TypeScript strict + 手写 CSS + `pg`（无 ORM）。
  刻意不引入 UI 组件库、状态管理库、认证框架、ORM——加账号系统已经够重了。
- **关键目录**：
  - `questions/*.yaml`：题库，唯一事实源；社区贡献的主要入口。
  - `src/lib/`：**纯逻辑**（日期锚定 / 组题 / 漂移检测 / 评分 / 存储 / 多端合并），
    无框架依赖、不碰数据库、不读系统时钟，有单测。
  - `src/server/`：服务端专用（数据库、迁移、认证、同步、反馈）。
  - `src/components/AppProvider.tsx`：客户端统一状态（能力开关 + 登录 + 本地数据 + 同步）。
  - `src/app/api/`：Route Handlers。

## 常用命令

```bash
npm run dev               # 开发服务器
npm test                  # 单测 + 题库校验（改完逻辑必跑）
npm run typecheck
npm run build
docker compose up -d --build                              # 生产（含 PostgreSQL）
docker compose -f docker-compose.dev.yml up -d --build     # 预览（端口 4471）
```

## 工作约定（重要）

1. **配置驱动，默认可用**：任何新功能都要能在「没配数据库」时安全降级。
   如果一段代码在纯本地模式下会崩，那它就必须先判断 `capabilities().server`。
2. **`src/lib/` 的纯净性**：不引入 React / DOM / `pg` / UI 框架，不读系统时钟
   （`today` 一律从参数传入）。这一层要能被别处直接复用。
3. **数据模型不可回退**：
   - 作答记录**不可变**：复核追加 `revisionOf` 记录，绝不覆盖。同步靠这个前提才成立。
   - 题目 `id` 一旦发布不能改（会切断跨天关联），翻译不改 ID。
4. **同步只用 `mergeAnswers`**：客户端和服务端必须调用同一个函数。
   两边各写一套「哪些要传」的逻辑，迟早会出现认知错位。
5. **题库文件只读**：后台「下线题目」写数据库（`disabled_questions`），
   不改 `questions/*.yaml`——那是 Git 管理的唯一事实源，容器里也只读。
6. **隐私红线**：任何上报、埋点、第三方统计都是破坏性变更，先讨论。
   用户数据默认不出浏览器；只有登录后才进自己的账号。
7. **新增逻辑带测试**：边界用例（跨月跨年、空数据、题库耗尽、合并幂等）必须有覆盖。
8. **提交规范**：约定式提交（`feat:` / `fix:` / `docs:` / `test:` / `build:`）。
   **不要主动 `git push`**。

## 验收

- 逻辑改动：`npm test` + `npm run typecheck` 必须全绿。
- 涉及服务端的改动：**两种模式都要测**——不配 `DATABASE_URL` 时功能正常降级。
- UI 改动：构建后实测（亮色/暗色、手机宽度 390px），确认无横向滚动、无缩放。
- 部署改动：两个域名都要能打开；容器额外检查 rootfs
  （`PID=$(docker top <容器> | awk 'NR==2{print $2}'); ls /proc/$PID/root | wc -l`，小于 10 即异常）。
