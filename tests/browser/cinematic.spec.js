const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const target = path.resolve('build_private/p1-web/index.html');
const legacyTarget = process.env.QIDU_PRIVATE_ROOT && path.resolve(process.env.QIDU_PRIVATE_ROOT, '11_剧情系统复现/demo_web/index.html');
test('P1: timed playback, choice gate, pause and reload', async ({ page }, info) => {
  test.skip(!process.env.QIDU_P1 || !fs.existsSync(target), 'Requires local private P1 build');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(pathToFileURL(target).href);
  await expect(page.locator('.play-cover')).toBeVisible();
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('#mapBtn')).toBeHidden();
  await expect(page.locator('[data-action="next"]')).toHaveCount(0);
  await page.clock.runFor(12000);
  await expect(page.locator('[data-action="choose"]')).toHaveCount(2);
  await page.clock.runFor(12000);
  await page.screenshot({ path: info.outputPath('p1-question.png'), animations: 'disabled' });
  const question = await page.locator('#fx').textContent();
  await page.clock.runFor(120000);
  await expect(page.locator('#fx')).toHaveText(question);
  await page.locator('[data-action="choose"]').first().click();
  await page.locator('#pauseBtn').click();
  const paused = await page.locator('#fx').textContent();
  await page.clock.runFor(30000);
  await expect(page.locator('#fx')).toHaveText(paused);
  await page.locator('#pauseBtn').click();
  await page.clock.runFor(12000);
  await expect(page.locator('[data-action="choose"]')).toHaveCount(2);
  await page.reload();
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('[data-action="choose"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('P1: footage decodes and hands off to the wake-up text', async ({ page }, info) => {
  test.skip(!process.env.QIDU_P1 || !fs.existsSync(target), 'Requires local private P1 build');
  const route = JSON.parse(fs.readFileSync(path.resolve('build_private/p1-web/route.json'), 'utf8'));
  const { createSession } = require('../../packages/story-core/session');
  const session = createSession(route);
  while (!session.view().line.video) session.act(session.view().autoAdvance ? 'advance' : 'choose', 0);
  await page.clock.install();
  await page.addInitScript(snapshot => { localStorage.setItem('qidu:save:v1:p1-cinematic', JSON.stringify(snapshot)); }, session.snapshot());
  await page.goto(pathToFileURL(target).href);
  await page.locator('[data-action="play"]').click();
  await expect.poll(() => page.locator('video').evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeGreaterThan(93);
  await page.locator('video').evaluate(v => { v.currentTime = 200; });
  await expect.poll(() => page.locator('video').evaluate(v => !v.seeking && v.readyState >= 2)).toBe(true);
  await page.screenshot({ path: info.outputPath('p1-footage.png') });
  await page.locator('video').evaluate(v => { v.currentTime = 349.4; });
  await expect(page.locator('video')).toBeHidden();
  await page.clock.runFor(48000);
  await page.screenshot({ path: info.outputPath('p1-awake.png'), animations: 'disabled' });
  await expect(page.locator('.ending-card')).toHaveCount(0);
  await expect(page.locator('#dialogue .line, #fx .title-text').first()).not.toBeEmpty();
  expect(route.meta.timeline.at(-1)).toBe('P2-D1004');
});

test('P2: continues after P1 without replaying the wake-up, preserves save position', async ({ page }, info) => {
  test.skip(!process.env.QIDU_P1 || !fs.existsSync(target), 'Requires local private P1/P2 build');
  const route = JSON.parse(fs.readFileSync(path.resolve('build_private/p1-web/route.json'), 'utf8'));
  const { createSession } = require('../../packages/story-core/session');
  const session = createSession(route);
  while (session.view().eventId !== 'P2-D0014') {
    if (session.view().hasNext) session.act('advance');
    else session.act('choose', 0);
  }
  const firstP2 = session.snapshot();
  await page.clock.install();
  await page.addInitScript(snapshot => {
    if (!localStorage.getItem('qidu:save:v1:p1-cinematic')) localStorage.setItem('qidu:save:v1:p1-cinematic', JSON.stringify(snapshot));
  }, firstP2);
  await page.goto(pathToFileURL(target).href);
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('#dialogue .line')).toHaveText(route.events.find(e => e.id === firstP2.eventId).lines[0].text);
  await page.screenshot({ path: info.outputPath('p2-opening.png'), animations: 'disabled' });
  await page.clock.runFor(route.events.find(e => e.id === firstP2.eventId).lines[0].durationMs + 20);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('qidu:save:v1:p1-cinematic')));
  expect(saved.eventId).not.toBe(firstP2.eventId);
  await page.reload();
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('#dialogue .line')).toHaveText(route.events.find(e => e.id === saved.eventId).lines[0].text);
  expect(route.meta.parts[1].skippedOverlap).toBe('P2-D0001..P2-D0013');
});

test('original private Demo entry loads the generated P1/P2 route', async ({ page }) => {
  test.skip(!process.env.QIDU_P1 || !legacyTarget || !fs.existsSync(legacyTarget), 'Requires the local private Demo entry');
  const route = JSON.parse(fs.readFileSync(path.resolve('build_private/p1-web/route.json'), 'utf8'));
  const { createSession } = require('../../packages/story-core/session');
  const session = createSession(route);
  while (session.view().eventId !== 'P2-D0014') {
    if (session.view().hasNext) session.act('advance');
    else session.act('choose', 0);
  }
  await page.addInitScript(snapshot => { localStorage.setItem('qidu:save:v1:p1-cinematic', JSON.stringify(snapshot)); }, session.snapshot());
  await page.goto(pathToFileURL(legacyTarget).href);
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('#dialogue .line')).toHaveText(route.events.find(e => e.id === session.view().eventId).lines[0].text);
});
