# LoveVerse · 恋爱宇宙

情侣纪念网站，包含浪漫星空、可点击回忆星球、瀑布流相册、时间轴、纪念日和三个可玩的小游戏。所有故事和人物为演示内容。

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
- 自定义纪念日只存当前浏览器 `loveverse.anniversaries.v1`；无跨设备同步，无云端备份。

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

技术栈：Next.js + React + TypeScript、Tailwind CSS v4、Motion、Three.js。Three.js 客户端动态加载，限制像素比，页面隐藏时停止动画，卸载时释放资源；WebGL 不可用时保留 CSS 星点。原生 dialog 提供焦点限制与 Escape 支持。未集成登录、照片上传或数据库。

## 测试

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

浏览器测试默认使用 Windows Microsoft Edge，覆盖桌面和手机仿真。其他系统可将 `playwright.config.ts` 中的 `channel: 'msedge'` 删除，再执行 `npx playwright install chromium`。E2E 自动启动生产服务，因此先执行 build。测试不包含真实移动设备或 Safari 验证。

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

Quick Tunnel 适合临时测试，不保证持续在线；不支持 SSE，最多 200 个并行请求。详情以 [Cloudflare Quick Tunnels 官方说明](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) 和 [Tunnel 文档](https://developers.cloudflare.com/tunnel/) 为准。

## 素材与 Skills

演示海边图由内置 imagegen 工具生成，文件为 `public/demo/sea.png`。其余演示图来自 Unsplash，已保存至 `public/demo/`，网站运行不需要外部图片服务。个人部署可换成本地授权照片。素材记录见 `docs/ASSETS.md`，本地已读取 Skills 和开发计划见 `docs/PLAN.md`。
