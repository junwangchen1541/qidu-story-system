const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Ajv = require('ajv/dist/2020');
const core = require('../packages/story-core');
const { createSession } = require('../packages/story-core/session');
const route = require('../data/routes/public-demo.json');
const validate = new Ajv({ allErrors: true }).compile(require('../schema/route.schema.json'));
const complete = (s, id) => { s.act('open', id); while (s.view().hasNext) s.act('next'); s.act('choose', 0); };
test('public schema and semantic validation', () => {
  assert.equal(validate(route), true, JSON.stringify(validate.errors));
  assert.equal(core.validateRoute(route).ok, true);
  for (const bad of [null, {}, { ...route, events: {} }, { ...route, events: [null] }]) assert.equal(core.validateRoute(bad).ok, false);
  const bad = structuredClone(route); bad.events[0].conditions[0].type = 'typo';
  assert.equal(core.validateRoute(bad).ok, false);
  bad.events[0].location = 'missing';
  assert.ok(core.validateRoute(bad).errors.some(e => e.includes('location')));
});
test('real session: private message gate, ending and restore', () => {
  let saved; const storage = { load: () => saved, save: (_, v) => { saved = v; } };
  let s = createSession(route, storage);
  assert.throws(() => s.act('read', 'mail_1'), /unavailable/);
  complete(s, 'start');
  assert.throws(() => s.act('open', 'school'), /unavailable/);
  s.act('read', 'mail_1'); const snapshot = s.snapshot(); s.act('read', 'mail_1');
  assert.deepEqual(s.snapshot(), snapshot);
  complete(s, 'school'); complete(s, 'ending');
  assert.equal(s.view().ending.id, 'public_demo_end');
  s = createSession(route, storage);
  assert.equal(s.view().mode, 'ending');
  assert.ok(s.view().locations.every(l => !l.available));
  s.act('reset'); assert.equal(s.view().mode, 'map');
});
test('cannot skip dialogue; map preserves active event and reload position', () => {
  let saved; const storage = { load: () => saved, save: (_, v) => { saved = v; } };
  const s = createSession(route, storage); s.act('open', 'start');
  assert.throws(() => s.act('choose', 0), /not finished/);
  s.act('next'); s.act('map'); s.act('open', 'start');
  assert.equal(s.view().lineIndex, 1);
  assert.equal(createSession(route, storage).view().lineIndex, 1);
  assert.throws(() => s.act('open', 'school'), /another event/);
});
test('corrupt saves recover and storage failures do not stop play', () => {
  const snapshot = core.serializeState(core.createState(route));
  for (const patch of [{ version: 999 }, { revision: 'other' }, { eventId: 'start', lineIndex: 500 }, { flags: null }]) {
    assert.throws(() => core.hydrateState(route, { ...snapshot, ...patch }));
  }
  const s = createSession(route, { load: () => ({ version: 99 }), save: () => { throw Error('quota'); } });
  assert.ok(s.view().notice); s.act('open', 'start'); assert.ok(s.view().notice.includes('未能写入'));
});
test('generated WeChat core and route match the single source', () => {
  for (const file of ['index.js', 'session.js']) assert.equal(fs.readFileSync('apps/wechat/shared/' + file, 'utf8'), fs.readFileSync('packages/story-core/' + file, 'utf8'));
  assert.deepEqual(require('../apps/wechat/data/content').route, route);
});
