// Local-only build. No original text or assets are embedded in this tool.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { root, write, buildAt } = require("./build");
async function main() {
  const sourceRoot = process.argv[2];
  if (!sourceRoot) throw new Error("Usage: npm run build:private -- <private-materials-root>");
  const source = path.resolve(sourceRoot);
  const legacy = path.join(source, "11_剧情系统复现/demo_web");
  const route = JSON.parse(fs.readFileSync(path.join(legacy, "demo_route_mainline01.json"), "utf8"));
  const html = fs.readFileSync(path.join(legacy, "index.html"), "utf8");
  const start = html.indexOf("const assets = ");
  const end = html.indexOf("const route =", start);
  if (start < 0 || end < 0) throw new Error("Could not find legacy asset map");
  const assets = vm.runInNewContext(html.slice(start, end) + "\nassets;", {}, { timeout: 1000 });
  const output = path.join(root, "build_private");
  const manifest = [];
  const converted = { bg: {}, portrait: {}, audio: {} };
  const sharp = require("sharp");
  for (const kind of ["bg", "portrait"]) {
    for (const [id, relative] of Object.entries(assets[kind] || {})) {
      const file = path.resolve(legacy, relative);
      if (!file.startsWith(source + path.sep)) throw new Error("Asset escaped source root");
      if (!fs.existsSync(file)) { manifest.push({ kind, id, status: "missing" }); continue; }
      const bytes = fs.readFileSync(file);
      const hash = crypto.createHash("sha256").update(bytes).digest("hex");
      const name = kind + "-" + hash.slice(0, 16) + ".webp";
      const dest = path.join(output, "apps/web/assets", name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await sharp(bytes).resize({ width: kind === "bg" ? 1280 : 600, height: kind === "bg" ? 900 : 1000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 62 }).toFile(dest);
      const miniDest = path.join(output, "apps/wechat/assets", name);
      fs.mkdirSync(path.dirname(miniDest), { recursive: true });
      fs.copyFileSync(dest, miniDest);
      converted[kind][id] = "./assets/" + name;
      manifest.push({ kind, id, source: path.relative(source, file), sha256: hash, output: name, bytes: fs.statSync(dest).size, status: "ok" });
    }
  }
  buildAt(output, route, converted);
  write(path.join(output, "asset-manifest.json"), JSON.stringify(manifest, null, 2));
  write(path.join(output, "README.txt"), "Local private build. Do not publish.\nRoute source: " + path.join(legacy, "demo_route_mainline01.json") + "\n");
  console.log(JSON.stringify({ output, events: route.events.length, assets: manifest.filter((m) => m.status === "ok").length,
    missing: manifest.filter((m) => m.status === "missing").length, assetBytes: manifest.reduce((n, m) => n + (m.bytes || 0), 0) }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
