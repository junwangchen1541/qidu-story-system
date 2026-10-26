// Checks local source with the SAME runtime shipped to both platforms.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const core = require('../packages/story-core');
const Ajv = require('ajv/dist/2020');
const root = process.argv[2];
if (!root) throw Error('Usage: node tools/verify-private.js <private-materials-root>');
const route = JSON.parse(fs.readFileSync(path.join(root, '11_剧情系统复现/demo_web/demo_route_mainline01.json'), 'utf8'));
assert.equal(core.validateRoute(route).ok, true);
const validate = new Ajv().compile(require('../schema/route.schema.json'));
assert.equal(validate(route), true, JSON.stringify(validate.errors));
for (const group of ['events', 'messages', 'endings']) assert.ok(route[group].every(e => e.source));
const cores = {
  school_core: 'msg_school_black_core', downtown_core: 'msg_downtown_black_core',
  old_town_core: 'msg_old_town_black_core', research_core: null,
  bay_side_core: 'msg_bay_side_black_core', old_city_core: 'msg_old_city_black_core',
  harbor_core: 'msg_harbor_black_core_ready'
};
for (const areaChoice of [0, 1]) {
  for (const [selected, finalChoice, expectedCount, expectedEnding] of [
    [[], 0, 1, 'end'], [Object.keys(cores).slice(0, 3), 0, 4, 'box'],
    [Object.keys(cores), 0, 8, 'sacrifice'], [Object.keys(cores), 1, 8, 'end']
  ]) {
    let state = core.createState(route);
    const complete = (id, choice = 0) => {
      core.startEvent(route, state, id);
      while (core.advanceLine(route, state)) {}
      core.choose(route, state, choice);
      state = core.hydrateState(route, core.serializeState(state));
    };
    const collect = (id) => { if (selected.includes(id)) { if (cores[id]) core.readMessage(route, state, cores[id]); complete(id); } };
    for (const id of ['awake', 'terminal', 'black_gate', 'school_start', 'students', 'sybille']) complete(id);
    collect('school_core'); complete('area_choice', areaChoice);
    for (const area of areaChoice === 0 ? ['downtown', 'old_town'] : ['old_town', 'downtown']) { complete(area); collect(area + '_core'); }
    for (const area of ['research', 'bay_side', 'old_city', 'harbor']) { complete(area + '_area'); collect(area + '_core'); }
    complete('final', finalChoice);
    const endingEvent = core.availableEvents(route, state, 'final')[0];
    assert.ok(endingEvent); complete(endingEvent.id);
    assert.equal(state.vars.black_cores, expectedCount);
    assert.equal(core.resolveEnding(route, state).id, expectedEnding);
    console.log(JSON.stringify({ areaChoice, cores: expectedCount, finalChoice, ending: expectedEnding, events: state.log.filter(x => x.startsWith('event:')).length }));
  }
}
console.log('Private route: 8 paths passed with save/restore after every event.');
