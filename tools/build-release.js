const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { zipSync } = require("fflate");
const { buildAt, copyTree } = require("./build");

const root = path.resolve(__dirname, "..");
const localOnly = "apps/wechat/project.config.json";

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function assertReleaseSource() {
  const status = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  const changes = status.split("\0").filter(Boolean);
  const unexpected = changes.filter(line => line.slice(3).replaceAll("\\", "/") !== localOnly);
  if (unexpected.length) throw new Error("Release source must be committed first:\n" + unexpected.join("\n"));
}

function listFiles(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute, relative) : [{ absolute, path: relative }];
  });
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function validateReleaseAssets(manifest) {
  const ids = new Set();
  for (const asset of manifest.assets) {
    if (!asset.id || ids.has(asset.id)) throw new Error(`Asset ID is missing or duplicated: ${asset.id || "<empty>"}`);
    ids.add(asset.id);
    if (asset.status !== "release-ready") throw new Error(`Asset ${asset.id} is not release-ready`);
    if (!asset.source || !/^[a-f0-9]{64}$/i.test(asset.sha256 || "") || !asset.attribution) throw new Error(`Asset ${asset.id} is missing source, SHA-256, or attribution`);
    if (!Array.isArray(asset.platforms) || !asset.platforms.length) throw new Error(`Asset ${asset.id} has no target platform`);
    if (asset.platforms.some(platform => !["web", "wechat"].includes(platform))) throw new Error(`Asset ${asset.id} has an unsupported target platform`);
  }
}

function zipDirectory(directory, epochSeconds) {
  const files = Object.fromEntries(listFiles(directory).map(file => [file.path,
    [new Uint8Array(fs.readFileSync(file.absolute)), { mtime: new Date(epochSeconds * 1000) }]]));
  return zipSync(files, { level: 9 });
}

function buildRelease() {
  assertReleaseSource();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const revision = git(["rev-parse", "HEAD"]);
  const commitTime = Number(git(["show", "-s", "--format=%ct", "HEAD"]));
  const epochSeconds = process.env.SOURCE_DATE_EPOCH === undefined ? commitTime : Number(process.env.SOURCE_DATE_EPOCH);
  if (!Number.isSafeInteger(epochSeconds) || epochSeconds < 315532800) throw new Error("SOURCE_DATE_EPOCH must be a valid ZIP timestamp");
  const assetManifest = JSON.parse(fs.readFileSync(path.join(root, "manifest/release-assets.json"), "utf8"));
  validateReleaseAssets(assetManifest);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "qidu-release-"));
  const stage = path.join(work, "release");
  const target = path.join(root, "dist", "releases", `v${pkg.version}-${revision.slice(0, 12)}`);
  try {
    const route = JSON.parse(fs.readFileSync(path.join(root, "data/routes/public-demo.json"), "utf8"));
    buildAt(path.join(work, "source"), route);

    const web = path.join(stage, "web");
    const wechat = path.join(stage, "wechat");
    fs.mkdirSync(web, { recursive: true });
    copyTree(path.join(work, "source/apps/web"), path.join(web, "apps/web"));
    copyTree(path.join(work, "source/packages/story-core"), path.join(web, "packages/story-core"));
    copyTree(path.join(work, "source/apps/wechat"), wechat);
    fs.writeFileSync(path.join(wechat, "project.config.json"), git(["show", "HEAD:" + localOnly]) + "\n", "utf8");

    const packages = ["web", "wechat"].map(platform => {
      const files = listFiles(path.join(stage, platform)).map(file => ({
        path: file.path,
        bytes: fs.statSync(file.absolute).size,
        sha256: sha256(file.absolute)
      }));
      return { platform, files };
    });
    const manifest = {
      project: pkg.name,
      version: pkg.version,
      sourceRevision: revision,
      sourceDateEpoch: epochSeconds,
      assetManifestRevision: assetManifest.revision,
      platforms: packages
    };
    fs.writeFileSync(path.join(stage, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    const checksums = [];
    for (const platform of ["web", "wechat"]) {
      const archive = path.join(stage, `${platform}-v${pkg.version}.zip`);
      fs.writeFileSync(archive, zipDirectory(path.join(stage, platform), epochSeconds));
      checksums.push(`${sha256(archive)}  ${path.basename(archive)}`);
    }
    fs.writeFileSync(path.join(stage, "checksums.sha256"), checksums.join("\n") + "\n", "utf8");

    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) {
      const current = listFiles(stage).map(file => [file.path, sha256(file.absolute)]);
      const existing = listFiles(target).map(file => [file.path, sha256(file.absolute)]);
      if (JSON.stringify(current) !== JSON.stringify(existing)) throw new Error(`Existing archive differs from rebuilt output: ${target}`);
    } else copyTree(stage, target);
    console.log(JSON.stringify({ output: target, version: pkg.version, sourceRevision: revision,
      archives: checksums.map(line => line.split("  ")[1]),
      files: packages.map(item => ({ platform: item.platform, count: item.files.length })) }, null, 2));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { buildRelease(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { assertReleaseSource, listFiles, sha256, validateReleaseAssets, zipDirectory, buildRelease };
