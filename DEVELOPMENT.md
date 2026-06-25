# soos 开发文档

## 当前批次：Phase 1 产品审计与 Issue 模型收敛

- 已完成：创建 `docs/product-audit-2026-06.md`，记录当前能力、UI 噪音、诊断可信度缺口、产品闭环缺口、本次范围与明确不做范围。
- 已完成：新增统一 Issue 数据层，将扫描、Google Inspection 和 Search Analytics 机会归一为 Issue -> Evidence -> Fix -> Verify 结构，并区分 confirmed / likely / inferred。
- 已完成：将统一 Issue 数据层接入 Issues 工作区，显示可执行 Fix Plan、证据、影响、修复步骤、验证步骤、可信度和 URL 筛选入口。
- 已完成：为 Fix Plan 增加独立 CSV 导出，方便把优先修复事项、证据、修复步骤和验证步骤直接交给执行人员。
- 已完成：为 Fix Plan 增加本地 issue 决策状态，可将优先事项标记为已解决或已忽略，且不修改原始扫描报告。
- 已完成：将 Report Coverage 接入扫描摘要页，显示证据强度、已覆盖数据源、URL Inspection 样本边界和不能据此下结论的事项。
- 已完成：新增 priority scoring、fix instruction 和 report coverage 纯函数，明确高优先级诊断、修复步骤、验证步骤与报告不能下的结论。
- 已验收：新增 issue model 与 report coverage 测试，并接入 `npm run check`。
- 本批取舍：不重构大 UI、不新增 Google 权限、不做 sitemap 写操作、不实现内容生成、自动改站或定时监控；Overview/Fix Plan/Issues/URLs/Google UI 收口进入后续 Phase。

## 当前批次：SEO 修复建议收口

- 已完成：补齐修复 backlog 中缺失的 canonical target 未进入 sitemap、hreflang 缺少回链，以及 hreflang 目标 canonical 不一致行动项。
- 已完成：补齐页面级扫描 issue 到修复 backlog 的建议覆盖，包括 non-HTML sitemap URL、canonical 多声明、无效 hreflang、标题/描述长度、多个 H1、HTML lang、结构化数据验证/推荐字段和轻量性能信号。
- 已验收：新增 `scan-diagnostics` 回归断言与源码覆盖守门，确保扫描器产生的页面级 issue 能同步进入可执行优化建议。
- 本批取舍：继续暂缓 GSC sitemap 提交/删除、渲染后批量检查和跨实例共享限流；这些要么扩大 OAuth 权限，要么偏平台能力，不作为当前 SEO 优化建议主线。

## 当前批次：PageSpeed Insights 完善

- 已完成：服务端输出 SEO 失败项、性能诊断、运行上下文、重定向及 Core Web Vitals 判定。
- 已完成：前端合并重复真实用户数据，展示 CWV 结论、运行警告、SEO 问题、性能诊断和优化机会。
- 已完成：English、简体中文、繁體中文文案与响应式样式。
- 已完成：CrUX API 未启用时提供项目专属启用入口、等待说明和重试操作，不影响 PageSpeed 结果。
- 已验收：`npm run check`、14 个桌面/移动 Playwright 流程、生产构建、依赖审计和差异检查全部通过。

## 当前批次：Google Sitemap 数据源准确性

- 已完成：站点和 robots URL 输入优先使用 `robots.txt` 声明的有效 Sitemap。
- 已完成：扫描并保存多个 Sitemap 入口到 `report.input.sitemapUrls`。
- 已完成：Google Sitemap 面板精确对照当前检查实际使用的全部 Sitemap。
- 已验收：专项测试、`npm run check`、12 个 Playwright 流程、依赖审计和差异检查均通过。

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
| 产品体验与信息架构 | 三语言工作区、扫描控制、进度、历史、导出、Runtime、错误边界 | 已模块化 | 工作区已有标准 tab 语义与方向键导航；大型真实报告的移动端/辅助技术复核仍需持续 |
| 抓取与技术 SEO | sitemap、robots、canonical、hreflang、递归发现、链接图、URL 变体、JSON-LD | 核心完整 | 已显示原始 HTML 数据边界；支持 HTML/HTTP canonical 声明证据和 hreflang 重复、自引用、回链诊断 |
| Google 数据 | OAuth、属性选择、日期对比、多维分析、URL Inspection、Sitemaps、覆盖诊断 | 核心完整 | Inspection 配额与历史优先级已完善；Page + Query 已支持品牌、地域、导航、信息和主题意图聚类 |
| 报告与回归 | 多工作区、统一筛选、分页、HTML/CSV、Neon 保存、URL 级版本比较 | 已完成主闭环 | URL findings、站内发现、链接图、Google URL 差异、结构化数据、Googlebot 日志、Inspection 结果、对照矩阵、抓取新鲜度和覆盖原因分组均已有分页 |
| 平台与安全 | Vercel、Neon 迁移、OAuth 会话、加密轮换、限流、指标、SSRF 防护 | 已生产加固 | 跨实例共享限流和长期指标汇聚需要外部基础设施 |
| 工程质量 | 完整 `npm run check`、API/领域/契约测试、Playwright desktop/mobile E2E、CI | 稳定 | 真实 Google 授权页仍依赖发布前人工验证；仓库内 OAuth 弹窗闭环、断点恢复和大型报告已有自动化覆盖 |

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

- `server/api.js` 与 `src/main.jsx` 已缩减为组合入口，新的领域逻辑必须继续进入独立 service、hook、helper 或组件。
- 自动化测试已覆盖 OAuth state、GSC 服务、OAuth 弹窗完成通知与断开、任务恢复、历史比较、大型报告和主要纯逻辑；Google 托管授权页及账号选择仍按发布清单人工验证。
- 多语言资源已有键一致性、乱码、关键标签本地化和常见简繁串用自动检查；真实数据下的逐屏语气与窄屏文案仍需持续人工复核。
- API 错误格式已统一并带 request ID/retryable 信息；少数面板的 loading、empty 和 retry 文案仍可继续统一。

### P1：影响诊断可信度

- 站内 URL 已支持有界递归发现与链接图，但仍受深度、URL 预算和原始 HTML 可见内容限制，不等同于浏览器渲染后的全站爬虫。
- JavaScript 渲染后的内容不一定能被轻量 HTTP 抓取看到；扫描设置已明确原始 HTML 数据边界，后续渲染检查必须保持独立结果层。
- URL 抓取身份与对比身份已分离；参数排序、跟踪参数、尾斜杠、大小写、默认文档和重定向链已有统一诊断策略。
- robots 的用户代理优先级、Allow/Disallow 同等长度、通配符，以及 meta/响应头 noindex、状态码和 content-type 已有关键边界测试。
- canonical 已保留 HTML 与 HTTP `Link` 头的逐项证据，并诊断无效、多声明、冲突和跨来源不一致；hreflang 已覆盖重复语言、目标复用、自引用、回链和目标 canonical。
- URL Inspection 有配额限制，不能默认对大型 sitemap 的全部 URL 执行检查。

### P1：影响生产可靠性

- 已有请求 ID、结构化日志、稳定健康检查和隐私最小化运行指标；跨实例长期汇聚仍需外部监控后端。
- 扫描、DNS 验证、日志导入、请求体和高成本 Google API 已有限制与实例级速率限制；共享限流需外部持久层。
- Neon 已有版本化 schema、迁移 ledger、字段/键形状约束、会话与任务索引、完整性计数、状态检查和恢复文档。
- OAuth/session/令牌加密密钥已有轮换与失效策略；正式生产演练需按发布周期执行。

## 9. 全站路线图

### v0.3：稳定性与模块化

目标：让现有功能更容易维护、测试和定位故障，不继续扩大两个主文件。

计划：

- [x] 拆分前端语言资源、API 客户端、扫描状态、GSC 状态、报告视图和历史任务模块。
- [x] 拆分服务端路由、Google OAuth/GSC 服务、扫描器、任务存储和数据库迁移层。
- [x] 统一 API 错误结构、请求 ID、retryable 信息和前端格式化。
- [x] 增加 API 集成测试、领域回归测试和本地浏览器烟雾验证。
- [x] 加入 React 错误边界，避免单个面板异常导致整页白屏。
- [x] 完成 English、简体中文、繁體中文逐屏校对。
- [x] 加入结构化日志、请求 ID、健康检查和基础运行指标。
- [x] 为 API body、URL 数量、日志文件、DNS 验证和高成本端点设置限制。

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
- [x] 接入按需 PageSpeed Insights：用户自备 API key 仅保存在浏览器会话中，每次只测试一个已扫描 URL；Lighthouse 实验室数据、PSI 返回的历史真实用户数据和 soos 轻量 HTML 性能信号分层显示。
- [x] 接入独立 CrUX API：复用会话级用户 API key，按需查询页级与来源级 28 天真实用户聚合数据，展示采集区间、p75、Core Web Vitals 分级和明确回退；Google 已宣布停止提供的 PSI CrUX 字段只保留为旧接口对照。
- 渲染后页面批量检查仍作为后续可选能力。

验收标准：

- 报告能解释 sitemap 与实际站内发现 URL 不一致的原因。
- 每个未收录或不可索引 URL 都能显示证据链：来源、状态码、robots、meta、canonical 和 Google 状态。
- 大站点抓取在预算耗尽后可恢复，且不会重复处理已完成 URL。

### v0.5：Search Console 洞察

目标：把 Google 数据从单独表格变成可执行的页面级诊断。

计划：

- [x] 通过 Search Console Sites API 列出用户可访问属性，减少手动输入 Property URL。
- [x] 增加 Search Analytics 等长上一周期对比，解释点击、展示、CTR、排名变化，并标识新增/丢失搜索可见性。
- [x] 支持 Query、Country、Device、Page + Query 组合分析。
- 已识别排名良好但 CTR 偏低、展示增长但点击未增长，并按标准化近似查询识别页面竞争。
- Page + Query 已区分品牌、地域、导航、信息和一般主题意图；品牌与导航查询采用更严格阈值并降低严重程度，以减少误报。
- [x] Page + Query 支持按 Property 保存自定义品牌词、地区词和聚类排除词；配置仅保存在浏览器，排除词不删除原始 Google 数据。
- [x] URL Inspection 异常并集优先队列覆盖历史严重度恶化、新增问题、新页面、本地技术阻挡、跳转/canonical 异常、GSC 非 sitemap 页面和站内发现非 sitemap URL。
- [x] 显示 API 配额说明、候选/已检查/剩余数量、预计批次、下一批数量，以及未连接 GSC、缺少 GSC 页面、未启用站内发现或扫描截断等范围原因。
- 已接入 GSC Sitemaps API，展示 Google 看到的 sitemap、提交时间、最后读取、待处理状态、错误和警告；下一步可加入提交与删除操作。
- Google 工作区已按连接状态收口：未连接时只提供 OAuth 与 CSV fallback；连接后隐藏 CSV 和日常无用的测试/刷新按钮，自动加载当前 Property 的 Sitemap 状态，并在 Property 切换、断开或 Analytics 重载失败时清除旧 Analytics 与 Inspection 数据。
- Sitemap 对照使用专用精确 URL 规范化，只忽略 fragment、默认端口和主机大小写；协议、路径大小写、尾斜杠及 query 保持有意义，异步旧 Property 响应不会覆盖当前结果。

验收标准：

- 用户无需记忆 property 格式即可选择自己有权限的站点。
- 每条 Google 诊断都能追溯到日期范围、维度、URL 和原始状态。
- 大站点不会因 URL Inspection 配额而无提示地得到不完整结论。

### v0.6：报告体验与持续诊断

目标：让报告更适合重复使用、筛选、比较和交付。

计划：

- [x] 将单页长界面调整为清晰的扫描、Google、问题、URL、历史和设置视图，并持久化当前视图。
- [x] URL 结果支持严重程度、问题类型、关键词、Sitemap/站内/GSC/Inspection 来源与历史变化状态筛选，并提供每页 50 条分页。
- [x] 报告筛选、分页和展开详情具备可访问名称、实时状态播报及控件关系；宽 URL 对照表提供表格语义、行索引和键盘横向滚动焦点。
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

- [x] 已建立版本化 Neon schema 迁移、迁移记录表、任务/批次/租约完整性约束、会话与状态查询索引、只读 schema/违规计数检查和备份/恢复/回滚手册。
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

下一批次从语言质量与 Search Console 洞察继续，顺序为：

1. 空状态下的三语言六个工作区视图已完成逐屏校对；继续真实数据下的报告文案、移动端、键盘、焦点和大型报告性能复核。
2. [x] 完成可解释的默认阈值基线：按日期跨度缩放样本门槛、过滤小样本周期变化，并用排名段 CTR 基准与 90% Wilson 上界确认低点击率；品牌词、地区词和排除词仍可按 Property 自定义。
3. [x] 建立真实浏览器流程测试环境，覆盖任务刷新恢复、报告持久化、大型报告分页、移动端溢出和控制台错误。

Search Console sitemap 提交/删除暂缓：当前 OAuth 坚持 `webmasters.readonly` 最小权限。启用写操作需要改用 `webmasters` scope、要求现有用户重新授权，并改变当前“只查看数据”的权限承诺；除非产品明确加入独立的可选写权限连接，否则不扩大默认授权。

每一批改动都必须更新本文件的状态、`CHANGELOG.md` 和相关 `README.md` 内容，并运行 `npm run check`。

2026-06-13：完成 English、简体中文和繁體中文在扫描、Google、问题、网址、历史及设置空状态下的逐屏浏览器校对；三种语言均无页面级横向溢出或控制台警告。语言回归测试现覆盖全部当前资源包、递归键一致性、常见乱码、简繁混用和本地调试网址泄漏。带真实扫描数据的报告文案与大型结果性能仍需继续验证。

2026-06-13：独立接入 Chrome UX Report API。性能面板可在同一次用户操作中选择加载 CrUX，页级无样本时才使用来源级数据；PageSpeed 主请求与 CrUX 局部错误相互隔离。服务端限制请求体和每会话/IP 频率，API key 与结果均不持久化。

2026-06-13：新增 Playwright desktop/mobile E2E 环境。测试使用固定 `5174` Vite 服务和浏览器层本地 API 拦截，不访问外部站点；覆盖刷新时恢复活动任务、终态后清除 checkpoint、再次刷新保留报告、125 URL 报告的 50 条分页、English/简中/繁中真实报告切换、PageSpeed/CrUX 文案、工作区键盘导航及页面级横向溢出。CI 独立安装 Chromium 并执行 `npm run test:e2e`。

2026-06-13：补齐 Search Console OAuth desktop/mobile 浏览器闭环测试。测试通过浏览器上下文拦截模拟同源 callback，验证 popup 的 `postMessage`/storage 完成通知、自动关闭后的主窗口状态刷新、连接账号展示、属性加载和断开连接恢复，且不使用真实 Google 凭据；同时为双通道通知与关闭轮询增加短时去重，避免重复刷新覆盖成功提示。

2026-06-14：完成 Google 工作区首版 UX 收口。未连接时仅显示连接面板和 CSV fallback；连接后显示紧凑账号/Property/断开摘要、自动 Property-scoped Sitemap 状态和手动 Search Analytics。Property 切换会清除旧 GSC/Inspection 数据，Sitemap 精确匹配保留协议、路径大小写、尾斜杠和 query，并通过 desktop/mobile Playwright 验证快速切换竞态不会回写旧结果。

2026-06-13：依赖审计发现 Vite 6 的 esbuild 链存在高危公告后，受控升级到 Vite 8 与 `@vitejs/plugin-react` 6，并将 Node.js 最低要求调整为 `^20.19.0 || >=22.12.0`。升级后 `npm audit --audit-level=high` 为 0 漏洞。

2026-06-13：Neon schema 升级到 v4。v3 加入配置 JSON、key、迁移名和租约完整性约束及任务查询索引；v4 使用精确正则和 key/value 一致性收紧任务、批次与租约结构，并修正 SQL `LIKE` 下划线通配语义。`db:status` 现在同时检查 7 个已验证约束、6 个索引和 7 类违规计数；当前开发 Neon 已验证为 4/4 ready，所有违规计数为 0。

2026-06-13：Search Analytics 机会阈值改为按所选日期跨度缩放。低 CTR 不再仅凭固定 100 展示和点估计触发，而是按排名 1–3、4–10、11–20 使用保守基准，并要求 90% Wilson 上界仍低于基准；周期点击、CTR 和排名回退加入绝对样本保护。诊断卡片与关键词机会 CSV 保留日期天数、最低展示门槛、CTR 基准、置信上界和第二页面占比等证据。

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
- 新增只读 `npm run db:status`，验证迁移 ledger、当前/最新版本、三张核心表、约束、索引和数据完整性；当前开发 Neon 已验证为 schema 4/4 ready。
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
- 新增 `ScanRuntimePanel`，迁出扫描进度条、暂停/继续/停止控制和 Runtime 运行详情；原有 class、ARIA 与调用契约保持不变。
- `scan-runtime.js` 统一进度值夹取、开始时间防御性格式化以及阶段/总耗时显示，边界测试与可访问性测试已纳入 `npm run check`。
- `main.jsx` 进一步缩减到约 1,627 行；扫描执行状态仍由 `App` 编排，展示逻辑已不再驻留入口文件。
- 新增 `google-url-sets.js` 与 `GoogleUrlSetComparison`，迁出 Sitemap、站内链接、GSC、Inspection 差集、孤立 URL、URL 变体分类和 CSV 构建。
- 新增 `structured-data-diagnostics.js` 与 `StructuredDataDiagnostics`，迁出本地 Schema 汇总、Google Rich Results 问题解析、类型覆盖率、筛选和 CSV 构建。
- Google 诊断测试覆盖差集来源、变体冲突严重度、Rich Results 解析、Schema 汇总/覆盖和导出契约；`main.jsx` 进一步缩减到约 1,279 行。
- 新增独立 `UrlInspectionPanel` 与 `url-inspection-view.js`，迁出 Inspection 队列、每批 25 条、结果合并、本地化诊断和严重度汇总。
- 新增独立 `GooglebotLogAnalysis` 与 `googlebot-diagnostics.js`，迁出日志导入、DNS 验证调用、真实/伪爬虫分组、抓取浪费、缺失抓取和 CSV 构建。
- 回归测试覆盖 5xx、非 sitemap、参数、静态资源、robots、未验证请求和高展示但未抓取 URL；同时修复无预计算 `key` 的 GSC 行在去重后无法参与 URL 匹配的问题。
- `main.jsx` 进一步缩减到约 898 行，Google 工作区的 URL Inspection、结构化数据、URL 集合和日志分析均已脱离入口文件。
- 新增 `GoogleOverview`，迁出 Search Visibility 和 GSC Opportunities 的展示与三语言文案选择。
- 新增 `report-exports.js`，集中审计 CSV 行、GSC 页面分类、文本摘要、独立 HTML 和文件命名/下载；筛选后的 URL 导出不会混入 GSC-only 页面。
- 导出回归测试覆盖多问题 URL、无 key GSC 行、技术阻挡/低排名/低 CTR 分类、全部摘要证据段和组件装配。
- `main.jsx` 进一步缩减到约 602 行，只保留 `Report`/`App` 状态、生命周期和页面级视图编排。
- 新增 `useAuditRunner`，统一任务创建、活动任务恢复、分批轮询、租约等待、暂停/继续/停止、Runtime 状态和终态报告交付。
- 新增 `useRetainedJobs`，统一 Neon 保留任务的首次加载、搜索、状态筛选、分页、报告打开、删除和隐私重置。
- `audit-runner-state.js` 与 `retained-jobs-state.js` 将任务状态转换和 API 元数据规范化变成纯函数；测试覆盖 done/stopped/error、延迟轮询和分页边界。
- `main.jsx` 进一步缩减到约 434 行，只保留顶层表单、报告、历史、Google 工作区和设置视图编排。
- 新增 `useScanSettings` 与 `scan-settings.js`，集中扫描输入、检查开关、URL 比较策略、robots 来源和稳定的 API request options。
- 新增 `ScanSetupPanels.jsx`，迁出扫描表单、Runtime 控制、设置开关、URL 策略和隐私数据面板；历史重新检查与隐私清理共用同一配置状态。
- 扫描设置测试覆盖默认请求、全部开关、robots 来源、参数/尾斜杠策略及组件装配，并已加入 `npm run check`。
- `main.jsx` 进一步缩减到约 331 行，目前主要负责跨模块状态、工作区导航以及 Google/历史视图装配。
- 新增 `useGscWorkspace`，集中 Search Console 状态初始化、Property URL、Search Analytics/CSV 行和隐私删除后的子面板重置。
- 新增 `useReportHistory`，集中当前报告、浏览器历史、保留数量、比较基线和完成报告持久化。
- 新增 `GoogleWorkspace`、`HistoryWorkspace` 与 `WorkspaceReport`，迁出 Google 控制区、Neon/浏览器历史操作以及报告各视图装配。
- 工作区状态契约测试验证入口不再直接依赖 GSC API、历史持久化或报告领域组件，并已加入 `npm run check`。
- `main.jsx` 进一步缩减到约 174 行，只保留语言、导航、错误提示和跨模块生命周期协调。
- URL Inspection 队列新增纯配额摘要：按候选 key 去重计算已检查、剩余、总批次、剩余批次与下一批数量。
- 三语言界面明确显示 Google property 级配额说明，以及未连接、缺 Property、未加载 GSC 页面、未启用递归发现、扫描截断和无候选等范围/跳过原因。
- 新保存的浏览器历史加入最多 10,000 个 sitemap 页面 URL 快照，用于可靠识别对比版本后新增的页面；旧历史不猜测缺失的干净页面。
- URL Inspection 在选择历史对比后按“严重度恶化、新增问题、新页面、当前技术阻挡”的顺序提升优先级，并在候选行显示历史来源与原因。

## 12. 历史完成度基线

| 模块 | 完成度 |
| --- | ---: |
| Sitemap 技术检查 | 90% |
| robots.txt 诊断 | 80% |
| Canonical 与 hreflang | 75% |
| 后台与 Serverless 执行 | 85% |
| Search Console OAuth | 100% |
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
