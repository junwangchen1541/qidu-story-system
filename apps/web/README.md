# Web 端

网页端只负责加载路线数据和渲染界面，剧情条件、变量、私信和结局判定来自 `packages/story-core`。

在仓库根目录运行：

```bash
python -m http.server 8080
```

然后打开 `http://localhost:8080/apps/web/`。使用静态服务器是因为浏览器禁止网页直接用 `file://` 读取路线 JSON。
