# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 跨天一致性校验：同一个目标日期在不同偏移天数上被问到多次，答案不一致时分类为
  `conflict`（事实矛盾）、`decay`（正常遗忘）、`upgrade`（越久反而越清晰，可疑）。
- 复核机制：核对记忆时追加一条带 `revisionOf` 的记录，**不覆盖**原始答案，
  保证「第一次答错了」这个信号可用于计算漂移率。
- 按偏移天数加权的回忆覆盖率（远期记得得分更高）。
- 锚点题：每次练习自动包含 1 道，用于勾出当天的其他记忆。
- 三类回忆范围：近一点（≤2 天）/ 普通（≤14 天）/ 往远处想（优先 ≥3 天）。
- 中文题库 57 道题，8 个分类，含 JSON Schema 级别的构建期校验。
- 历史页（30 天热力图 + 分类表现）、待核对页、数据导出导入页。
- PWA manifest，可添加到手机主屏。
- Docker / docker compose 部署（静态站 + nginx）。
