# Web 端

网页端只负责加载路线数据和渲染界面，剧情条件、变量、私信和结局判定来自 `packages/story-core`。

在仓库根目录运行：

```bash
python -m http.server 8080
```

然后打开 `http://localhost:8080/apps/web/`。先运行 `npm run build` 生成数据；构建后的页面也支持直接以 `file://` 打开。

# 2026-10-29：按原 Demo 迭代

界面样式以原有 `11_剧情系统复现/demo_web/index.html` 为基线迁移，保留地图背景与地点坐标、城市线条、三位置立绘、对白框、黑屏演出、终端和结局卡片。状态逻辑使用共享 `StorySession`，公开文本仍为占位数据。

更新原私有网页入口：`node tools/update-legacy-web.js <私有素材库根目录>`。脚本校验内嵌剧情与 JSON 一致后，只替换入口的渲染器和状态机，保留原资源地址；首次迁移前的副本保存在 ignored `.local/legacy-web-before-shared.html`。

## 私有 P1 演示

完整第一主线不进入公开 `data/`。在本地素材库完成 OCR 整理后运行：

```powershell
python -X utf8 'G:\永远的七日之都素材\00_项目管理\OCR全屏归档\生成P1游戏数据.py'
node tools/build-p1-web.js 'G:\永远的七日之都素材'
```

打开 `build_private/p1-web/index.html` 或本地素材库 `11_剧情系统复现/demo_web/index.html`。P1 开场以自动文字演出和三个选择节点呈现；战斗部分使用本地原录屏的 93.167–349.367 秒片段，再接回世界重构与苏醒。随后接入 P2，从 `P2-D0014` 演出到 `P2-D1004`；P2 开头 13 组重叠内容不重复播放，重叠 OCR 组并入同一页面并保留全部来源 ID。当前整理数据没有确认的 P2 玩家选项，因此自动播放。完整 P2 视频不复制进演示包。旧 P1 版本完成后的存档会从 P2 开始续播。生成的剧情 JSON 与录屏留在私有素材库/ignored 构建目录。
