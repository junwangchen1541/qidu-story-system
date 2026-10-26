# 当前状态

日期：2026-10-24

## 已完成

- 检查 GitHub/Gitee 双远程，当前 `main` 与 GitHub `origin/main` 一致且工作区干净。
- 新增 `packages/story-core/index.js`，集中处理条件、变量、事件、选项、私信、结局和存档序列化。
- 新增 `data/routes/public-demo.json`，公开版路线成为网页与小程序共同输入。
- 新增 `apps/web/` 网页端和 `apps/wechat/` 微信小程序端骨架。
- `demo_public/index.html` 改为兼容跳转入口。

## 当前检查

- 需要运行 `npm run validate`。
- 需要运行 `npm run sync:wechat`，生成小程序端共享核心和路线副本。
- 需要用微信开发者工具导入并检查 `apps/wechat/`。

## 风险

- 完整私人 Demo 仍在素材库的单文件 `11_剧情系统复现/demo_web/index.html`，尚未迁移到共享核心。
- 小程序开发者工具的本机安装路径和当前打开项目需要现场确认。
