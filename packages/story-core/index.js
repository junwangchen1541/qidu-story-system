(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.StoryCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function createState(route) {
    return {
      version: 1,
      routeId: route.meta.id,
      revision: route.meta.revision,
      flags: new Set((route.initial && route.initial.flags) || []),
      vars: clone((route.initial && route.initial.vars) || {}),
      eventId: null,
      lineIndex: 0,
      endingId: null,
      log: []
    };
  }

  function hydrateState(route, snapshot) {
    const state = createState(route);
    if (!snapshot) return state;
    if (snapshot.version !== 1 || snapshot.routeId !== route.meta.id || snapshot.revision !== route.meta.revision) {
      throw new Error("save version or route mismatch");
    }
    if (!Array.isArray(snapshot.flags) || !snapshot.flags.every((flag) => typeof flag === "string") ||
        !snapshot.vars || typeof snapshot.vars !== "object" || Array.isArray(snapshot.vars) ||
        !Number.isInteger(snapshot.lineIndex) || snapshot.lineIndex < 0) throw new Error("invalid save");
    const event = snapshot.eventId && findEvent(route, snapshot.eventId);
    if (snapshot.eventId && (!event || snapshot.lineIndex >= event.lines.length)) throw new Error("invalid saved event");
    if (snapshot.endingId && !findEnding(route, snapshot.endingId)) throw new Error("invalid saved ending");
    state.flags = new Set(snapshot.flags || []);
    state.vars = Object.assign({}, state.vars, clone(snapshot.vars));
    state.eventId = snapshot.eventId || null;
    state.lineIndex = Number.isInteger(snapshot.lineIndex) ? snapshot.lineIndex : 0;
    state.endingId = snapshot.endingId || null;
    state.log = Array.isArray(snapshot.log) ? snapshot.log.slice() : [];
    if (event && !conditionsMet(state, event.conditions)) throw new Error("saved event unavailable");
    const ending = resolveEnding(route, state);
    if (snapshot.endingId && !conditionsMet(state, ending.conditions)) throw new Error("saved ending unavailable");
    return state;
  }

  function serializeState(state) {
    return {
      version: state.version,
      routeId: state.routeId,
      revision: state.revision,
      flags: Array.from(state.flags),
      vars: clone(state.vars),
      eventId: state.eventId,
      lineIndex: state.lineIndex,
      endingId: state.endingId,
      log: state.log.slice()
    };
  }

  function hasFlag(state, flag) {
    return state.flags.has(flag);
  }

  function checkCondition(state, condition) {
    if (!condition) return true;
    switch (condition.type) {
      case "flag_set":
        return hasFlag(state, condition.flag);
      case "flag_not_set":
        return !hasFlag(state, condition.flag);
      case "any_flag_set":
        return (condition.flags || []).some((flag) => hasFlag(state, flag));
      case "all_flags_set":
        return (condition.flags || []).every((flag) => hasFlag(state, flag));
      case "variable_eq":
        return state.vars[condition.name] === condition.value;
      case "variable_gte":
        return Number(state.vars[condition.name]) >= Number(condition.value);
      case "variable_gt":
        return Number(state.vars[condition.name]) > Number(condition.value);
      case "variable_lte":
        return Number(state.vars[condition.name]) <= Number(condition.value);
      case "variable_lt":
        return Number(state.vars[condition.name]) < Number(condition.value);
      case "and":
        return (condition.conditions || []).every((item) => checkCondition(state, item));
      case "or":
        return (condition.conditions || []).some((item) => checkCondition(state, item));
      default:
        throw new Error("unknown condition type: " + condition.type);
    }
  }

  function conditionsMet(state, conditions) {
    return (conditions || []).every((condition) => checkCondition(state, condition));
  }

  function applyEffect(state, effect) {
    switch (effect.type) {
      case "set_flag":
        state.flags.add(effect.flag);
        break;
      case "unset_flag":
        state.flags.delete(effect.flag);
        break;
      case "set_variable":
        state.vars[effect.name] = effect.value;
        break;
      case "add_variable":
        state.vars[effect.name] = Number(state.vars[effect.name] || 0) + Number(effect.value || 0);
        break;
      case "set_ending":
        state.endingId = effect.endingId;
        break;
      default:
        throw new Error("unknown effect type: " + effect.type);
    }
  }

  function findEvent(route, eventId) {
    return (route.events || []).find((event) => event.id === eventId) || null;
  }

  function findMessage(route, messageId) {
    return (route.messages || []).find((message) => message.id === messageId) || null;
  }

  function findEnding(route, endingId) {
    return (route.endings || []).find((ending) => ending.id === endingId) || null;
  }

  function availableEvents(route, state, locationId) {
    if (resolveEnding(route, state)) return [];
    return (route.events || []).filter((event) => {
      return (!state.eventId || state.eventId === event.id) && (!locationId || event.location === locationId) && conditionsMet(state, event.conditions);
    });
  }

  function availableMessages(route, state) {
    return (route.messages || []).filter((message) => conditionsMet(state, message.unlock));
  }

  function startEvent(route, state, eventId) {
    if (resolveEnding(route, state)) throw new Error("story already ended");
    if (state.eventId && state.eventId !== eventId) throw new Error("another event is active");
    const event = findEvent(route, eventId);
    if (!event) throw new Error("event not found: " + eventId);
    if (!conditionsMet(state, event.conditions)) throw new Error("event unavailable: " + eventId);
    if (state.eventId === eventId) return event;
    state.eventId = event.id;
    state.lineIndex = 0;
    state.log.push("event:" + event.id);
    return event;
  }

  function currentEvent(route, state) {
    return state.eventId ? findEvent(route, state.eventId) : null;
  }

  function currentLine(route, state) {
    const event = currentEvent(route, state);
    return event && event.lines ? event.lines[state.lineIndex] || null : null;
  }

  function advanceLine(route, state) {
    const event = currentEvent(route, state);
    if (!event) return false;
    if (state.lineIndex >= (event.lines || []).length - 1) return false;
    state.lineIndex += 1;
    return true;
  }

  function choose(route, state, choiceIndex) {
    const event = currentEvent(route, state);
    if (!event) throw new Error("no active event");
    if (state.lineIndex !== event.lines.length - 1) throw new Error("dialogue is not finished");
    if (!Number.isInteger(choiceIndex)) throw new Error("invalid choice index");
    const choice = (event.choices || [])[choiceIndex];
    if (!choice) throw new Error("choice not found: " + choiceIndex);
    (choice.effects || []).forEach((effect) => applyEffect(state, effect));
    state.log.push("choice:" + event.id + ":" + choiceIndex);
    state.eventId = null;
    state.lineIndex = 0;
    const ending = resolveEnding(route, state);
    state.endingId = ending ? ending.id : null;
    return choice;
  }

  function readMessage(route, state, messageId) {
    const message = findMessage(route, messageId);
    if (!message) throw new Error("message not found: " + messageId);
    if (hasFlag(state, message.readFlag)) return message;
    if (resolveEnding(route, state)) throw new Error("story already ended");
    if (!conditionsMet(state, message.unlock)) throw new Error("message unavailable: " + messageId);
    if (message.readFlag) state.flags.add(message.readFlag);
    (message.effects || []).forEach((effect) => applyEffect(state, effect));
    state.log.push("message:" + message.id);
    return message;
  }

  function resolveEnding(route, state) {
    if (state.endingId) return findEnding(route, state.endingId);
    return (route.endings || []).find((ending) => conditionsMet(state, ending.conditions)) || null;
  }

  function validateRoute(route) {
    const errors = [];
    if (!route || typeof route !== "object") return { ok: false, errors: ["invalid route"] };
    const string = (v) => typeof v === "string" && v.length > 0;
    if (!route.meta || !string(route.meta.id) || !string(route.meta.revision)) errors.push("invalid meta");
    if (!route.initial || !Array.isArray(route.initial.flags) || !route.initial.flags.every(string) ||
        !route.initial.vars || typeof route.initial.vars !== "object" || Array.isArray(route.initial.vars)) errors.push("invalid initial");
    for (const key of ["locations", "events", "messages", "endings"]) {
      if (!Array.isArray(route[key]) || route[key].some((item) => !item || typeof item !== "object")) errors.push("invalid array:" + key);
    }
    if (errors.length) return { ok: false, errors };
    function conditions(items) {
      if (!Array.isArray(items)) { errors.push("invalid conditions"); return; }
      items.forEach((c) => {
        if (!c || typeof c !== "object") { errors.push("invalid condition"); return; }
        if (["flag_set", "flag_not_set"].includes(c.type)) { if (!string(c.flag)) errors.push("invalid flag condition"); }
        else if (["any_flag_set", "all_flags_set"].includes(c.type)) { if (!Array.isArray(c.flags) || !c.flags.every(string)) errors.push("invalid flags condition"); }
        else if (["variable_eq", "variable_gte", "variable_gt", "variable_lte", "variable_lt"].includes(c.type)) {
          if (!string(c.name) || c.value === undefined || (c.type !== "variable_eq" && !Number.isFinite(c.value))) errors.push("invalid variable condition");
        } else if (["and", "or"].includes(c.type)) conditions(c.conditions);
        else errors.push("unknown condition:" + c.type);
      });
    }
    function effects(items) {
      if (!Array.isArray(items)) { errors.push("invalid effects"); return; }
      items.forEach((e) => {
        if (!e || typeof e !== "object") { errors.push("invalid effect"); return; }
        if (["set_flag", "unset_flag"].includes(e.type)) { if (!string(e.flag)) errors.push("invalid flag effect"); }
        else if (["set_variable", "add_variable"].includes(e.type)) {
          if (!string(e.name) || e.value === undefined || (e.type === "add_variable" && !Number.isFinite(e.value))) errors.push("invalid variable effect");
        } else if (e.type === "set_ending") { if (!route.endings.some((end) => end.id === e.endingId)) errors.push("unknown ending reference"); }
        else errors.push("unknown effect:" + e.type);
      });
    }
    ["initial", "locations", "events", "messages", "endings"].forEach((key) => {
      if (route[key] === undefined) errors.push("missing:" + key);
    });
    const ids = [];
    ["locations", "events", "messages", "endings"].forEach((key) => {
      (route[key] || []).forEach((item) => {
        if (!string(item.id)) errors.push(key + ":missing-id");
        ids.push(key + ":" + item.id);
      });
    });
    if (new Set(ids).size !== ids.length) errors.push("duplicate-id");
    (route.events || []).forEach((event) => {
      if (!route.locations.some((loc) => loc.id === event.location)) errors.push("unknown location:" + event.id);
      conditions(event.conditions);
      if (!Array.isArray(event.lines) || !event.lines.length || event.lines.some((line) => !line || typeof line.text !== "string")) errors.push("event-lines:" + event.id);
      if (!Array.isArray(event.choices) || !event.choices.length) errors.push("event-choices:" + event.id);
      else event.choices.forEach((choice) => {
        if (!choice || !string(choice.text)) errors.push("invalid choice:" + event.id);
        else effects(choice.effects);
      });
    });
    route.messages.forEach((m) => { if (!string(m.readFlag)) errors.push("missing readFlag"); conditions(m.unlock); effects(m.effects || []); });
    route.endings.forEach((e) => conditions(e.conditions));
    return { ok: errors.length === 0, errors };
  }

  return {
    clone,
    createState,
    hydrateState,
    serializeState,
    hasFlag,
    checkCondition,
    conditionsMet,
    applyEffect,
    findEvent,
    findMessage,
    findEnding,
    availableEvents,
    availableMessages,
    startEvent,
    currentEvent,
    currentLine,
    advanceLine,
    choose,
    readMessage,
    resolveEnding,
    validateRoute
  };
});
