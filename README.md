# 七都式剧情系统复现计划

研究《永远的7日之都》叙事交互方式的跨平台项目，围绕地图事件、对白、选项、私信、存档和结局，维护网页与微信小程序共用的剧情模型。

[![CI](https://github.com/junwangchen1541/qidu-story-system/actions/workflows/ci.yml/badge.svg)](https://github.com/junwangchen1541/qidu-story-system/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/junwangchen1541/qidu-story-system)](https://github.com/junwangchen1541/qidu-story-system/releases)

> 怎么样都好，但结局不应该是这样。

本项目是非商业同人研究项目，与原权利方无关联。公开演示使用占位文本和图形，原作资源与完整剧情保留在本地私有素材库。

## 当前状态

当前版本 **0.3.0**，处于 1.0 之前的研究原型阶段。已实现共用状态机、网页与微信小程序渲染层，以及网页自动演出能力。数据格式和表现仍会迭代；微信实机验证尚未完成。

版本内容见 [Releases](https://github.com/junwangchen1541/qidu-story-system/releases)、[变更日志](CHANGELOG.md)和 [0.3.0 发布说明](docs/releases/v0.3.0.md)。

## 功能

- 共享 JavaScript 状态机：事件条件、变量效果、选项、私信、结局与存档。
- 地图地点选择、背景和角色展示、对白框、黑屏文字、闪白和震动。
- 网页自动演出：定时推进、选项等待、暂停恢复、视频片段衔接。
- JSON schema、路线校验、单元测试、桌面和移动尺寸浏览器测试。
- 本地私有构建工具，生成内容由 Git 忽略。

## 快速开始

需要 **Node.js 20+** 和 npm。先获取源码并构建公开占位内容：

```bash
npm ci
npm run build
```

可直接打开 `apps/web/index.html`。也可用 Python 3 从仓库根目录启动静态服务器，再访问 `http://localhost:8080/apps/web/`：

```bash
python -m http.server 8080
```

微信开发者工具导入 `apps/wechat/`。账号相关配置使用本地私有副本，具体步骤见 [微信本地演示](docs/微信本地演示.md)。

## 开发检查

```bash
npm test
npm run validate
npx playwright install chromium
npm run test:web
```

Windows 本地测试默认使用已安装的 Chrome；CI 使用 Playwright Chromium。私有素材测试只在显式设置对应环境变量后运行，公开 CI 不依赖本地素材库。

## 仓库结构

```text
apps/web/              网页渲染器
apps/wechat/           微信小程序渲染器
packages/story-core/   两端共用剧情状态机
数据入口 data/routes/  公开占位路线
schema/                剧情 JSON schema
测试目录 tests/        单元与浏览器测试
工具目录 tools/        构建、同步与校验
文档目录 docs/         贡献、资源与版权说明
manifest/              资源清单模板
```

## 版本与维护

采用 `0.MINOR.PATCH` 版本和 `vMAJOR.MINOR.PATCH` Git 标签。新增功能提升次版本，修复提升补丁版本；1.0 之前允许格式调整，须在变更日志中说明。存档版本、路线 revision 与软件版本分别维护，发布时检查兼容性。

每个 Release 对应确定的提交和标签，发布前通过 CI，说明功能、验证范围与已知限制。问题通过 Issues 跟踪，变更通过聚焦的提交或 PR 维护。流程见 [贡献指南](CONTRIBUTING.md)。

## 公开边界与许可

原作文字、美术、音乐、角色及世界观版权归各权利方所有。本仓库 MIT 许可仅覆盖原创代码和文档，不授予原作资源使用权。

请勿上传原作素材、完整剧情、OCR 长文本、APK、账号凭据或部署信息。完整私有构建不进入 GitHub Release。详见 [版权与公开边界](docs/版权与公开边界.md)和 [LICENSE](LICENSE)。
