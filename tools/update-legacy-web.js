// Update the existing private demo entry with the shared runtime, keeping the
// embedded route, asset map and original asset paths. No private text is public.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, write, copyTree } = require('./build');
const materials = process.argv[2];
if (!materials) throw Error('Usage: node tools/update-legacy-web.js <private-materials-root>');
const directory = path.resolve(materials, '11_剧情系统复现/demo_web');
const entry = path.join(directory, 'index.html');
const original = fs.readFileSync(entry, 'utf8');
const start = original.indexOf('const assets = ');
const routeStart = original.indexOf('const route =', start);
let end = original.indexOf('const state =', routeStart);
if (end < 0) end = original.indexOf('window.StoryContent =', routeStart);
if (start < 0 || routeStart < 0 || end < 0) throw Error('Cannot locate existing private route and assets');
const embedded = original.slice(start, end).trim();
const route = vm.runInNewContext(embedded + '\nroute;', {}, { timeout: 1000 });
const exported = JSON.parse(fs.readFileSync(path.join(directory, 'demo_route_mainline01.json'), 'utf8'));
if (JSON.stringify(route) !== JSON.stringify(exported)) throw Error('Embedded route differs from source JSON; resolve before migration');
const backup = path.join(root, '.local/legacy-web-before-shared.html');
if (!fs.existsSync(backup)) write(backup, original);
let html = fs.readFileSync(path.join(root, 'apps/web/index.html'), 'utf8');
html = html.replace('../../packages/story-core/index.js', './shared/index.js')
  .replace('../../packages/story-core/session.js', './shared/session.js')
  .replace('<script src="./content.js"></script>', '<script>\n' + embedded + '\nwindow.StoryContent = { route, assets };\n</script>');
if (fs.existsSync(path.join(directory, 'p1-content.js'))) {
  html = html.replace('<script src="./app.js"></script>', '<script src="./p1-content.js"></script>\n  <script src="./app.js"></script>');
}
write(path.join(directory, 'styles.css'), fs.readFileSync(path.join(root, 'apps/web/styles.css'), 'utf8'));
write(path.join(directory, 'app.js'), fs.readFileSync(path.join(root, 'apps/web/app.js'), 'utf8'));
copyTree(path.join(root, 'packages/story-core'), path.join(directory, 'shared'));
write(entry, html);
console.log('Updated original private demo entry; route and asset map unchanged:', entry);
