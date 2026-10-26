# 交接

当前已将公开仓库改成共享核心、网页端、微信小程序端的 monorepo 结构。网页和小程序读取 `data/routes/public-demo.json`，状态机位于 `packages/story-core/index.js`。

恢复后先执行：

```powershell
cd G:\永远的七日之都素材\13_开源发布\qidu-story-system-public
npm run validate
npm run sync:wechat
```

然后用微信开发者工具导入 `apps/wechat/`；检查后再提交并推送 `main`。

最高风险：完整私有 Demo 尚未迁移到共享核心；当前公开端只验证占位路线，不能声称已经验证私有第一主线跨端一致。
