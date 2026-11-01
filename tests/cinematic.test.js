const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../packages/story-core/session');
const { validateRoute } = require('../packages/story-core');
function route() {
  const ids = ['intro', 'question', 'outro'];
  return {
    meta: { id: 'cinematic-test', revision: '1', title: 'Test', timeline: ids },
    initial: { flags: [], vars: {} }, locations: [{ id: 'stage', x: 50, y: 50 }], messages: [],
    events: ids.map((id, i) => ({ id, location: 'stage', autoAdvance: i !== 1, nextEventId: ids[i + 1],
      conditions: [{ type: 'flag_not_set', flag: id }], lines: [{ text: id, durationMs: 100 }],
      choices: (i === 1 ? ['A', 'B'] : ['→']).map((text, j) => ({ text, effects: [
        { type: 'set_flag', flag: id }, { type: 'set_variable', name: id, value: j }
      ] })) })),
    endings: [{ id: 'end', conditions: [{ type: 'flag_set', flag: 'outro' }] }]
  };
}
test('cinematic waits for choices, persists answers, restores and resets', () => {
  for (const answer of [0, 1]) {
    let saved;
    const storage = { load: () => saved, save: (_, value) => { saved = value; } };
    let session = createSession(route(), storage);
    assert.equal(session.view().eventId, 'intro');
    assert.deepEqual(session.view().choices, []);
    assert.equal(session.act('advance').eventId, 'question');
    assert.equal(session.act('advance').eventId, 'question');
    assert.equal(session.act('map').mode, 'scene');
    session = createSession(route(), storage);
    assert.equal(session.view().eventId, 'question');
    assert.equal(session.act('choose', answer).eventId, 'outro');
    assert.equal(session.snapshot().vars.question, answer);
    assert.equal(session.act('advance').mode, 'ending');
    session = createSession(route(), storage);
    assert.equal(session.view().mode, 'ending');
    assert.equal(session.act('reset').eventId, 'intro');
    assert.equal(session.snapshot().vars.question, undefined);
  }
});
test('invalid cinematic links and media ranges are rejected', () => {
  const badLink = route(); badLink.events[0].nextEventId = 'missing';
  assert.equal(validateRoute(badLink).ok, false);
  const badClip = route(); badClip.events[0].lines[0].video = { id: 'clip', start: 10, end: 9 };
  assert.equal(validateRoute(badClip).ok, false);
});
