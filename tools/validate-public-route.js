const fs = require("fs");
const path = require("path");
const core = require("../packages/story-core");

const root = path.resolve(__dirname, "..");
const route = JSON.parse(fs.readFileSync(path.join(root, "data", "routes", "public-demo.json"), "utf8"));
const result = core.validateRoute(route);
if (!result.ok) throw new Error(result.errors.join(", "));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const state = core.createState(route);
let events = core.availableEvents(route, state, "court");
assert(events.length === 1 && events[0].id === "start", "opening event unavailable");
core.startEvent(route, state, "start");
while (core.advanceLine(route, state)) {}
core.choose(route, state, 0);
assert(core.availableMessages(route, state).length === 1, "message did not unlock");
core.readMessage(route, state, "mail_1");
assert(core.availableEvents(route, state, "school").length === 1, "school event did not unlock");
core.startEvent(route, state, "school");
while (core.advanceLine(route, state)) {}
core.choose(route, state, 0);
assert(core.availableEvents(route, state, "tower").length === 1, "ending event did not unlock");
core.startEvent(route, state, "ending");
while (core.advanceLine(route, state)) {}
core.choose(route, state, 0);
assert(core.resolveEnding(route, state).id === "public_demo_end", "ending did not resolve");

const restored = core.hydrateState(route, core.serializeState(state));
assert(core.resolveEnding(route, restored).id === "public_demo_end", "state restore failed");
console.log("public route checks ok: shared core, message unlock, ending, restore");
