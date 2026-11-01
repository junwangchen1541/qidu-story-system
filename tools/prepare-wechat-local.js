// Isolated IDE workspace: the user's AppID never enters tracked configuration.
const fs = require('node:fs');
const path = require('node:path');
const { root, copyTree } = require('./build');
const appid = process.argv[2];
if (!/^wx[0-9a-f]{16}$/.test(appid || '')) throw new Error('Usage: node tools/prepare-wechat-local.js <AppID> [source-app-directory] [destination]');
const source = path.resolve(process.argv[3] || path.join(root, 'apps/wechat'));
const dest = path.resolve(process.argv[4] || path.join(root, '.local/wechat'));
const contains = (parent, child) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
if (contains(source, dest) || contains(dest, source)) throw new Error('Source and destination must not overlap');
const content = require(path.join(source, 'data/content.js'));
const marker = path.join(dest, '.qidu-local-build.json');
if (process.argv[4] && fs.existsSync(dest) && fs.readdirSync(dest).length) {
  if (!fs.existsSync(marker)) throw new Error('Destination contains files not owned by this build');
  const previous = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (previous.source !== source || previous.routeId !== content.route.meta.id) throw new Error('Destination belongs to another route or source');
}
copyTree(source, dest, p => !p.endsWith('project.private.config.json'));
const config = JSON.parse(fs.readFileSync(path.join(dest, 'project.config.json'), 'utf8'));
config.appid = appid;
config.projectname = 'qidu-' + content.route.meta.id;
config.description = content.route.meta.title + ' / 本地演示';
fs.writeFileSync(path.join(dest, 'project.config.json'), JSON.stringify(config, null, 2));
for (const file of ['app.json', 'pages/index/index.json']) {
  const target = path.join(dest, file);
  const json = JSON.parse(fs.readFileSync(target, 'utf8'));
  (file === 'app.json' ? json.window : json).navigationBarTitleText = content.route.meta.title;
  fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n');
}
fs.writeFileSync(marker, JSON.stringify({ source, routeId: content.route.meta.id }, null, 2));
console.log(dest);
