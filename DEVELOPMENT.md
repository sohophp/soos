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

## 7. 开发路线图

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

状态：计划中

- [ ] 导入 Nginx、Apache、Cloudflare 和 Vercel 日志。
- [ ] 验证真实 Googlebot 请求。
- [ ] 对比 Googlebot 抓取 URL 和 sitemap URL。
- [ ] 发现抓取浪费、长期未抓取的重要页面和重复服务器错误。

### Milestone F：运营能力

状态：计划中

- [ ] Neon 最近任务列表。
- [ ] 恢复、删除和查看保留任务。
- [ ] 定时重复扫描。
- [ ] 版本变化对比和回归提醒。

## 8. 实施记录

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

## 9. 当前完成度

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
| Googlebot 日志分析 | 0% |
| 定时监控 | 0% |

每次里程碑范围变化、开始实现、测试通过或功能完成时，都必须更新本文件。
