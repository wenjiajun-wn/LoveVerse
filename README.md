# LoveVerse · 恋爱宇宙 / Love Memory V2 / Love Agent V3

情侣纪念网站，包含浪漫星空、可点击回忆星球、瀑布流相册、时间轴、纪念日和三个可玩的小游戏。所有故事和人物为演示内容。

V2 在原界面上增加“恋爱日记”：Markdown 私人回忆 CRUD、安全预览、多照片管理、组合搜索、星球分页、私人纪念日同步和确认导入。公开演示模式与私人模式由服务端配置隔离。

V3 新增「AI 回忆助手」：DeepSeek 驱动的只读检索、原文事实、单独标注的总结/推断和可点击来源。无新增运行依赖，AI 故障或关闭不会影响 V1/V2。

## V3 云端 AI 配置

**无需账号的公开 AI 演示：**管理员可使用以下配置。此入口仅使用 `src/data/demo.ts` 的既有公开故事，不能读取私人 Markdown、照片或私人 API；访客在页面同意发送问题后即可提问。

```dotenv
LOVEVERSE_MODE=demo
LOVEVERSE_ORIGIN=http://localhost:3000
LOVEVERSE_AI_ENABLED=true
LOVEVERSE_AI_PUBLIC_DEMO=true
DEEPSEEK_API_KEY=填写你自己的服务端密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

`LOVEVERSE_AI_PUBLIC_DEMO` 默认 false，关闭后公开页仅显示介绍。公开接口复用引用校验和工具上限，全站共享每小时 6 次、每日 30 次持久化额度，失败计入。费用由站点管理员承担，访客可能耗尽全站额度。不要在问题中输入私人资料；聊天不保存到服务器。部署固定域名时将 LOVEVERSE_ORIGIN 改为其 HTTPS origin。私人模式始终禁用此公开 AI 接口。

**以后启用私人账号：**

先按下文建立私人环境和两个独立成员账号。在服务器 `.env.local` 中添加（不要提交 Git，不要使用 NEXT_PUBLIC_ 前缀）：

```dotenv
LOVEVERSE_AI_ENABLED=true
DEEPSEEK_API_KEY=填写你自己的服务端密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

重启应用，双方分别登录「AI 回忆助手」，阅读云端传输告知、勾选允许发送的回忆并确认。只有双方都选中的当前版本才能用于 AI；修改回忆后需重新授权。默认没有回忆可外发，不发送图片。账号或密码变更会使旧许可失效。

每次问题独立检索，不回传聊天历史；问题与选中回忆的有限文字会发送到 DeepSeek。任一方可撤销同意，也可将 LOVEVERSE_AI_ENABLED=false 后重启停用。撤销不能收回已经发给提供方的内容。聊天只在当前页面，支持清除和导出，离开页面后清空。

AI 功能每空间每小时最多 6 次、每日最多 30 次；每次最多两轮只读工具、三次模型调用，失败也计数。费用由你的 DeepSeek 账户承担，建议设置账户预算。来源经服务器核验，事实逐字引用；总结和推断仍可能出错，请核对原文。当前采用非流式响应，不展示内部推理。

运行 `npm run test:agent-bundle` 检查客户端密钥边界。详细设计与验证边界见 [V3 架构](docs/love-agent-architecture.md) 和 [V3 测试记录](docs/love-agent-test-plan.md)。自动化测试使用 Mock；真实连接检查只使用公开或虚构内容，不发送私人回忆。

生产服务运行期间不要直接覆盖 `.next`：先停服务、运行 build，再启动新版本，避免旧页面引用已删除 CSS/JS。开发时用 `npm run dev`；不要与生产构建同时操作同一目录。

## V2 私人模式（单独部署）

默认 `LOVEVERSE_MODE=demo`，无需账号可查看演示，私人 API 关闭。**不要在公开演示进程中加载真实数据**；私人使用单独的 Node 进程、域名与持久化目录。

1. 首次设置时创建 `.env.local`（不要覆盖已有配置），内容为：

```dotenv
LOVEVERSE_MODE=private
LOVEVERSE_ORIGIN=http://localhost:3000
# 可选独立磁盘路径，默认项目根目录的 private/
# LOVEVERSE_DATA_DIR=D:/LoveVerseData
```

2. 在服务器交互终端运行：

```powershell
npm ci
npm run private:setup
```

依提示输入双方邮箱，第二位可暂时跳过。命令生成随机密码，只在终端显示一次；存入密码管理器，不要上传终端截图或日志。服务端只存 scrypt 哈希。已存在账号时命令拒绝覆盖。

3. 启动：

```powershell
npm run dev
```

访问配置中**完全一致的地址**（localhost 和 127.0.0.1 不可混用）；登录后打开“恋爱日记”创建回忆。生产运行使用 `npm run build` 然后 `npm run start -- --hostname 127.0.0.1`。远程 origin 必须使用 HTTPS。

- 回忆编辑支持标题、日期、分类、地点、标签、颜色、Markdown 正文、照片和实时预览。删除必须确认；编辑冲突返回错误，不覆盖另一设备的新内容。
- 照片仅存私人目录，上传时实际解码并去除 EXIF，支持 JPEG/PNG/WebP，8MB、1600 万像素以内。取消编辑后已上传照片保留在私人照片库，可再次使用或确认删除；引用中的照片禁止删除。
- 搜索支持全文关键词、日期范围、地点、分类、标签；点击结果打开原有详情弹窗。
- 星图每组 6 颗，更多回忆通过上一组/下一组查看。照片墙与时间轴自动使用动态数据。
- 私人纪念日存到服务器，另一设备打开页面或重新聚焦后同步；有旧版 localStorage 时显示导入按钮，经再次确认才上传。每账号仅导入一次、按内容去重，原浏览器数据不会删除。
- V1 的相处起始日期和演示小游戏题库仍在 demo.ts，当前未新增情侣档案编辑器；不要把真实私人资料改进准备公开提交的 demo.ts。
- 当前为单租户、最多两位成员共同读写的空间。未提供公众注册、密码找回邮件、MFA、实时推送、多副本或 Serverless 存储。

完整规格见 [V2 计划](docs/V2-PLAN.md)，Markdown 示例、API、认证边界、备份恢复和下一阶段工具接口见 [V2 架构](docs/V2-ARCHITECTURE.md)。

## 本地运行

要求 Node.js 22 LTS 与 npm。

```powershell
npm ci
npm run dev
```

打开 http://localhost:3000。

生产运行：

```powershell
npm run build
npm run start
```

## 使用与替换

- 首页按钮进入宇宙；点击星球显示回忆照片和故事。
- 照片墙按类别筛选，点击照片放大；时间轴也可打开详情。
- 纪念日显示相处天数、下一个周年，支持添加、每年重复和删除。按上海日期计算，当天显示“就是今天”；闰日周年平年用 2 月 28 日。
- 默契测试：第一位回答三题，交接屏幕后第二位独立回答，再比较结果。
- 回忆问答：按演示故事计分，可重玩。盲盒随机抽取约会建议，连续两次不重复。
- 修改 `src/data/demo.ts` 的 couple、memories、题目和惊喜列表即可替换演示内容。图片可以使用 `/demo/文件名` 或可信 HTTPS 地址。
- 公开演示模式的自定义纪念日只存当前浏览器 `loveverse.anniversaries.v1`；私人模式保存到服务端，双方设备可同步，原浏览器数据可经明确确认后导入。

## 模块结构

```text
src/app/                 页面入口、全局样式与元数据
src/components/          首页、星空、回忆、弹窗、纪念日与游戏
src/data/demo.ts          可替换的演示内容
src/lib/dates.ts          独立日期计算
public/demo/             公开演示素材
tests/unit/              日期边界测试
tests/e2e/               浏览器交互与响应式测试
docs/PLAN.md             中文计划、架构决策、Skills 使用记录
```

技术栈：Next.js + React + TypeScript、Tailwind CSS v4、Motion、Three.js。Three.js 客户端动态加载，限制像素比，页面隐藏时停止动画，卸载时释放资源；WebGL 不可用时保留 CSS 星点。原生 dialog 提供焦点限制与 Escape 支持。V2 增加 Node 服务端认证、Markdown 文件存储和私人上传，没有数据库。

V2 新增依赖：`zod`（数据校验）、`yaml`（frontmatter）、`react-markdown` + `remark-gfm`（安全 Markdown AST 渲染）、`server-only`（服务端模块边界）、`sharp`（图片解码、重新编码）。

## 测试

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:e2e:private
npm run test:build-privacy
```

浏览器测试默认使用 Windows Microsoft Edge，覆盖桌面和手机仿真。其他系统可将 `playwright.config.ts` 中的 `channel: 'msedge'` 删除，再执行 `npx playwright install chromium`。E2E 自动启动生产服务，因此先执行 build。测试不包含真实移动设备或 Safari 验证。

私人测试配置在 `playwright.private.config.ts`，独立端口 3101，使用系统临时目录中的虚构账号，结束后清理；公开回归用 3100，并强制 demo 模式。两套测试都不会接触实际私人目录。Windows 受限沙箱可能需要允许浏览器进程和子进程清理。

本次执行结果与验证边界见 [V2 验证记录](docs/V2-VALIDATION.md)。

## 私人内容保护

项目不含私人照片或日记，不会自动提交 Git。`.gitignore` 忽略 private/、public/private/、_.private._ 与环境变量文件。**忽略文件不等于访问控制**：public 下文件、前端打包的故事及照片地址都会暴露给访客。robots noindex 也不构成认证。加入真实内容后，必须先给完整站点和静态资源加服务端访问保护；不要把真实故事写进准备公开提交的 demo.ts。

## Cloudflare Tunnel 分享教程

仅编写教程，本项目不会自动启动公网隧道。

1. 在 Windows 安装 cloudflared：

```powershell
winget install --id Cloudflare.cloudflared
cloudflared --version
```

2. 用 `npm run build` 构建，然后在一个终端运行 `npm run start -- --hostname 127.0.0.1`。
3. 分享纯演示站：另开终端运行：

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

把输出的 HTTPS trycloudflare.com 地址发给对方。此方式任何拿到链接的人都能访问；关闭 cloudflared 终端后链接失效，重启地址会改变。

4. 根据当前官方文档，新版 Quick Tunnel 可用邮件验证码限制访客（先用 `cloudflared tunnel --help` 确认安装版本支持 `--allowed-mail`）：

```powershell
cloudflared tunnel --url http://127.0.0.1:3000 --allowed-mail your-email@example.com --allowed-mail partner-email@example.com
```

替换为双方邮箱，先在未登录浏览器中测试拦截，再加载私人素材。若版本不支持此参数，不要去掉保护后分享真实内容；更新 cloudflared，或使用下面的持久隧道方案。

5. 长期使用：在 Cloudflare 配置域名与命名 Tunnel，将公网主机名映射到 `http://localhost:3000`；在 Zero Trust / Access 建立覆盖该主机名所有路径的 Self-hosted application，仅允许双方邮箱，拒绝其他访问。验证图片 URL 也被保护。不要公开 Tunnel token。保持电脑、应用和 cloudflared 在线。

**V2 私人分享：**推荐命名 Tunnel + 固定域名 + Cloudflare Access。把私人服务的 `LOVEVERSE_ORIGIN` 设置为该 HTTPS origin 后重启；浏览器写请求来源必须完全匹配。应用自身仍要求邮箱/密码登录，不信任裸 Cloudflare 邮箱头。Access 必须覆盖 `/api/*` 和图片路径；不要配置绕过认证的路径规则。关闭源站公共入站访问，只监听回环地址，让 cloudflared 连接。私人模式禁止使用未加保护、频繁变化地址的演示分享流程；若临时地址改变，必须重新配置 origin。本文只提供操作说明，不自动开隧道。

Quick Tunnel 适合临时测试，不保证持续在线；不支持 SSE，最多 200 个并行请求。详情以 [Cloudflare Quick Tunnels 官方说明](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) 和 [Tunnel 文档](https://developers.cloudflare.com/tunnel/) 为准。

## 素材与 Skills

演示海边图由内置 imagegen 工具生成，文件为 `public/demo/sea.png`。其余演示图来自 Unsplash，已保存至 `public/demo/`，网站运行不需要外部图片服务。个人部署可换成本地授权照片。素材记录见 `docs/ASSETS.md`，本地已读取 Skills 和开发计划见 `docs/PLAN.md`。
