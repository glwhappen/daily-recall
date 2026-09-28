# TODO

## v2 服务端（进行中）

- [x] 服务端骨架 + PostgreSQL + 启动时自动迁移
- [x] 认证：标准 OIDC（授权码 + PKCE，自带验签）+ 可选邮箱密码
- [x] 云端同步（服务端与客户端复用同一个 `mergeAnswers`）
- [x] 题目反馈：一人一题一票，点踩即个人屏蔽
- [x] 题目管理后台：按点踩率排序、下线/恢复、导出同步清单
- [ ] 部署到 `memory_dev.hsfp.cn` 并验证
- [ ] 接 `auth.hsfp.cn` 的 OIDC（在 Authentik 建 Provider + Application）
- [ ] 验证后部署生产
- [ ] 注册/登录接口限流（目前只靠 scrypt 本身慢，防不住分布式爆破）
- [ ] 邮箱验证与找回密码（目前注册后立即可用）
- [ ] 增量同步（现在每次全量上传，一年记录约 2000 条）
- [ ] 反馈汇总导出 / 可选自动开 GitHub issue（需 `GITHUB_TOKEN`）

## v1 收尾

- [x] 部署到 `memory_dev.hsfp.cn` 并验证（手机 + 桌面、亮暗色）
- [x] 验证通过后切 `memory.hsfp.cn`
- [x] 创建 GitHub 仓库并推送：https://github.com/glwhappen/daily-recall（public，MIT）

## v1.1

- [ ] 英语题库 `questions/en.yaml`（翻译 57 道题，ID 保持不变）
- [ ] 题库 JSON Schema 文件 `questions/schema.json`，给编辑器补全用
- [ ] GitHub Actions CI：`npm test` + `typecheck` + `build`（配置文件已就位，待验证首次运行）
- [ ] 真正离线可用（service worker 预缓存），当前只有 manifest 可安装
- [ ] 结果页展示「本次涉及目标日期的遗忘曲线」小图

## v2 讨论中

- [ ] 可选同步：让用户跨设备带历史（默认关闭，且**不能**变成账号门槛）
- [ ] 事实记录的浏览视图：按天回看「吃了什么、去了哪」，把事实题当日志用
- [ ] 记忆校准分：把「自评记得」与「事实一致性」交叉起来，量化过度自信
- [ ] 每日提醒（本地通知，不依赖服务器）

## 已知问题

- 候选池会耗尽：题库 57 题、每天 5–10 题，约两三周后某个范围的题会被问完。
  当前只是提示「换一个范围」，更好的做法是降级复用或提示补题。
- `today` 在页面打开时固定（`useMemo`），跨零点后不刷新，需要手动重开页面。
- 英文 UI 文案已就绪，但题库仍是中文，`en` locale 会回退到中文题库。
- PWA 只有 manifest，没有 service worker，因此断网打不开（可安装但无离线能力）。
- 题库的 `offsets` 目前靠人工判断（见 `docs/question-guide.md` 第七节），
  等积累真实数据后应该用实际「不记得率」反向校准。
