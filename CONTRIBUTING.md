# 贡献指南

感谢愿意花时间。这个项目最容易上手、也最缺人的部分是**题库**——详见 [docs/question-guide.md](docs/question-guide.md)。

## 开发环境

```bash
npm install
npm run dev
```

提交前请确保：

```bash
npm test          # 单元测试 + 题库校验
npm run typecheck
npm run build     # 静态导出必须成功
```

`src/generated/questions.json` 是构建产物，不入库，由 `predev` / `prebuild` 自动生成。

## 贡献题目

1. 读 [docs/question-guide.md](docs/question-guide.md)。
2. 在 `questions/zh-CN.yaml` 的对应分类下追加条目（必要时先加分类）。
3. 跑 `npm test`，题库校验测试会指出具体哪道题不合格。

加题 PR 不需要写代码。一道好题比十行代码更有价值。

## 贡献翻译

- **英文题库**：复制 `questions/zh-CN.yaml` 为 `questions/en.yaml`，请只翻译 `text`、`options.value`、`categories.name`，**`id` 必须保持完全一致**——ID 是跨语言关联同一条记忆的键。
- **UI 文案**：在 `src/i18n/strings.ts` 里补全对应 locale 的字符串表。

## 代码约定

- **语言**：TypeScript strict，无 `any` 逃逸。
- **`src/lib/` 保持纯粹**：不引入 React、不引入 UI 框架、不读系统时钟（时间一律从参数传入）。这样它可测试，也能被别处复用。
- **改动最小化**：不要顺手重构无关代码；一个 PR 只做一件事。
- **依赖克制**：v1 刻意不引入 UI 组件库和状态管理库。加依赖请在 PR 里说明为什么原生方案不够用。
- **注释写「为什么」，不写「是什么」**：代码能说明是什么，注释要说清为什么这么写（尤其是那些看起来奇怪但有意为之的决定）。
- **新增逻辑要带测试**：`tests/` 下的用例应覆盖边界（跨月跨年、空数据、题库耗尽、条目重复）。

## 提交信息

使用约定式提交，中文或英文均可：

```
feat: 增加「宠物」分类的 4 道题
fix: 修正跨月时目标日期回退一天的错误
docs: 补充 offsets 的取值说明
test: 覆盖题库耗尽时组题的行为
```

## Pull Request 检查清单

- [ ] `npm test` 通过
- [ ] `npm run typecheck` 通过
- [ ] 涉及 UI 的改动附上亮色/暗色截图
- [ ] 涉及题库的改动说明了新增题目的意图
- [ ] 没有提交 `src/generated/` 或 `out/`

## 隐私红线

本项目的核心承诺是「数据不离开用户的浏览器」。任何引入后端、上报、埋点、第三方统计的改动，都属于破坏性变更，必须先在 issue 里讨论并给出充分理由。
