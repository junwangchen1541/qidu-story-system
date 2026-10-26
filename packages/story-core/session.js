(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./index.js"));
  else root.StorySession = factory(root.StoryCore);
})(typeof self !== "undefined" ? self : this, function (core) {
  "use strict";
  // Shared view-model: platform adapters only render this JSON and forward actions.
  function createSession(route, storage, assets) {
    const checked = core.validateRoute(route);
    if (!checked.ok) throw new Error(checked.errors.join(", "));
    assets = assets || { bg: {}, portrait: {}, audio: {} };
    const key = "qidu:save:v1:" + route.meta.id;
    let story;
    let notice = "";
    try { story = core.hydrateState(route, storage && storage.load(key)); }
    catch (_) { story = core.createState(route); notice = "存档版本不兼容或已损坏，已从开场重新开始。"; }
    let mode = core.resolveEnding(route, story) ? "ending" : story.eventId ? "scene" : "map";
    let drawer = false;
    function persist() {
      try { if (storage) storage.save(key, core.serializeState(story)); }
      catch (_) { notice = "存档未能写入；本次仍可继续游玩。"; }
    }
    function view() {
      const event = core.currentEvent(route, story);
      const line = core.currentLine(route, story);
      const ending = core.resolveEnding(route, story);
      const cast = event && event.cast || {};
      const speaker = line && line.speaker || "";
      const atEnd = event && story.lineIndex === event.lines.length - 1;
      return {
        mode, drawer, notice,
        title: route.meta.title || "剧情系统",
        locations: route.locations.map((location) => {
          const events = core.availableEvents(route, story, location.id);
          return Object.assign({}, location, { available: !!events.length, eventId: events.length ? events[0].id : "", eventTitle: events.length ? events[0].title : "" });
        }),
        messages: core.availableMessages(route, story).map((m) => Object.assign({}, m, { read: core.hasFlag(story, m.readFlag) })),
        eventId: event ? event.id : "",
        label: ending ? "ENDING" : event ? event.label || event.title : "",
        line: line || { text: "" },
        lineKey: event ? event.id + ":" + story.lineIndex : "",
        lineIndex: story.lineIndex,
        black: !!(mode === "scene" && line && line.screen === "black_title"),
        speaker: speaker || "旁白",
        portraits: ["left", "center", "right"].map((side) => ({ side, name: cast[side] || "", src: (assets.portrait || {})[cast[side]] || "", inactive: !!speaker && speaker !== "指挥使" && speaker !== cast[side] })).filter((p) => p.name),
        bg: (assets.bg || {})[ending ? ending.bg : event ? event.bg : ""] || "",
        hasNext: !!event && !atEnd,
        choices: atEnd ? event.choices.map((choice, index) => ({ text: choice.text, index })) : [],
        ending: ending || null,
        coreCount: story.vars.black_cores === undefined ? null : story.vars.black_cores,
        maxCores: route.meta.maxBlackCores || null,
        effects: mode === "scene" && line ? line.effects || (line.effect ? [line.effect] : []) : [],
        audio: mode === "scene" && line ? line.audio || [] : []
      };
    }
    function act(action, value) {
      switch (action) {
        case "open": core.startEvent(route, story, value); mode = "scene"; drawer = false; break;
        case "next": if (mode === "scene") core.advanceLine(route, story); break;
        case "choose":
          if (mode !== "scene") throw new Error("not in scene");
          core.choose(route, story, Number(value));
          mode = core.resolveEnding(route, story) ? "ending" : "map";
          break;
        case "read": core.readMessage(route, story, value); break;
        case "map": mode = core.resolveEnding(route, story) ? "ending" : "map"; drawer = false; break;
        case "terminal": drawer = !drawer; break;
        case "reset": story = core.createState(route); mode = "map"; drawer = false; notice = ""; break;
        default: throw new Error("unknown action: " + action);
      }
      persist();
      return view();
    }
    return { view, act, snapshot: () => core.serializeState(story), assets };
  }
  return { createSession };
});
