// Isolated IDE workspace: the user's AppID never enters tracked configuration.
const fs = require('node:fs');
const path = require('node:path');
const { root, copyTree } = require('./build');
const appid = process.argv[2];
if (!/^wx[0-9a-f]{16}$/.test(appid || '')) throw new Error('Usage: node tools/prepare-wechat-local.js <AppID> [source-app-directory]');
const source = path.resolve(process.argv[3] || path.join(root, 'apps/wechat'));
const dest = path.join(root, '.local/wechat');
copyTree(source, dest, p => !p.endsWith('project.private.config.json'));
const config = JSON.parse(fs.readFileSync(path.join(dest, 'project.config.json'), 'utf8'));
config.appid = appid;
fs.writeFileSync(path.join(dest, 'project.config.json'), JSON.stringify(config, null, 2));
console.log(dest);
