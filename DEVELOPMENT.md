# soos 开发文档

## 1. 项目目标

soos 是一个面向多用户的在线 SEO 诊断工具，目标是把以下数据整合起来：

1. 对 sitemap、robots.txt、HTML 和 HTTP 信号的技术抓取。
2. Google Search Console 的真实收录与搜索表现数据。
3. 清晰、有优先级的诊断结论，包括问题原因、影响和修复建议。

soos 不只是检查孤立的 HTML 标签，而是回答一个更重要的问题：

> 网站提交的网址、用户实际访问的网址、爬虫抓取的网址和 Google 最终收录的网址是否一致？

## 2. 产品原则

- 诊断 URL 之间的关系，而不只报告单个标签。
- 明确区分 Google 确认的数据和本地技术推断。
- 判断未收录是需要修复的问题，还是合理的重复页面处理。
- 优先提供可执行的问题分组，避免输出大量重复警告。
- 简化 OAuth：部署者配置一个 Google OAuth App，访客只授权自己的 Google 账号。
- 隔离不同访客的 Search Console 授权和后台任务。
- 让大型扫描能够在 Serverless 环境中恢复和继续。
- 同时支持 English、简体中文和繁體中文。

## 3. 当前技术架构

### 前端

- React 19 + Vite。
- 主界面：`src/main.jsx`。
- 样式：`src/styles.css`。
- 扫描历史保存在浏览器本地。
- 当前任务 ID 保存在浏览器本地，刷新页面后可以恢复。

### 后端

- Node HTTP API：`server/api.js`。
- Vercel 适配入口：`api/index.js`。
- 本地 API 默认地址：`127.0.0.1:4177`。
- 支持直接扫描和请求驱动的后台批次扫描。

### 数据持久化

- 通过 `DATABASE_URL` 使用 Neon/Postgres。
- 每个浏览器会话独立保存 Search Console 配置。
- OAuth token 使用 AES-256-GCM 加密。
- 后台任务和已完成报告保留 7 天。
- 页面结果每 10 个 URL 保存一个 checkpoint。
- Neon worker lease 防止多个 Serverless 实例重复处理同一批任务。

## 4. 已实现功能

### 技术 SEO 检查

- 自动识别网站 URL、sitemap、sitemap index 和 robots.txt。
- 递归读取 sitemap index 和子 sitemap。
- 普通模式最多 250 个 URL，后台模式最多 2,000 个 URL。
- robots.txt 解析、规则匹配和被阻挡 URL 分析。
- HTTP 状态、跳转、noindex 和抓取失败诊断。
- sitemap URL、最终 URL 和 HTML canonical 一致性检查。
- hreflang、alternate 和双向引用检查。
- title、description、H1、lang、viewport 和 JSON-LD 存在性检查。
- 可选内容检查和轻量性能检查。
- 问题分组、执行摘要和修复优先级清单。
- CSV 和摘要导出。

### 后台任务

- 暂停、继续和停止。
- 请求驱动的 Serverless 批次执行。
- Neon 任务归属和会话隔离。
- 原子 worker lease。
- sitemap 和页面结果 checkpoint。
- 页面刷新后恢复任务。
- 冷启动后从最后完成的 10 URL 批次继续。

### Google Search Console

- 服务端共享 OAuth App。
- 每位访客独立授权 Google 账号。
- 显示已连接账号并支持断开连接。
- 自动刷新 access token。
- Search Analytics 支持：
  - Page
  - Query
  - Page + Query
  - Country
  - Device
- CTR、排名和查询覆盖机会分析。
- URL Inspection 可分批检查扫描到的网址。
- Google 收录 verdict、coverage state、robots 状态和抓取状态。
- Google canonical 和 user canonical。
- Google 已知 sitemap 与 referring URLs。
- Google 返回时显示移动端和富媒体结果状态。
- 提取已扫描 HTML 页面的站内链接并统计入链。
- 对比 sitemap、站内发现 URL、Search Analytics 页面和 Google 发现信号。
- 识别 sitemap 孤立页、未进入 sitemap 的可见页和规范化 URL 变体。
- URL 集合问题支持分类筛选和 CSV 导出。
- 解析完整 JSON-LD 脚本和 `@graph` 节点。
- 检查 JSON 语法、`@context`、本地 `@id` 引用和常见 Google 类型字段。
- 对照结构化数据 URL、名称、图片与页面信号。
- 合并本地 JSON-LD 诊断和 URL Inspection rich results issue。

### 多语言与部署

- English、简体中文和繁體中文。
- 支持 Vercel 部署。
- 使用 Neon 支持公共多用户环境。
- README、CHANGELOG 和 `npm run check` 发布检查流程。

## 5. 数据能力边界

- URL Inspection API 返回 Google 索引版本的状态，不能调用 Search Console 网页中的实时网址测试。
- URL Inspection 需要逐个 URL 请求，并受到 Google API 配额限制。
- Search Analytics 中出现过的网址不等于当前一定仍被收录。
- Search Console Sitemaps API 可以返回提交记录、错误和警告，但其中的 sitemap 收录数量字段已弃用。
- Google Search Console 没有提供完整 Googlebot 抓取日志 API；真实抓取 URL 需要服务器或 CDN access log。
- 结构化数据正确只能获得富媒体结果资格，不能保证 Google 一定展示富媒体结果。

## 6. URL 诊断模型

soos 的目标关系链是：

`Sitemap URL -> HTTP 最终 URL -> HTML canonical -> Google user canonical -> Google selected canonical`

每个接受 URL Inspection 的网址应归入一个主要状态：

- 信号一致且已收录。
- 信号一致但未收录。
- sitemap 提交 URL 发生跳转。
- sitemap URL canonical 指向其他页面。
- Google 选择了不同的 canonical。
- Google 没有报告 sitemap 来源。
- Google 已发现但尚未抓取。
- Google 已抓取但尚未收录。
- 合理的重复页或替代页。
- 存在 robots、noindex、HTTP 或抓取阻挡。

## 7. 全站能力地图

路线图不再只按单个功能排列，而是按用户完成一次 SEO 诊断所经过的完整链路组织。

| 主线 | 当前能力 | 当前状态 | 主要缺口 |
| --- | --- | --- | --- |
| 产品体验与信息架构 | 三语言界面、扫描控制、进度、历史、导出、Runtime 面板 | 可用，需要加固 | 主界面和状态较集中，空状态、错误状态和移动端体验仍需统一 |
| 抓取与技术 SEO | sitemap、sitemapindex、robots、canonical、hreflang、内容、性能、JSON-LD | 核心可用 | 真实站内发现、链接图、抓取深度、URL 参数策略和渲染后页面仍不完整 |
| Google 数据 | 用户 OAuth、Search Analytics、URL Inspection、页面集合对比、覆盖诊断 | 核心可用 | 属性选择、配额提示、日期对比、查询词聚类和更多维度分析待完善 |
| 报告与回归 | 摘要、问题列表、CSV、历史任务、Neon 保存、URL 级回归 | 可用 | 报告导航、筛选、分页、可分享报告和更细的变化解释待完善 |
| 平台与安全 | Vercel、Neon、OAuth 会话、加密保存、后台批次和租约恢复 | 可部署 | 限流、结构化日志、安全响应头、数据保留和迁移机制需要系统化 |
| 工程质量 | 构建检查、结构化数据测试、Googlebot 日志测试 | 基础阶段 | 前端、API、后台任务和关键用户流程缺少完整自动化测试 |

### 7.1 当前发布基线

当前版本已经能够完成以下闭环：

1. 从网站、sitemap 或 robots.txt 开始扫描。
2. 分析 sitemap 收录集合、robots 规则和页面级技术 SEO。
3. 通过 Google OAuth 连接用户自己的 Search Console 权限。
4. 将 sitemap、站内链接、GSC 表现和 URL Inspection 结果放入同一诊断视图。
5. 保存任务、恢复批次、比较历史版本，并导出结果。
6. 导入服务器访问日志并验证真实 Googlebot 请求。

当前产品定位仍是“技术 SEO 诊断工具”，不是托管爬虫平台、排名追踪 SaaS 或自动代改网站服务。

## 8. 当前风险与技术债

### P0：影响继续开发

- `src/main.jsx` 和 `server/api.js` 已成为大型单文件，继续叠加功能会提高回归风险。
- 自动化测试覆盖面偏窄，尚未覆盖 OAuth 状态、GSC API、任务恢复、历史比较和主要前端流程。
- 多语言文案经历过多轮修改，仍需要一次逐屏人工校对和编码检查。
- API 错误格式、加载状态、空状态和重试行为尚未完全统一。

### P1：影响诊断可信度

- 当前“站内 URL”主要来自已扫描页面中的链接，不等同于完整的站内递归爬虫。
- JavaScript 渲染后的内容不一定能被轻量 HTTP 抓取看到，报告需要明确数据来源和限制。
- URL 抓取身份与对比身份已分离；参数排序、跟踪参数、尾斜杠、大小写、默认文档和重定向链已有统一诊断策略。
- robots、canonical 和 hreflang 的边界情况需要更完整的测试矩阵。
- URL Inspection 有配额限制，不能默认对大型 sitemap 的全部 URL 执行检查。

### P1：影响生产可靠性

- 需要请求 ID、结构化日志和稳定的健康检查，方便定位 Vercel 与 Neon 问题。
- 需要对扫描、DNS 验证、日志导入和 Google API 代理增加明确的大小限制与速率限制。
- Neon 数据目前更接近应用状态存储，需要正式的 schema 版本和迁移流程。
- OAuth 密钥、会话密钥及保存数据的加密密钥需要轮换说明和失效策略。

## 9. 全站路线图

### v0.3：稳定性与模块化

目标：让现有功能更容易维护、测试和定位故障，不继续扩大两个主文件。

计划：

- 拆分前端的语言资源、API 客户端、扫描状态、GSC 面板、报告视图和历史任务模块。
- 已完成语言资源、共享前端 API client 与 React 错误边界拆分；扫描状态、GSC 面板、报告视图和历史任务仍待拆分。
- 拆分服务端的路由、Google OAuth、GSC 客户端、扫描器、任务存储和数据库访问层。
- 统一 API 成功与错误响应格式，前端统一 loading、empty、error、retry 状态。
- 增加 API 集成测试和关键前端流程的浏览器烟雾测试。
- 加入 React 错误边界，避免单个面板异常导致整页白屏。
- 完成 English、简体中文、繁體中文逐屏校对。
- 加入结构化日志、请求 ID、健康检查和基础运行指标。
- 为 API body、URL 数量、日志文件、DNS 验证和高成本端点设置限制。

验收标准：

- `main.jsx` 和 `server/api.js` 不再承担新增领域逻辑。
- OAuth 连接、扫描、暂停/恢复、GSC 加载、URL Inspection、历史恢复和导出都有自动化验证。
- 三种语言不存在乱码，主要按钮和错误提示语义一致。
- `npm run check` 能覆盖语法、单元测试、API 测试和生产构建。

### v0.4：抓取图谱与诊断准确度

目标：从“检查 sitemap 中的页面”提升为“解释网站实际可发现、可抓取和可索引的 URL 集合”。

计划：

- 已增加可选的站内递归发现队列：仅同站 HTTP(S)，最大深度 2，交互模式独立限制 100 个 URL、后台模式 500 个，并支持 checkpoint 恢复。
- 已建立扫描范围内的 URL 节点与链接边；站点根页存在时通过 BFS 计算首页最短点击深度、不可达 sitemap 页面和深层页面，同时保留入链、出链、递归发现深度与弱链接诊断。
- 对比 sitemap URL、内部链接 URL、重定向目标、canonical 目标和 Google 已知 URL。
- 已建立共享抓取 URL 规范化策略：仅 HTTP(S)、移除 fragment、主机小写并移除默认端口。
- 已加入查询参数与尾斜杠对比策略：可保留 query、移除已知跟踪参数、忽略全部 query，并可保持、移除或补充尾斜杠；策略仅影响匹配、去重和诊断，不改写实际抓取请求。
- 已增加参数排序等价比较，并将路径大小写、默认文档、协议、主机、尾斜杠及参数差异分为合理重复、建议统一和严重冲突。
- 已展示逐跳重定向链并诊断多跳、循环、无效 Location、超过 10 跳、跨主机和 HTTPS 降级；最终可索引目标继续结合 canonical 与 URL Inspection 判断。
- 扩充 robots、canonical、hreflang、noindex、状态码和 content-type 测试矩阵。
- 明确区分原始 HTML 检查与渲染后页面检查；后者作为可选能力。
- 可选接入 PageSpeed Insights、CrUX 或 Lighthouse，优先支持用户自备 API key 和免费额度。

验收标准：

- 报告能解释 sitemap 与实际站内发现 URL 不一致的原因。
- 每个未收录或不可索引 URL 都能显示证据链：来源、状态码、robots、meta、canonical 和 Google 状态。
- 大站点抓取在预算耗尽后可恢复，且不会重复处理已完成 URL。

### v0.5：Search Console 洞察

目标：把 Google 数据从单独表格变成可执行的页面级诊断。

计划：

- 通过 Search Console Sites API 列出用户可访问属性，减少手动输入 Property URL。
- 增加 Search Analytics 日期区间对比和点击、展示、CTR、排名变化解释。
- 支持 Query、Country、Device、Page + Query 组合分析。
- 识别关键词蚕食、同查询多页面、排名良好但 CTR 偏低、展示增长但点击未增长。
- 已为 URL Inspection 建立异常并集优先队列：本地技术阻挡、跳转/canonical 异常、GSC 非 sitemap 页面和站内发现非 sitemap URL 优先；新页面和历史回归优先级仍待加入。
- 显示 API 配额估算、已检查数量、跳过原因和可继续批次。
- 已接入 GSC Sitemaps API，展示 Google 看到的 sitemap、提交时间、最后读取、待处理状态、错误和警告；下一步可加入提交与删除操作。

验收标准：

- 用户无需记忆 property 格式即可选择自己有权限的站点。
- 每条 Google 诊断都能追溯到日期范围、维度、URL 和原始状态。
- 大站点不会因 URL Inspection 配额而无提示地得到不完整结论。

### v0.6：报告体验与持续诊断

目标：让报告更适合重复使用、筛选、比较和交付。

计划：

- 将单页长界面调整为清晰的扫描、Google、问题、URL、历史和设置视图。
- 为问题、URL、严重程度、来源和变化状态增加统一筛选与分页。
- 加强版本比较：新增、修复、恶化、持续存在，并解释变化证据。
- 支持生成可独立打开的 HTML 报告；PDF 作为后续可选导出。
- 增加服务器端报告列表、搜索、分页、保留期限和删除确认。
- 评估问题备注、负责人和处理状态；在没有真实协作需求前不引入完整账号团队系统。

验收标准：

- 用户能在大型报告中快速定位高优先级问题，而不需要浏览全部页面。
- 两次扫描可以稳定比较，并区分网站变化与扫描配置变化。
- 导出的报告包含扫描范围、限制、时间、配置和证据来源。

### v1.0：生产加固

目标：达到可公开长期运行的安全、隐私和维护标准。

计划：

- 正式数据库 schema、迁移、索引、数据完整性约束和恢复演练。
- OAuth、session 与数据加密密钥轮换流程。
- CSP、安全响应头、Cookie 策略、CSRF/SSRF 防护复核和依赖审计。
- 按用户、会话、IP 和高成本端点实施限流与滥用保护。
- 数据保留、用户断开、令牌撤销、报告删除和隐私说明形成完整闭环。
- 建立可用性、错误率、任务完成率、Google API 失败率和扫描耗时指标。
- 完成键盘操作、焦点、对比度、屏幕阅读器和移动端可用性检查。

验收标准：

- 用户可以查看并删除服务端保存的数据，断开 Google 后令牌不可继续使用。
- 关键故障有日志、请求 ID 和可操作错误信息。
- 部署、迁移和回滚步骤都有文档并经过验证。

### 暂不纳入

- Vercel Cron 或依赖付费定时器的自动扫描。
- Google URL Inspection 的实时抓取测试；官方 API 不提供等同于网页端 Live Test 的能力。
- 未导入服务器日志时推断“真实 Googlebot 已访问”。
- 保证富媒体结果展示；工具只能验证资格和发现问题。
- 完整排名追踪、自动内容生成、自动修改用户网站、团队计费和企业权限系统。

### 推荐的下一开发批次

下一批次从 `v0.3` 开始，顺序固定为：

1. 建立前后端模块边界，先迁移不改变行为的语言资源和 API 客户端。
2. 补 API 路由测试与浏览器关键流程测试，形成重构保护网。
3. 拆分 GSC、扫描任务和报告领域代码。
4. 统一错误模型、请求 ID、健康检查与界面状态。
5. 完成三语言逐屏校对，并清理已经与实现不符的旧提示。

每一批改动都必须更新本文件的状态、`CHANGELOG.md` 和相关 `README.md` 内容，并运行 `npm run check`。

## 10. 已完成里程碑（历史）

### Milestone A：Google URL 对照

状态：已完成

目标：把本地扫描和 URL Inspection 合并为同一张 URL 关系矩阵。

- [x] 收集本地提交 URL、最终 URL 和 HTML canonical。
- [x] 收集 Google verdict、coverage state 和 canonical。
- [x] 建立组合 URL 对照模型。
- [x] 增加主要分类和严重程度。
- [x] 增加状态统计和筛选。
- [x] 导出 URL 对照矩阵。

### Milestone B：收录覆盖诊断

状态：已完成

- [x] 以用户控制的 25 URL 批次检查 sitemap URL，避免不受控消耗配额。
- [x] 按 Google 未收录原因分组。
- [x] 区分合理重复页和需要修复的排除页。
- [x] 结合 Search Analytics 点击和展示确定重要页面优先级。
- [x] 检查最后抓取时间，发现长期未抓取的重要页面。

### Milestone C：URL 集合对比

状态：已完成

- [x] 对比 sitemap URL 和本地爬虫发现的内部链接。
- [x] 对比 sitemap URL 和 Search Analytics 页面。
- [x] 对比 sitemap URL 和 Google 报告的 sitemap/referrer 数据。
- [x] 检测 HTTP/HTTPS、www/non-www、尾斜杠和参数 URL 变体。
- [x] 识别 sitemap 孤立页面和未包含在 sitemap 的 Google 可见页面。

### Milestone D：结构化数据

状态：已完成

- [x] 解析全部 JSON-LD graph，而不只是检查是否存在。
- [x] 报告 JSON 语法错误和 graph 引用错误。
- [x] 验证 Google 支持的常见页面类型和必填字段。
- [x] 根据页面类型推荐有价值的字段。
- [x] 对比结构化数据中的 URL、图片、名称和页面可见内容。
- [x] 合并本地验证结果与 Google rich results issue。

当前已覆盖的类型：Article、NewsArticle、BlogPosting、Product、Offer、Review、AggregateRating、BreadcrumbList、FAQPage、LocalBusiness 常见子类型、VideoObject、Recipe、Event、JobPosting、Organization、WebSite、Course、Dataset、SoftwareApplication、ProfilePage、QAPage、DiscussionForumPosting、SocialMediaPosting、ItemList、Movie、EmployerAggregateRating、ClaimReview、ImageObject、VacationRental 和 MathSolver。

结构化数据面板会显示每种实际发现类型的规则覆盖状态。未配置 Google 专属规则的自定义或少见类型仍会被解析，并明确标记为“仅解析”，不会伪装成已完整验证。Book Actions 依赖独立 DataFeed，不属于当前 HTML 页面扫描范围；Google 已于 2026 年 1 月停止支持 Vehicle Listing，因此不再新增该规则。

### Milestone E：Googlebot 日志

状态：已完成

- [x] 导入 Nginx、Apache、Cloudflare 和 Vercel 日志。
- [x] 验证真实 Googlebot 请求。
- [x] 对比 Googlebot 抓取 URL 和 sitemap URL。
- [x] 发现抓取浪费、长期未抓取的重要页面和重复服务器错误。

日志原文只在浏览器本地解析，不上传也不写入 Neon。前端只将疑似 Google crawler User-Agent 对应的唯一公网 IP 发送到 `/api/googlebot/verify`。服务端按照 Google 官方流程执行反向 DNS，再对可信 Google 主机名执行正向 DNS 并确认原始 IP；私网和本机 IP 会被拒绝。

### Milestone F：运营能力

状态：已完成

- [x] Neon 最近任务列表。
- [x] 恢复、删除和查看保留任务。
- [x] 版本变化对比和回归提醒。

定时重复扫描已主动移出产品范围，避免依赖可能产生费用的 Vercel Cron。用户仍可手动重复扫描，并通过 Neon 保留任务与浏览器历史比较版本变化。

## 11. 实施记录

### 2026-06-06

- 建立开发主文档。
- 记录项目目标、架构、已实现功能和 Google API 能力边界。
- 建立 URL 诊断关系模型和六个主要里程碑。
- 完成 Milestone A：Google URL 对照。
- 增加提交 URL、实际 URL、HTML canonical、Search Console user canonical 和 Google canonical 对照矩阵。
- 增加主要诊断分类、严重程度、状态筛选和 CSV 导出。
- 三种语言均已加入相关界面文案。
- 开始 Milestone B：收录覆盖诊断。
- 增加累计式 25 URL Inspection 批次，可以继续检查超过最初 25 个的网址，同时由用户控制 Google 配额使用。
- 按 discovered、crawled、duplicate、canonical、blocked、soft 404、fetch 等 Google 状态分组。
- 将检查结果区分为需要修复、合理排除和已收录。
- 结合 Search Analytics 点击、展示、技术阻挡和最后抓取时间计算高、中、低优先级。
- 增加收录覆盖诊断 CSV 导出。
- 完成重要页面抓取时效视图，只分析已收录且有 Search Analytics 搜索需求的页面。
- 使用 30、90、180 天抓取年龄阈值区分近期、关注、长期未抓取和严重过期。
- 支持按风险、搜索需求和抓取年龄排序，并导出抓取时效 CSV。
- 完成 Milestone B：收录覆盖诊断。
- 开始并完成 Milestone C：URL 集合对比。
- 扫描 HTML 页面时提取最多 500 个同站链接，支持识别 HTTP/HTTPS 和 www/non-www 变体。
- 统计已扫描页面之间的入链，识别 sitemap 孤立页和站内发现但未进入 sitemap 的网址。
- 对比 Search Analytics 页面与 sitemap，保留点击和展示数据作为问题上下文。
- 合并 URL Inspection 的 sitemap 和 referring URLs 信号。
- 检测协议、主机、尾斜杠和参数形成的 URL 变体组。
- 增加三语言分类筛选、问题统计、范围提示和 CSV 导出。
- 兼容旧历史报告：没有站内链接字段时不生成孤立页误报。
- `npm run check` 和 `git diff --check` 通过。
- 开始 Milestone D：结构化数据深度诊断。
- JSON-LD 解析从“统计脚本是否有效”升级为完整脚本、数组和 `@graph` 节点解析。
- 增加 JSON 语法、缺少 `@context`、断裂本地 `@id` 引用和无效 URL 检查。
- 首批加入 Product、Breadcrumb、FAQ、LocalBusiness、Video、Recipe、Event、JobPosting 等 Google 字段规则。
- 对 Article、Organization 和 WebSite 等无硬性必填字段的类型仅给出推荐项，不误报为富媒体资格错误。
- 对比结构化数据页面 URL、名称、图片与页面 title、可见文本、图片和 Open Graph 信号。
- 增加三语言结构化数据总览、类别筛选、本地/Google 合并结果和 CSV 导出。
- 增加 `tests/structured-data.test.js`，并纳入 `npm run check`。
- 扩展 Course、Dataset、SoftwareApplication、ProfilePage、QAPage、DiscussionForumPosting、SocialMediaPosting 和 ItemList 规则。
- 增加 Dataset 描述长度、Software 价格、日期、评分、计数和列表位置格式验证。
- 增加 LocalBusiness 地址、Event 地点、JobPosting 雇主/地点、讨论作者/评论和 Article 作者嵌套对象验证。
- 结构化数据内部诊断代码增加 English、简体中文和繁體中文可读标签。
- 扩展回归样例到 42 个预期诊断，`npm run check` 通过。
- 修正 VideoObject 当前规则：`description` 已由 Google 从必填字段调整为建议字段。
- 增加 Movie、Review、AggregateRating、EmployerAggregateRating、ClaimReview、ImageObject、VacationRental 和 MathSolver 规则。
- 增加视频 Clip、图片许可、度假租赁 occupancy、事实核查评分、MathSolver action、Speakable 和付费内容标记验证。
- 增加类型规则覆盖矩阵；自定义或未覆盖类型显示“仅解析”状态。
- 明确排除独立 Book Actions DataFeed 和 Google 已于 2026 年 1 月停止支持的 Vehicle Listing。
- 扩展回归样例到 72 个预期诊断，完成 Milestone D。
- 开始并完成 Milestone E：Googlebot 日志分析。
- 增加 Nginx/Apache Combined、Cloudflare、Vercel、JSON/NDJSON、CSV 和 TSV 日志自动识别。
- 日志原文在浏览器本地解析，最多处理前 200,000 行，只发送唯一疑似 Google crawler IP 做验证。
- 根据 Google 官方建议执行反向 DNS、可信域名后缀检查和正向 DNS 原始 IP 匹配。
- 增加私网 IP 拒绝、100 IP 批次上限、10 IP 并发和 6 小时 DNS 验证缓存。
- 对比已验证 Google 请求与 sitemap URL，识别 sitemap 外 URL、参数 URL、静态资源、robots 阻挡 URL 和未抓取页面。
- 汇总唯一 URL、HTTP 4xx/5xx、重复服务器错误、最早/最后请求和疑似伪装 Googlebot。
- 结合 Search Analytics 需求提高“日志周期内未抓取”页面优先级。
- 增加三语言筛选、统计和 CSV 导出。
- 增加 `tests/googlebot-log.test.js` 并纳入 `npm run check`。
- 当前 Windows 浏览器沙箱无法启动，因此本阶段完成构建与响应式 CSS 检查，但未完成自动截图验证。
- 开始 Milestone F：运营能力。
- 增加当前浏览器会话的 Neon 最近任务列表，最多显示最近 20 条。
- 已完成任务可读取完整保留报告；暂停、停止、错误和中断任务可恢复继续。
- 删除任务时同时删除主任务、页面 checkpoint 批次和 worker lease。
- 列表查询剥离完整报告，只返回输入、状态、进度、分数和扫描摘要，降低大型报告的 Neon 传输量。
- 浏览器历史不再按网站覆盖旧版本，同一网站可以保留多次扫描版本。
- 历史记录保存 URL + issue type 轻量指纹，版本对比可显示新增回归和已解决问题。
- 旧历史记录保持兼容，继续显示严重程度和专题数量变化。
- 完成 Milestone F：运营能力。
- 2026-06-07：按产品成本要求移除定时扫描、Vercel Cron、计划管理界面和 `CRON_SECRET` 配置。
- 2026-06-07：重新核对 Sitemap / Google 收录、URL 集合、Googlebot 日志和结构化数据原始计划，确认主体诊断已完成。
- 2026-06-07：接入 Search Console Sitemaps API，增加三语言状态面板、当前扫描 sitemap 对照和数据转换测试。
- 2026-06-07：明确忽略已弃用的 sitemap `indexed` 汇总字段，不使用它判断 URL 级收录。
- 2026-06-07：URL Inspection 从顺序检查 sitemap URL 改为 sitemap、GSC 页面和站内发现 URL 的异常并集优先队列。
- 2026-06-07：候选 URL 按技术阻挡、URL 信号异常、GSC 缺失 sitemap、站内缺失 sitemap、无 GSC 展示和普通基线分级；同一 URL 合并来源并保留查询参数。
- 2026-06-07：新增候选队列单元测试并纳入 `npm run check`；站内候选仍仅覆盖已扫描页面抽取的链接。
- 2026-06-07：加入可选的有界递归站内发现，递归页面独立保存为 `discoveredPages`，不污染 sitemap 页面集合、健康分和 sitemap 信号。
- 2026-06-07：递归队列排除站外链接、非 HTTP 链接和常见静态资源，保留查询参数，限制深度与独立 URL 预算，并支持后台 checkpoint 恢复。
- 2026-06-07：递归发现页面接入 URL 集合对比和 URL Inspection 候选队列，并增加三语言范围及截断提示。
- 2026-06-07：增加站内链接图谱，统一 sitemap 与递归发现页面的链接边，输出孤立页、深层发现、弱入链、无扫描出链和健康链接分类。
- 2026-06-07：图谱支持三语言筛选、节点/边统计及 CSV 导出；发现深度明确不冒充从首页计算的完整点击深度。

### 2026-06-11

- 从已扫描站点根页执行有向链接 BFS，增加真实首页最短点击深度、可达页面数和最大点击深度。
- 根页未扫描时不推断不可达状态，并在界面明确显示数据边界。
- 将首页不可达 sitemap 页面和点击深度 3 以上页面加入 URL Inspection 优先候选队列。
- 扩展图谱与候选队列测试，覆盖不可达组件、深层路径、根页缺失和 Inspection 优先级。
- 将自动跟随跳转改为最多 10 跳的受控逐跳请求，记录每一跳状态、Location 和规范目标。
- 增加重定向循环、无效 Location、过长链、跨主机、HTTPS 降级和多跳诊断，并写入页面详情、CSV、修复清单与 Inspection 优先级。
- 新增共享 URL policy，统一服务端抓取、递归发现、链接图谱和 Inspection 候选的 URL 身份规则。
- 增加三语言 URL 对比策略控件，审计报告保存策略并在 URL 集合诊断中显示当前规则。
- 查询参数支持保留全部、移除已知跟踪参数或忽略全部；尾斜杠支持保持、统一移除或统一补充。
- URL 变体诊断新增路径大小写、默认文档和参数语义分类；纯内容标识参数变化不作为重复 URL 冲突报告。
- 新增共享 JSON API client，统一网络错误、HTTP 状态、服务端错误码、请求 ID、详情与重试标记。
- 主入口接入三语言 React 错误边界，组件渲染异常不再直接形成整页白屏。
- 主界面、GSC、Inspection、结构化数据和 Googlebot 文案迁移到独立 `i18n.js`，并增加三语言键一致性与乱码测试。
- 增加基于真实随机端口 HTTP server 的 API 路由测试，覆盖预检、404、非法 JSON、任务创建、会话隔离、暂停/恢复和删除。
- 审计任务端点、活动任务 localStorage 与进度快照转换已迁移到独立 `audit-jobs.js`，并覆盖损坏存储和阶段标签测试。
- 所有 Search Console API 路由集中到 `gsc-client.js`；OAuth 配置和 Sitemap 状态面板已从 `main.jsx` 拆出，并增加请求契约测试。

## 12. 历史完成度基线

| 模块 | 完成度 |
| --- | ---: |
| Sitemap 技术检查 | 90% |
| robots.txt 诊断 | 80% |
| Canonical 与 hreflang | 75% |
| 后台与 Serverless 执行 | 85% |
| Search Console OAuth | 90% |
| Search Analytics 诊断 | 70% |
| URL Inspection 诊断 | 95% |
| Google URL 对照矩阵 | 85% |
| URL 集合对比 | 100% |
| 结构化数据验证 | 100% |
| Googlebot 日志分析 | 100% |
| 任务与报告管理 | 100% |
| 版本回归对比 | 100% |
| 定时监控 | 已停用 |

每次里程碑范围变化、开始实现、测试通过或功能完成时，都必须更新本文件。
