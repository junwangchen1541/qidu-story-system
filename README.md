# 七都式剧情系统复现计划

以《永远的7日之都》为创作背景的独立互动叙事游戏项目。游戏围绕地图探索、剧情事件、角色对白、选择分支、私信与多结局展开，网页和微信小程序共用剧情数据与状态机。

[![CI](https://github.com/junwangchen1541/qidu-story-system/actions/workflows/ci.yml/badge.svg)](https://github.com/junwangchen1541/qidu-story-system/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/junwangchen1541/qidu-story-system)](https://github.com/junwangchen1541/qidu-story-system/releases)

> 怎么样都好，但结局不应该是这样。

## 当前状态

当前版本 **0.3.0** 是开发版，包含项目源码和网页演示。共用剧情状态机、网页与微信小程序渲染层已建立，网页支持自动剧情演出；微信端构建包将在真机验收完成后随对应版本发布。

版本内容见 [Releases](https://github.com/junwangchen1541/qidu-story-system/releases)、[变更日志](CHANGELOG.md)和 [0.3.0 发布说明](docs/releases/v0.3.0.md)。

## 游戏系统

- 共享 JavaScript 状态机：事件条件、变量效果、选项、私信、结局与存档。
- 地图地点选择、背景和角色展示、对白框、黑屏文字、闪白和震动。
- 网页自动演出：定时推进、选项等待、暂停恢复、视频片段衔接。
- JSON schema、路线校验、单元测试、桌面和移动尺寸浏览器测试。
- 剧情数据构建、资源清单和多平台构建工具。

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

## 开发与运维

项目按独立游戏的开发节奏维护：功能开发、内容集成、平台验收、版本发布和后续修复均通过版本记录跟踪。当前采用 `0.MINOR.PATCH` 版本与 `vMAJOR.MINOR.PATCH` Git 标签；存档格式、剧情路线 revision 和游戏版本分别管理，更新时执行存档迁移与回归检查。

每个发行版本对应固定提交、标签、更新说明和经过验收的平台构建包，并记录校验值、兼容范围与存档迁移要求。发布检查覆盖构建、自动化测试、关键流程试玩和目标平台兼容性；版本上线后通过 Issues 跟踪问题，并按影响范围发布修复版。流程见 [贡献指南](CONTRIBUTING.md)。

## 项目与素材

本项目以独立游戏方式组织代码、剧情系统、原创内容与平台构建。代码和文档采用 MIT License；游戏素材按来源、授权范围、署名要求和目标平台记录在资源清单中。开发素材进入正式构建前完成授权与平台适配审核。

当前公开版本使用通用占位资源展示系统流程；正式游戏内容按平台整理为可运行构建包。素材生命周期与发布归档方式见 [素材与发布管理](docs/版权与公开边界.md)和 [LICENSE](LICENSE)。
