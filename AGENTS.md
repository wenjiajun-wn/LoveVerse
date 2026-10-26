# LoveVerse 开发约定

- 与用户使用中文交流，保留可运行项目，不只交付方案。
- 技术栈为 Next.js App Router、React、严格 TypeScript、Tailwind CSS、Motion 和 Three.js。
- 页面入口在 src/app；UI 在 src/components；演示内容在 src/data/demo.ts；日期逻辑在 src/lib。
- 所有照片、姓名和故事默认是演示内容。禁止提交私人照片、日记、令牌或 .env；private/ 与 public/private/ 均被忽略。但 gitignore 不是访问控制，public 下文件仍可通过网站访问。
- 分享真实内容前配置 Cloudflare Access 或其他服务端身份验证，不能用前端口令或 robots 代替认证。
- 新增功能应提供键盘访问、焦点状态、手机布局；弹窗使用原生 dialog，并恢复触发元素焦点。
- Three.js 必须按需加载、释放资源，尊重减少动态效果偏好；不可用时保留 CSS 星空。
- 日期以 Asia/Shanghai 的日历日计算，闰日周年在平年取 2 月 28 日。
- 验证：npm test、npm run typecheck、npm run build、npm run test:e2e。变更后的报告必须区分通过、失败和未执行。
- 不自动提交、推送、发布或开公网隧道。
