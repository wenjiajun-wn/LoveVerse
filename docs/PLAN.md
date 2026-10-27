# 产品与实现计划

## 目标和边界

用一个手机可用的纪念空间收藏两个人的经历。验收重点是六个功能区都可操作、回忆内容可替换、自定义纪念日刷新后存在、游戏计分真实、生产构建成功。

首版为单一 Next.js 应用，演示内容为静态数据，自定义纪念日保存在 localStorage。暂无账号、后端数据库、照片上传、远程同步。两位玩家使用同一设备轮流作答。功能区使用 URL hash 导航，支持直接链接、刷新和浏览器返回。

## 开发顺序

1. 需求与页面交互：建立六个功能区、共享回忆模型和访问边界。
2. 架构：App Router 入口、独立 UI 模块、纯日期逻辑、静态演示数据。
3. 核心页面：星空首页、可点击星球、瀑布流照片墙、时间轴、纪念日、小游戏。
4. 完成交互：弹窗、筛选、保存与删除、双人轮流作答、计分与重玩、盲盒抽取。
5. 检查手机布局、键盘与低动态模式，测试和修复，再验证生产构建。
6. 交付启动说明和 Tunnel 分享教程。

## 设计约定

采用私人旅行手册与电影片头的视觉语言：左侧故事文字、右侧交互星图。深蓝背景和低饱和粉紫强调色来自用户指定；星球阴影与轨道表达空间。主标题使用系统中文宋体模拟书信，正文使用系统无衬线，避免构建时下载字体。控件圆角 4–6px，内容容器 8–10px，弹窗 14px，星球与头像为圆形。

手机导航保持六个入口可见；首页上下排列，相册两列，时间轴与小游戏纵向排列。弹窗支持 Escape、焦点限制与关闭后焦点恢复；动画尊重 prefers-reduced-motion。

## 实际读取的本地 Skills

没有安装或声称调用未知 Skill。下面是本次读取并采用的本地指南：

- ~/.codex/skills/product-manager-toolkit/SKILL.md：目标、范围、验收标准。
- ~/.codex/skills/senior-architect/SKILL.md：模块化单体、分离数据和界面。
- ~/.codex/skills/frontend-ui-engineering/SKILL.md：响应式、语义按钮、焦点管理。
- ~/.agents/skills/taste-skill/SKILL.md：设计方向、低饱和配色、素材与交互反馈。
- ~/.codex/skills/pw/SKILL.md、pw-review/SKILL.md 与 anti-patterns.md：角色定位器、无固定等待、独立测试、用例审查。
- ~/.codex/skills/.system/imagegen/SKILL.md：内置生成工具制作项目演示素材。

已查看用户指定仓库：[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)、[alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)。结合其工程、产品与测试方向应用本地指南；没有运行仓库安装脚本或宣称执行其全部工具。

## 架构决策

采用静态数据 + localStorage 是为了使首版无需密钥即可运行。代价是无设备间同步，浏览器清除数据后纪念日会丢失。未来可在数据层增加私有数据库与对象存储，先完成服务端身份验证，再支持上传与共享。
