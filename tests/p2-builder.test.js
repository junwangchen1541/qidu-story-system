const test = require('node:test');
const assert = require('node:assert/strict');
const { mapP2Groups } = require('../tools/build-p1-web');

test('P2 timeline resumes after the P1 overlap and retains source evidence', () => {
  const groups = [
    { id: 'P2-D0013', start_ms: 100, end_ms: 150, kind: '对白候选', events: [
      { id: 'E13', start_ms: 100, reading_text: 'overlap', speaker: '', is_option: false, proof_status: 'OCR待核', client: null, box: [0, 0, 1, 1] }
    ] },
    { id: 'P2-D0014', start_ms: 200, end_ms: 260, kind: '对白候选', events: [
      { id: 'E14', start_ms: 210, reading_text: 'before', speaker: '安', is_option: false, proof_status: '客户端同字片段', client: { line: 7 }, box: [0, 0, 1, 1] }
    ] },
    { id: 'P2-D0015', start_ms: 240, end_ms: 330, kind: '对白候选', events: [
      { id: 'E15', start_ms: 240, reading_text: 'next', speaker: '安', is_option: false, proof_status: 'OCR待核', client: null, box: [0, 0, 1, 1] }
    ] }
  ];
  const records = mapP2Groups(groups, [{ event: 'E14', before: 'before', after: 'corrected' }]);
  assert.deepEqual(records.map(record => record.scene_id), ['P2-D0014']);
  assert.equal(records[0].text, 'corrected\nnext');
  assert.deepEqual(records[0].source_group_ids, ['P2-D0014', 'P2-D0015']);
  assert.deepEqual(records[0].source_event_ids, ['E14', 'E15']);
  assert.equal(records[0].client_refs[0].line, 7);
  assert.equal(records[0].lines[0].proof_status, '客户端同字片段');
});
