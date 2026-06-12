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
- 历史存储与版本差异：`src/history.js`。
- 历史、保留任务和版本比较面板：`src/components/HistoryPanels.jsx`。
- URL 结果行、筛选与分页：`src/components/UrlFindingsPanel.jsx`。
- 扫描摘要与限制状态：`src/components/ScanSummaryView.jsx`。
- robots、sitemap 与 hreflang 问题视图：`src/components/IssuesView.jsx`。
- 报告 Badge/Stat 通用组件：`src/components/ReportUi.jsx`。
- 样式：`src/styles.css`。
- 扫描历史保存在浏览器本地。
- 当前任务 ID 保存在浏览器本地，刷新页面后可以恢复。

### 后端

- Node HTTP 组合入口：`server/api.js`。
- Search Console 加密配置存储：`server/gsc-config-store.js`。
- OAuth 与 Google API 服务：`server/gsc-service.js`。
- 扫描器、诊断、任务存储和端点路由均为独立模块。
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

- `server/api.js` 已缩减为组合入口；`src/main.jsx` 仍承担较多跨视图状态和编排，下一轮模块化应优先继续拆分扫描、报告和历史工作区。
- 自动化测试已覆盖 OAuth state、GSC 服务、任务恢复、历史比较和主要纯逻辑；仍缺真实浏览器 OAuth 弹窗、扫描恢复和大型报告流程的端到端测试。
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

- [x] 通过 Search Console Sites API 列出用户可访问属性，减少手动输入 Property URL。
- [x] 增加 Search Analytics 等长上一周期对比，解释点击、展示、CTR、排名变化，并标识新增/丢失搜索可见性。
- 支持 Query、Country、Device、Page + Query 组合分析。
- 已识别排名良好但 CTR 偏低、展示增长但点击未增长，以及同一查询由多个页面竞争；更深的查询意图聚类仍待实现。
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

- [x] 将单页长界面调整为清晰的扫描、Google、问题、URL、历史和设置视图，并持久化当前视图。
- [x] URL 结果支持严重程度、问题类型、关键词、Sitemap/站内/GSC/Inspection 来源与历史变化状态筛选，并提供每页 50 条分页。
- [x] 加强版本比较：区分新增、修复、严重程度恶化、严重程度改善和持续存在，并显示逐 URL 变化证据。
- [x] 支持生成可独立打开的响应式 HTML 报告；PDF 作为后续可选导出。
- [x] 增加服务器端报告列表、搜索、状态筛选、分页、保留期限和删除确认。
- 评估问题备注、负责人和处理状态；在没有真实协作需求前不引入完整账号团队系统。

验收标准：

- 用户能在大型报告中快速定位高优先级问题，而不需要浏览全部页面。
- 两次扫描可以稳定比较，并区分网站变化与扫描配置变化。
- 导出的报告包含扫描范围、限制、时间、配置和证据来源。

### v1.0：生产加固

目标：达到可公开长期运行的安全、隐私和维护标准。

计划：

- 已建立版本化 Neon schema 迁移、迁移记录表、首批查询索引、只读 schema 状态检查和备份/恢复/回滚手册；更细的数据完整性约束仍待完成。
- 已完成 OAuth state 10 分钟有效期与一次性消费、OAuth 成功/断开后的 session 轮换，以及带 key ID 的 AES-GCM 令牌密钥平滑轮换；OAuth Client Secret 自身的运营轮换演练仍待完成。
- 已完成 CSP、安全响应头、HttpOnly/SameSite/Secure Cookie 策略、浏览器写请求同源防护、扫描请求的 SSRF/DNS rebinding 防护和 npm 依赖审计。
- 已按会话、IP 和高成本端点实施实例级限流与滥用保护；跨 Serverless 实例的共享限流可在后续接入持久存储。
- 数据保留、用户断开、令牌撤销、报告删除和隐私说明形成完整闭环。
- 已建立当前进程的请求错误率、Google API 失败率、任务完成率和扫描耗时指标；跨 Serverless 实例的长期指标汇聚仍待接入外部监控后端。
- 已完成主工作区、设置和 Google 配置空状态的键盘、焦点、对比度、屏幕阅读器及 320/390/1280px 可用性检查；带大型真实扫描报告的完整辅助技术回归仍需在后续浏览器流程测试中持续覆盖。

验收标准：

- 用户可以查看并删除服务端保存的数据，断开 Google 后令牌不可继续使用。
- 关键故障有日志、请求 ID 和可操作错误信息。
- 部署、迁移、只读 schema 检查、Neon 恢复和 Vercel 回滚步骤已有文档与自动化契约验证；生产事故恢复演练仍需按发布周期执行。

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
- 新增共享 `downloads.js`，统一 CSV 序列化和导出行为，并补充逗号、引号、换行等边界测试。
- Search Analytics 面板与机会洞察规则已拆出 `SearchAnalyticsPanel.jsx` 和 `search-analytics.js`，主入口继续瘦身。
- Search Console CSV 导入、分隔符识别与多语言表头解析已拆到 `gsc-csv.js`，并新增独立回归测试。
- GSC 页面机会分组和搜索可见性汇总规则已拆到 `gsc-summary.js`；CSV 导入面板迁移到 `SearchConsoleImport.jsx`。
- URL Inspection 的网址对照、收录原因、优先级、抓取时效和单网址诊断规则已拆到 `url-inspection-diagnostics.js`。
- URL 对照矩阵、收录覆盖优先级和重要页面抓取时效视图已迁移到 `UrlInspectionDiagnostics.jsx`；主入口由 3276 行降到 2715 行。
- 新增固定时间的 URL Inspection 回归测试，覆盖合理 canonical 排除、阻挡高优先级、抓取时效、未指定 fetch 状态和请求失败。
- 修复 GSC helper 拆分后报告与 Googlebot 视图缺少显式导入、只能在运行时暴露的风险。
- 新增 `server/http.js`，统一请求 ID、CORS/no-store 响应头、JSON body 限制、错误代码和结构化请求日志。
- 增加不创建会话 Cookie 的 `/api/health` 与 `/api/healthz` 稳定探活端点。
- API 错误在保留旧 `error` 字符串兼容性的同时增加 `code`、`requestId` 和 `retryable`；前端错误提示会附带可排查的请求编号。
- API 路由测试新增健康检查、请求 ID 透传、非法 JSON、413 请求体限制和任务 404 错误代码验证。
- Googlebot 公网 IP 过滤、可信主机名、反向/正向 DNS 复核、批处理和缓存已拆到 `server/googlebot-verifier.js`。
- 新增可注入 DNS resolver 的验证测试，覆盖真实匹配、伪装主机名、缓存命中、私网过滤和 URL 去重。
- 接入 Search Console Sites API，返回当前 OAuth 账号可访问的 property、权限等级和已验证数量。
- OAuth 连接后自动加载三语言 property 选择器；切换 property 会保存到当前浏览器会话配置，失败时回滚原选择。
- 保留首次 OAuth 前的手工 Property URL 输入和连接后列表刷新，Sites API 暂时失败不会阻断已保存 property 的使用。
- Search Analytics 新增默认开启的等长上一周期对比，同时返回当前与上一周期的日期范围和原始维度行。
- 前端显示点击、展示、CTR、平均排名变化，并诊断点击下降、展示增长但点击停滞、新增可见性和丢失可见性。
- 周期对比可导出包含日期、维度值、当前值、上一周期值和差值的 CSV；当前 Page 行仍独立进入现有 URL/GSC 诊断。
- 日期计算、汇总、维度行合并、新增/丢失状态、变化阈值和 API 请求参数已有自动化测试。
- Page + Query 诊断按查询聚合多个页面；当总展示和次要页面展示占比达到阈值时，报告关键词蚕食并列出主要竞争页面、展示和排名证据。
- 服务端 Search Analytics 日期校验、维度映射、Google 请求、响应标准化和上一周期编排已迁移到 `server/gsc-search-analytics.js`。
- 新服务通过依赖注入连接 OAuth 配置、fetch、URL 规范化和错误翻译，并覆盖行数上限、日期错误、Google API 错误及周期比较测试。
- 新增三语言工作区导航，将扫描概览、Google 数据、技术问题、URL 结果、历史任务和设置分开显示。
- 视图切换通过隐藏稳定容器实现，URL Inspection 等带内部状态的面板不会因切换而丢失结果；当前视图保存在 localStorage。
- URL 结果加入每页 50 条分页，筛选、问题类型或搜索变化时自动回到第一页；移动端导航使用可横向滚动的固定宽度按钮。
- URL 来源筛选统一使用 sitemap、站内链接、Search Analytics 与已完成 URL Inspection 集合，并显示各来源 URL 数量。
- 历史变化筛选逐 URL 对比 issue type 指纹，区分新增问题、持续问题、已改善、无变化和没有对比基线。
- URL CSV 导出跟随当前筛选条件并包含全部匹配 URL，不受当前分页限制；Summary 导出继续表示完整报告。
- 历史条目新增扫描配置快照；版本比较逐 URL/问题类型识别新增、修复、严重程度变化和持续问题。
- 配置比较覆盖内容/性能检查、站内发现、robots 来源、查询参数、尾斜杠、URL 与 sitemap 限制；旧历史缺少快照时明确显示不可用。
- 独立 HTML 报告包含扫描时间、输入、sitemap/robots、限制、检查配置、健康摘要、全部 URL 问题、Google 结果与已加载 GSC 页面指标。
- HTML 生成对网站内容和问题证据统一转义，外链只允许 HTTP/HTTPS，并排除 OAuth、session 和数据库配置。
- Retained Tasks API 支持任务 ID/网址搜索、状态筛选、页码与每页数量，并返回总数、页数、存储模式、保留秒数和逐任务过期时间。
- Neon 使用数据库 `COUNT + LIMIT/OFFSET` 完成真实分页；本地内存模式按现有 4 小时 TTL、Neon 按 7 天保留策略准确显示。
- 服务器任务删除增加三语言确认提示，删除成功后重新加载当前页，保持总数和分页一致。
- API 响应新增 CSP、frame、referrer、permissions 和同源 CORS 头；Vercel 静态入口增加 HSTS 与严格 React CSP。
- 浏览器 POST/DELETE 请求带有非同源 Origin 时返回 `ORIGIN_REJECTED`；无 Origin 的 CLI/内部请求保持兼容。
- 扫描创建/执行、URL Inspection、Search Analytics 与 Googlebot DNS 验证按会话和客户端 IP 限流，并返回标准 429、Retry-After 与配额响应头。
- 所有扫描 HTTP(S) 目标在每个重定向 hop 前重新解析 DNS；任一解析结果属于本机、私网、链路本地、保留或文档地址时即拒绝请求。
- 直连请求将 Undici dispatcher 锁定到已验证公网 IP，避免验证后 DNS 再解析造成 rebinding；IPv4、IPv6、IPv4-mapped IPv6 和混合公网/私网答案均有回归测试。
- 扫描代理默认禁用；只有受信任的本地部署显式设置 `SOOS_ALLOW_PROXY=1` 才能使用，此模式由代理承担最终 DNS 解析边界。
- Neon 表结构已从 `server/api.js` 拆到版本化迁移模块；配置存储、任务租约和对应索引由 `soos_schema_migration` 记录版本并以单事务逐版应用。
- 应用首次访问数据库时自动运行待执行迁移，部署前也可通过 `npm run db:migrate` 显式验证；迁移测试覆盖空库、部分版本和最新版本。
- 存储令牌升级为带非敏感 key ID 的 `enc:v2` AES-256-GCM 格式；当前主密钥写入新密文，`SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS` 支持逗号分隔的历史密钥。
- 旧 `enc:v1`、旧 key ID 或明文令牌在读取成功后自动使用当前主密钥重写；测试覆盖新密文、历史密钥、旧格式和错误密钥。
- OAuth state 采用常量时间比较、10 分钟有效期并在 token exchange 前消费；成功连接和断开连接均轮换 session，Neon OAuth 配置随成功连接迁移到新 session。
- API 生命周期测试使用独立临时配置文件，验证断开连接删除服务端凭据，即使未发生 Google 撤销也会返回未配置状态并替换 session cookie。
- 新增不记录 URL、Property、账号、token 或错误正文的进程级运行指标；`/api/metrics` 返回 HTTP 错误率、Google 服务调用失败率、任务终态和耗时分布摘要。
- Google 指标埋点位于真实外部 fetch 边界，区分 OAuth token、撤销、userinfo、Sites、Sitemaps、Search Analytics 和 URL Inspection，避免把输入校验错误计入 Google 故障。
- 后台任务与同步扫描均记录完成、失败、停止和耗时；指标注册表限制已跟踪任务 ID 数量，测试覆盖比率、去重和无 session cookie 的指标端点。
- 主界面新增三语言“跳到主要内容”链接、语言和扫描 URL 程序化标签、全局高对比焦点环，以及 reduced-motion 动画降级。
- 扫描进度使用原生 progressbar 语义；运行状态、Google 成功消息、导入结果和错误使用 status/alert live region；展开 URL 行与严重程度筛选暴露 expanded/pressed 状态。
- 修复移动端空状态因 grid 隐式行拉伸导致图标与说明分离的问题，并为窄屏 Google Property 与保留任务搜索补齐显式可访问名称。
- 新增 `tests/accessibility.test.js`，将三语言键、跳转目标、表单名称、进度语义、状态播报、焦点样式和 reduced-motion 纳入 `npm run check`。
- 浏览器实测 1280、390 和 320px：初始页、设置页、Google 页无页面级横向溢出或无名称可见控件，控件无小于 24px 的实际点击目标，对当前可见文字未发现 WCAG 阈值以下的对比度。
- 新增 `OPERATIONS.md`，覆盖发布前门禁、Neon 分支/时间点备份、forward-only 迁移、Vercel 发布、应用回滚、数据库恢复、OAuth/加密密钥事故和运行信号。
- 新增只读 `npm run db:status`，验证迁移 ledger、当前/最新版本、待执行版本和三张核心表；真实 Neon 已验证为 schema 2/2 ready。
- 新增 GitHub Actions CI，在 Node 22 上执行 `npm ci`、高等级依赖审计和完整 `npm run check`；运维文档及 CI 必需命令由自动化测试锁定。
- `npm audit` 发现 `concurrently@9.2.1` 经 `shell-quote` 引入 critical 命令注入风险；已升级到 `concurrently@10.0.3`，复核为 0 vulnerabilities。
- Vite、React plugin、TypeScript 和 concurrently 已移至 `devDependencies`，生产依赖树由 91 个缩减到 7 个；Undici 更新到同主版本最新补丁 7.27.2。
- 新增当前会话数据汇总与完整删除 API，统一删除 Neon GSC 配置、审计任务、报告、页面 checkpoint 和 worker lease；本地模式同步删除 `.soos-gsc.json`。
- 完整删除会尝试撤销 Google token、停用旧 session ID、轮换 Cookie，并以任务 tombstone 防止仍在执行的 worker 将已删除任务重新写回。
- 设置页新增三语言“隐私与数据”面板，显示服务端与浏览器数据数量；确认删除后清除 soos localStorage、扫描结果、历史、任务状态及所有 Google 子面板内存结果。
- 会话隔离测试验证删除不会影响其他浏览器会话；新增 `PRIVACY.md` 记录数据类型、90 天/7 天保留策略、日志导入边界和删除语义。
- React 根实例在 Vite 热更新间复用，避免开发环境重复调用 `createRoot()` 的警告。
- 新增 `server/routes/system-routes.js`、`session-data-routes.js` 和 `audit-job-routes.js`，拆出健康/指标、当前会话数据以及审计任务列表、创建、执行、控制和删除端点。
- `server/api.js` 保留请求日志、安全校验、session、限流和领域服务装配职责，路由模块通过显式依赖注入调用现有服务，避免引入循环依赖。
- 新增独立服务端路由测试，覆盖无 Cookie 健康检查、指标快照、删除确认、Neon 存储模式、任务查询参数、创建和暂停/恢复；原 API 生命周期测试继续验证外部契约。
- 新增 `server/routes/gsc-routes.js`，集中 Search Console 状态、配置、断开、OAuth start/callback、连接测试、Sites、Search Analytics、Sitemaps 和 URL Inspection 端点。
- OAuth 路由测试验证 state 在 token exchange 前消费、成功后 session 轮换、旧 Neon 配置删除、Google 账号信息写入，以及错误页面 HTML 转义。
- `server/api.js` 进一步缩减到约 3,400 行；GSC token 刷新、OAuth state、加密存储和 Google 请求仍由既有领域服务负责。
- 新增 `server/audit-job-store.js`，封装内存任务、Neon 报告、页面 checkpoint 批次、worker lease、过期 worker 恢复、session retirement 和删除 tombstone。
- 主 API 不再直接持有任务 Map、持久化 timer、活动 worker 集合或已删除任务集合；扫描和路由通过 store 方法操作统一生命周期。
- 新增 `server/scan-parsers.js`，拆出网站/sitemap/robots 输入判断、XML loc 解析、robots 分组与规则胜出、canonical/meta/hreflang/noindex 和站内链接提取。
- 新增任务 store 与扫描解析器回归测试，并纳入 `npm run check`；`server/api.js` 进一步缩减到约 2,960 行。
- 修正任务终态持久化调度：done、error、stopped 和 interrupted 会替换已有延迟 timer 并立即安排写入。
- 结构化数据规则和 `inspectJsonLd` 已迁移到 `server/structured-data.js`，原有 72 条诊断回归直接验证新模块。
- 新增 `server/scan-fetch.js`，封装超时、手工重定向、每跳公网 DNS 复核、DNS pinned dispatcher 和资源关闭；模拟网络测试覆盖跨主机跳转、循环和代理 dispatcher。
- 新增 `server/scan-diagnostics.js`，封装 robots/sitemap/hreflang 聚合、Google 原因、修复 backlog、健康分、状态标签和重复元数据诊断。
- 新增 `server/scan-runner.js`，完整承载 sitemap 递归、页面检查、内部发现、批次 checkpoint、暂停/停止、进度和最终报告组装。
- 修复 robots 决策返回证据不完整的问题：现在返回请求 path 与按优先级排列的 matched rules，阻挡详情不再因字段缺失而运行时失败。
- 扫描 runner 测试覆盖 robots、sitemap、页面内容、JSON-LD、canonical、checkpoint、progress、报告状态和代理禁用策略。
- `server/api.js` 从本阶段开始时的 3,637 行降到 958 行，已不再承载扫描器、解析器、结构化规则、报告诊断或任务存储领域实现。
- 新增 `server/gsc-config-store.js`，统一 `.env`/进程环境读取、Neon/本地文件选择、token 加密解密、历史密钥轮换和 session 配置清理。
- 新增 `server/gsc-service.js`，承载 OAuth URL、token exchange/refresh/revoke、Google 账号信息、Sites、Sitemaps、Search Analytics、URL Inspection、状态脱敏和错误翻译。
- GSC 配置与服务测试覆盖密文存储、敏感字段剔除、环境 access token fallback、OAuth 参数、过期 token 自动刷新并持久化、属性访问和响应脱敏。
- `server/api.js` 进一步缩减到约 440 行，只保留数据库初始化、session、安全/限流、审计任务执行和路由依赖装配。
- 新增 `src/history.js`，统一浏览器历史读取/保存、保留数量、历史快照、趋势标签、issue fingerprint 差异和诊断分类变化。
- 新增 `src/components/HistoryPanels.jsx`，迁出历史列表、Neon 保留任务和版本比较三个视图；`main.jsx` 只传入状态与操作回调。
- 历史模块测试覆盖损坏 localStorage、非法保留数量、确定性快照、严重程度升降、问题解决和分类变化；`main.jsx` 从 2,914 行缩减到约 2,475 行。
- 新增 `src/components/UrlFindingsPanel.jsx`，迁出 URL 行展开证据、严重程度/来源/变化筛选、搜索、50 条分页和按当前结果导出。
- 保留问题面板到 URL 列表的受控 issue type 联动；`report-filters.js` 新增可测试的分页边界，组件契约测试覆盖可访问状态和过滤导出。
- `main.jsx` 进一步缩减到约 2,217 行；桌面浏览器验证网址视图可切换，无白屏、控制台错误、可见 alert 或页面级横向溢出。
- 新增 `ScanSummaryView` 与 `IssuesView`，迁出健康分、执行摘要、输入/上限状态、修复 backlog、robots 规则证据、sitemap 和 hreflang 影响卡片。
- `ReportUi` 统一 Badge/Stat，供 Google、URL、日志、链接图及新视图复用；`report-views.js` 固化健康分档和 robots 影响 issue type 映射。
- 摘要/Issues 组件契约和纯逻辑测试已纳入 `npm run check`；`main.jsx` 进一步缩减到约 1,834 行。
- 新增 `UrlStructureView`，迁出 sitemap URL 清单、递归站内发现和内部链接图的筛选、统计及导出界面。
- `link-graph.js` 新增可独立测试的 CSV 行构建器；组件契约和导出回归测试已纳入 `npm run check`。
- `main.jsx` 进一步缩减到约 1,705 行，报告的摘要、问题、网址和 URL 结构视图均已脱离主文件。

## 12. 历史完成度基线

| 模块 | 完成度 |
| --- | ---: |
| Sitemap 技术检查 | 90% |
| robots.txt 诊断 | 80% |
| Canonical 与 hreflang | 75% |
| 后台与 Serverless 执行 | 85% |
| Search Console OAuth | 90% |
| Search Analytics 诊断 | 80% |
| URL Inspection 诊断 | 95% |
| Google URL 对照矩阵 | 85% |
| URL 集合对比 | 100% |
| 结构化数据验证 | 100% |
| Googlebot 日志分析 | 100% |
| 任务与报告管理 | 100% |
| 版本回归对比 | 100% |
| 定时监控 | 已停用 |

每次里程碑范围变化、开始实现、测试通过或功能完成时，都必须更新本文件。
