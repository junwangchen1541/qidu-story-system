const Launcher = require('miniprogram-automator/out/Launcher').default;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  // IDE 2.02 returns only its own version from Tool.getInfo. Query the actual
  // simulator SDK version instead of automator 0.13's obsolete field lookup.
  const mini = await new Launcher().connectTool({ wsEndpoint: process.env.WECHAT_WS || 'ws://127.0.0.1:9420' });
  const errors = []; mini.on('exception', e => errors.push(e));
  const privateMode = process.argv.includes('--private');
  const saveKey = 'qidu:save:v1:' + (privateMode ? 'mainline01_orthodox_sandbox' : 'public-demo');
  const previous = await mini.callWxMethod('getStorageSync', saveKey);
  try {
    const system = await mini.callWxMethod('getAppBaseInfo');
    assert.ok(require('licia/cmpVersion')(system.SDKVersion, '2.7.3') >= 0);
    console.log('Simulator SDK:', system.SDKVersion);
    await mini.callWxMethod('removeStorageSync', saveKey);
    // automator 0.13 asks App.getCurrentPage before every route change. IDE
    // 2.02 can briefly report no webview during a rebuild, so route directly
    // and wait for the page stack to register.
    const waitPage = async () => {
      for (let i = 0; i < 30; i++) {
        const stack = await mini.pageStack();
        if (stack.length) return stack[stack.length - 1];
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      throw new Error('微信模拟器页面未注册；请先在开发者工具点击“编译”并等待模拟器出现页面。');
    };
    const relaunch = async () => { await mini.callWxMethod('reLaunch', { url: '/pages/index/index' }); return waitPage(); };
    let page = await relaunch();
    await page.waitFor('.hotspot');
    const tap = async (selector) => { const el = await page.$(selector); assert.ok(el, selector); await el.tap(); };
    const open = id => tap('[data-action="open"][data-value="' + id + '"]');
    const finish = async (choice = 0) => {
      for (let i = 0; await page.data('hasNext'); i++) { assert.ok(i < 2000); await tap('[data-action="next"]'); }
      await tap('[data-action="choose"][data-value="' + choice + '"]');
    };
    const output = path.resolve('test-results/wechat'); fs.mkdirSync(output, { recursive: true });
    if (privateMode) {
      await mini.screenshot({ path: path.join(output, 'private-map.png') });
      await open('awake');
      await tap('[data-action="next"]');
      page = await relaunch();
      assert.equal(await page.data('lineIndex'), 1);
      for (let i = 0; await page.data('black'); i++) { assert.ok(i < 20); await tap('[data-action="next"]'); }
      await mini.screenshot({ path: path.join(output, 'private-dialogue.png') });
      await finish();
      for (const id of ['terminal', 'black_gate', 'school_start', 'students', 'sybille', 'area_choice', 'downtown', 'old_town', 'research_area', 'bay_side_area', 'old_city_area', 'harbor_area', 'final', 'ending_end_flow']) {
        await open(id); await finish(); console.log('completed', id);
      }
      assert.equal((await page.data('ending')).id, 'end');
    } else {
      await open('start'); assert.equal(await page.data('black'), true);
      await tap('[data-action="next"]');
      page = await relaunch();
      assert.equal(await page.data('lineIndex'), 1);
      await finish();
      await tap('[data-action="terminal"]'); await tap('[data-action="read"]');
      assert.equal((await page.data('messages'))[0].read, true);
      await tap('[data-action="terminal"]');
      await open('school'); await finish(); await open('ending'); await finish();
      assert.equal((await page.data('ending')).id, 'public_demo_end');
    }
    assert.equal(await page.data('mode'), 'ending');
    page = await relaunch(); assert.equal(await page.data('mode'), 'ending');
    await mini.screenshot({ path: path.join(output, privateMode ? 'private-ending.png' : 'public-ending.png') });
    assert.deepEqual(errors, []);
    console.log('WeChat simulator passed:', privateMode ? 'private first mainline, 1-core ending' : 'public full route and private-message gate');
  } finally {
    if (previous) await mini.callWxMethod('setStorageSync', saveKey, previous);
    else await mini.callWxMethod('removeStorageSync', saveKey);
    try {
      await mini.callWxMethod('reLaunch', { url: '/pages/index/index' });
    } finally {
      await mini.disconnect();
    }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
