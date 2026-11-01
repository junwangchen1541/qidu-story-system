# 贡献与发布流程

欢迎提交代码、公开占位演示、schema、测试和文档的改进。先阅读 [贡献范围](docs/贡献指南.md)与 [版权边界](docs/版权与公开边界.md)。

## 开发

使用 Node.js 20+。修改前检查工作区，不覆盖其他人的未提交改动；行为变更需要相关测试。

```bash
npm ci
npm run build
npm test
npm run validate
npx playwright install chromium
npm run test:web
```

本地默认使用 Chrome；Linux CI 使用 Playwright Chromium。公开测试不依赖私有素材或微信登录。

提交与 PR 说明具体问题、最终行为、验证结果和限制。不要上传本机账号配置、生成构建、原作素材、完整剧情或 OCR 长文本。

## 版本规则

- 使用语义化版本：当前为 0.x，功能更新提升 MINOR，修复提升 PATCH。
- 数据格式不兼容变化须提升 MINOR 并记录迁移方式或存档失效范围。
- 软件版本、路线 revision 和存档格式 version 分别管理；不要无理由改变现有存档标识。
- 标签为 vMAJOR.MINOR.PATCH，每个标签固定对应一个提交，已发布版本不移动标签。

## 发布检查

1. 更新 package.json、package-lock.json、CHANGELOG.md 和 docs/releases/ 对应说明，确认版本一致。
2. 检查公开文件清单，排除私有素材与账号配置。
3. 完成构建、单元测试、路线校验和浏览器测试。
4. 在 main 提交变更，创建带注释版本标签并推送，等待 GitHub CI 通过。
5. 以对应发布说明创建 GitHub Release，标明验证范围和已知限制。
6. 核对 Release 标签、源码归档和 README 链接；不把本地私有构建作为发布附件。
