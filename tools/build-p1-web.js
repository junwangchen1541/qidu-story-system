// Private text/media are read from the user's archive, never embedded here.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, write, copyTree, contentSource } = require('./build');
const core = require('../packages/story-core');

function applyCorrections(item, corrections) {
  let text = item.reading_text;
  for (const patch of corrections.filter(entry => entry.event === item.id)) {
    if (text.includes(patch.before)) text = text.replace(patch.before, patch.after);
  }
  return text;
}

function mapP2Groups(groups, corrections = [], lastIncludedId = 'P2-D0013') {
  const start = groups.findIndex(group => group.id === lastIncludedId);
  if (start < 0) throw Error(`P2 overlap boundary ${lastIncludedId} is missing`);
  const records = groups.slice(start + 1).map(group => {
    const entries = group.events.slice().sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
    const lines = entries.map(item => ({
      text: applyCorrections(item, corrections), start_ms: item.start_ms, source_event_id: item.id,
      proof_status: item.proof_status, client_ref: item.client
    }));
    const speaker = entries.map(item => item.speaker).find(Boolean) || '';
    return {
      scene_id: group.id, part: 'P2', start_ms: group.start_ms, end_ms: group.end_ms,
      source_group_ids: [group.id],
      speaker, text: lines.map(line => line.text).filter(Boolean).join('\n'),
      options: entries.filter(item => item.is_option).map(item => ({ id: item.id, text: applyCorrections(item, corrections) })),
      kind: group.kind, presentation: 'text',
      proof_status: [...new Set(entries.map(item => item.proof_status))],
      source_event_ids: entries.map(item => item.id),
      client_refs: entries.map(item => item.client).filter(Boolean), lines
    };
  });
  const pages = [];
  for (const record of records) {
    const previous = pages.at(-1);
    if (previous && record.start_ms < previous.end_ms && !previous.options.length && !record.options.length && previous.speaker === record.speaker) {
      previous.end_ms = Math.max(previous.end_ms, record.end_ms);
      previous.text += '\n' + record.text;
      previous.lines.push(...record.lines);
      previous.source_group_ids.push(...record.source_group_ids);
      previous.source_event_ids.push(...record.source_event_ids);
      previous.client_refs.push(...record.client_refs);
      previous.proof_status = [...new Set([...previous.proof_status, ...record.proof_status])];
    } else pages.push(record);
  }
  return pages;
}

function build(materials) {
  const legacy = path.resolve(materials, '11_剧情系统复现/demo_web');
  const masterFile = path.join(legacy, '剧情主数据_P1.json');
  const master = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
  const original = fs.readFileSync(path.join(legacy, 'index.html'), 'utf8');
  const start = original.indexOf('const assets = ');
  const end = original.indexOf('const route =', start);
  if (start < 0 || end < 0) throw Error('Legacy asset map is missing');
  const assets = vm.runInNewContext(original.slice(start, end) + '\nassets;', {}, { timeout: 1000 });
  const source = (r) => ({ video: master.url, start_ms: r.start_ms, end_ms: r.end_ms,
    source_event_ids: r.source_event_ids, proof_status: r.proof_status, client_refs: r.client_refs });
  const pages = [];
  for (const record of master.records.filter(r => r.presentation === 'text')) {
    const previous = pages.at(-1);
    // Two OCR groups can be fragments of the same simultaneously visible page.
    if (previous && record.start_ms < previous.end_ms && !previous.options.length && !record.options.length && previous.speaker === record.speaker) {
      previous.end_ms = Math.max(previous.end_ms, record.end_ms);
      previous.text += '\n' + record.text;
      previous.lines.push(...record.lines);
      previous.source_event_ids.push(...record.source_event_ids);
      previous.client_refs.push(...record.client_refs);
      previous.proof_status = [...new Set([...previous.proof_status, ...record.proof_status])];
    } else pages.push(JSON.parse(JSON.stringify(record)));
  }
  const events = pages.map(r => {
    const awake = r.start_ms >= 379000;
    return {
      id: r.scene_id, title: r.scene_id, label: '', location: 'prologue', bg: awake ? 'awake' : '', cast: {},
      conditions: [], autoAdvance: r.options.length === 0,
      source: source(r), sourceTime: { start_ms: r.start_ms, end_ms: r.end_ms },
      lines: [{ text: r.text, speaker: r.speaker, ...(awake ? {} : { screen: 'black_title' }),
        durationMs: Math.max(2800, r.end_ms - r.start_ms, r.text.length * 135),
        reveal: r.lines.map(line => ({ text: line.text, delayMs: Math.max(0, line.start_ms - r.start_ms) })) }],
      choices: r.options.length ? r.options.map(o => ({ text: o.text, effects: [{ type: 'set_variable', name: r.scene_id, value: o.id }] }))
        : [{ text: '→', effects: [] }]
    };
  });
  const footage = master.records.filter(r => r.presentation === 'video');
  const before = events.findIndex(e => e.source.start_ms > footage[0].start_ms);
  events.splice(before, 0, {
    id: 'p1-footage', title: 'P1', label: '', location: 'prologue', conditions: [], cast: {}, autoAdvance: true,
    source: { video: master.url, groups: footage.map(r => r.scene_id), source_event_ids: footage.flatMap(r => r.source_event_ids) },
    lines: [{ text: '', video: { id: 'p1', start: 93.167, end: 349.367 } }],
    choices: [{ text: '→', effects: [] }]
  });
  const p2Dir = path.resolve(materials, '07_视频/OCR结果/P1-P3整理稿_20261101/P2');
  const groups = fs.readFileSync(path.join(p2Dir, '阅读分组.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const corrections = JSON.parse(fs.readFileSync(path.join(p2Dir, '校对修改记录.json'), 'utf8'));
  const p2 = mapP2Groups(groups, corrections);
  const parts = JSON.parse(fs.readFileSync(path.resolve(materials, '07_视频/OCR结果/P1-P3整理稿_20261101/汇总.json'), 'utf8'));
  const p2Video = parts.find(part => part.url.endsWith('p=2')).video;
  const p2Source = 'https://www.bilibili.com/video/BV17M4y1w7rr?p=2';
  const p2Events = p2.map(record => {
    const lastRevealMs = Math.max(0, ...record.lines.map(line => line.start_ms - record.start_ms));
    // Keep the reading interval, not the recording's idle/map/battle gap.
    const durationMs = Math.max(2800, record.end_ms - record.start_ms, record.text.length * 135, lastRevealMs + 1800);
    return {
      id: record.scene_id, title: record.scene_id, label: '', location: 'prologue', bg: record.start_ms < 119000 ? 'awake' : '',
      cast: record.start_ms >= 119000 && assets.portrait[record.speaker] ? { center: record.speaker } : {}, conditions: [], autoAdvance: !record.options.length,
      source: { video: p2Source, start_ms: record.start_ms, end_ms: record.end_ms,
        source_group_ids: record.source_group_ids, source_event_ids: record.source_event_ids,
        proof_status: record.proof_status, client_refs: record.client_refs },
      sourceTime: { start_ms: record.start_ms, end_ms: record.end_ms },
      lines: [{ text: record.text, speaker: record.speaker,
        durationMs, reveal: record.lines.map(line => ({ text: line.text, delayMs: Math.max(0, line.start_ms - record.start_ms) })) }],
      choices: record.options.length ? record.options.map(option => ({ text: option.text, effects: [] })) : [{ text: '→', effects: [] }]
    };
  });
  events.push(...p2Events);
  events.forEach((event, index) => {
    event.conditions = [{ type: 'flag_not_set', flag: event.id + ':done' }];
    if (index) event.conditions.push({ type: 'flag_set', flag: events[index - 1].id + ':done' });
    if (index + 1 < events.length) event.nextEventId = events[index + 1].id;
    else delete event.nextEventId;
    event.choices.forEach(choice => choice.effects.push({ type: 'set_flag', flag: event.id + ':done' }));
  });
  const route = {
    meta: { id: 'p1-cinematic', title: master.title, revision: '2026-11-02.1', compatibleSaveRevisions: ['2026-11-01.1'],
      continuedEndings: { 'p1-end': p2[0].scene_id },
      timeline: events.map(e => e.id), source: master.url,
      parts: [{ id: 'P1', source: master.url }, { id: 'P2', source: p2Source, video: p2Video, records: p2.length, skippedOverlap: 'P2-D0001..P2-D0013' }] },
    initial: { flags: [], vars: {} }, locations: [{ id: 'prologue', name: master.title, x: 50, y: 50 }],
    events, messages: [], endings: [{ id: 'p1-end', title: '待续', text: '', conditions: [{ type: 'flag_set', flag: events.at(-1).id + ':done' }] }]
  };
  const checked = core.validateRoute(route);
  if (!checked.ok) throw Error(checked.errors.join('\n'));
  const output = path.join(root, 'build_private/p1-web');
  copyTree(path.join(root, 'apps/web'), output, file => !/[/\\]content\.js$/.test(file));
  copyTree(path.join(root, 'packages/story-core'), path.join(output, 'shared'));
  const localAssets = { bg: {}, portrait: {}, audio: {}, video: { p1: './assets/p1.mp4' } };
  fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
  // Keep the full unmodified file locally: frame-accurate start/end are in route data.
  fs.copyFileSync(master.video, path.join(output, 'assets/p1.mp4'));
  for (const id of ['awake']) {
    const file = path.resolve(legacy, assets.bg[id]);
    const name = id + path.extname(file);
    fs.copyFileSync(file, path.join(output, 'assets', name));
    localAssets.bg[id] = './assets/' + name;
  }
  const speakers = new Set(p2.map(record => record.speaker).filter(Boolean));
  for (const speaker of speakers) {
    const relative = assets.portrait[speaker];
    if (!relative) continue;
    const file = path.resolve(legacy, relative);
    if (!fs.existsSync(file)) continue;
    const name = 'portrait-' + path.basename(file);
    fs.copyFileSync(file, path.join(output, 'assets', name));
    localAssets.portrait[speaker] = './assets/' + name;
  }
  let html = fs.readFileSync(path.join(root, 'apps/web/index.html'), 'utf8')
    .replace('../../packages/story-core/index.js', './shared/index.js')
    .replace('../../packages/story-core/session.js', './shared/session.js');
  write(path.join(output, 'index.html'), html);
  write(path.join(output, 'content.js'), contentSource({ route, assets: localAssets }, true));
  write(path.join(output, 'route.json'), JSON.stringify(route, null, 2));
  write(path.join(legacy, '剧情路线_P1.json'), JSON.stringify(route, null, 2));
  // Update the original entry in place, preserving its embedded mainline and URL.
  // ?route=mainline keeps access to the previous prototype.
  write(path.join(legacy, 'p1-content.js'), 'if (new URLSearchParams(location.search).get("route") !== "mainline") {\n' +
    contentSource({ route, assets: { bg: assets.bg, portrait: assets.portrait, audio: {}, video: { p1: path.relative(legacy, master.video).split(path.sep).join('/') } } }, true) + '}\n');
  let legacyHtml = original.replace(/\s*<script src="\.\/p1-content\.js"><\/script>/g, '');
  legacyHtml = legacyHtml.replace('<script src="./app.js"></script>', '<script src="./p1-content.js"></script>\n  <script src="./app.js"></script>');
  write(path.join(legacy, 'index.html'), legacyHtml);
  for (const file of ['app.js', 'styles.css']) fs.copyFileSync(path.join(root, 'apps/web', file), path.join(legacy, file));
  copyTree(path.join(root, 'packages/story-core'), path.join(legacy, 'shared'));
  console.log(JSON.stringify({ output, events: events.length, questions: events.filter(e => !e.autoAdvance).length,
    p1Records: master.records.length, p2Records: p2.length, p2First: p2[0].scene_id, p2Last: p2.at(-1).scene_id }));
}
if (require.main === module) {
  if (!process.argv[2]) throw Error('Usage: node tools/build-p1-web.js <private-materials-root>');
  build(process.argv[2]);
}
module.exports = { build, mapP2Groups, applyCorrections };
