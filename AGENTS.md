# AGENTS.md — Daily Recall

面向 AI 编码代理的项目约定。产品说明见 `README.md`，出题规范见 `docs/question-guide.md`，
任务与已知问题见 `TODO.md`，项目档案见 `PROJECT.md`。

## 项目速览

- **一句话**：每天问几道关于「昨天」的题，同一个日子隔几天再问一次，用跨天答案的差异观察记忆漂移。
- **形态**：纯静态站（Next.js `output: 'export'`），零后端、零账号，数据在 `localStorage`。
- **技术栈**：Next.js App Router + React + TypeScript strict + 手写 CSS。**刻意不引入 UI 组件库和状态管理库**。
- **关键目录**：
  - `questions/*.yaml`：题库，唯一事实源；社区贡献的主要入口。
  - `src/lib/`：纯逻辑（日期锚定 / 组题 / 漂移检测 / 评分 / 存储），无框架依赖，有单测。
  - `src/components/`、`src/app/`：UI。
  - `scripts/build-questions.mjs`：YAML → `src/generated/questions.json`（构建产物，不入库）。

## 常用命令

```bash
npm run dev               # 开发服务器
npm test                  # 单测 + 题库校验（改完逻辑必跑）
npm run typecheck
npm run build             # 静态导出到 out/
docker compose up -d --build          # 生产
docker compose -f docker-compose.dev.yml up -d --build   # 预览（端口 4471）
```

## 工作约定（重要）

1. **最小改动**：只改与任务直接相关的代码，不做顺手重构、不调整无关格式。
2. **`src/lib/` 的纯净性**：不引入 React / DOM / UI 框架，不读系统时钟（`today` 一律从参数传入，见 `date.ts`），保证可测试、可复用。
3. **数据模型不可回退**：`Answer` 记录是不可变的。复核不覆盖，而是追加一条带 `revisionOf` 的记录——「第一次答错了」这个信号必须保留，否则漂移率算不出来。
4. **ID 不可变**：题目的 `id` 一旦发布不能改（会切断跨天关联）。翻译不改 ID。
5. **隐私红线**：任何引入后端、上报、埋点、第三方统计的改动都是破坏性变更，先讨论再动手。
6. **新增逻辑带测试**：边界用例（跨月跨年、空数据、题库耗尽、条目重复）必须有覆盖。
7. **提交规范**：约定式提交（`feat:` / `fix:` / `docs:` / `test:` / `build:`）。**不要主动 `git push`**。

## 验收

- 逻辑改动：`npm test` + `npm run typecheck` 必须全绿。
- UI 改动：构建后实测（亮色/暗色、手机宽度 390px 与桌面），确认无横向滚动、无缩放。
- 部署改动：两个域名都要能打开；容器额外检查 rootfs 是否正常（`PID=$(docker top <容器> | awk 'NR==2{print $2}'); ls /proc/$PID/root | wc -l`，小于 10 即异常）。
