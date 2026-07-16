const assert = require('assert');
const {
  isFinalized,
  isReadyToSend,
  readinessReason,
  validationIssues
} = require('../assets/js/publication-basis-validation');

function baseRow(overrides = {}) {
  return {
    tos_slug: 'bogana',
    wave: '1',
    priority: 'P0-1',
    score: '99',
    template_id: 'publication-basis-wave-1',
    request_status: 'draft',
    recipient_role: '',
    channel_type: '',
    owner_role: '',
    sent_date: '',
    follow_up_date: '',
    response_date: '',
    reviewed_at: '',
    reviewed_by_role: '',
    chairperson_status: '',
    field_types_to_keep: '',
    field_types_to_remove: '',
    preferred_public_channel_type: '',
    personal_profile_classification: '',
    factual_source_ref: '',
    decision_status: 'not_reviewed',
    blocker: 'не определён канал',
    next_step: 'определить канал и ответственного',
    ...overrides
  };
}

const draft = baseRow();
assert.deepStrictEqual(validationIssues(draft), []);
assert.strictEqual(isReadyToSend(draft), false);
assert.match(readinessReason(draft), /роль получателя/);

const ready = baseRow({
  recipient_role: 'tos_representative',
  channel_type: 'social_message',
  owner_role: 'editor'
});
assert.deepStrictEqual(validationIssues(ready), []);
assert.strictEqual(isReadyToSend(ready), true);
assert.strictEqual(readinessReason(ready), 'готово к фактической отправке');

const sent = baseRow({
  request_status: 'sent',
  recipient_role: 'tos_representative',
  channel_type: 'social_message',
  owner_role: 'editor',
  sent_date: '2026-07-16',
  follow_up_date: '2026-07-23'
});
assert.deepStrictEqual(validationIssues(sent), []);

assert.ok(validationIssues({ ...sent, follow_up_date: '' }).some((issue) => issue.includes('follow_up_date')));
assert.ok(validationIssues({ ...sent, owner_role: '' }).some((issue) => issue.includes('owner_role')));
assert.ok(validationIssues({ ...sent, response_date: '2026-07-17' }).some((issue) => issue.includes('не допускает результат')));

const receivedUnreviewed = {
  ...sent,
  request_status: 'received',
  response_date: '2026-07-18'
};
assert.deepStrictEqual(validationIssues(receivedUnreviewed), []);
assert.strictEqual(isFinalized(receivedUnreviewed), false);

const receivedReviewed = {
  ...receivedUnreviewed,
  reviewed_at: '2026-07-19',
  reviewed_by_role: 'editor',
  chairperson_status: 'confirmed_current',
  field_types_to_keep: 'chairperson;community_links',
  personal_profile_classification: 'official_community',
  factual_source_ref: 'evidence-pb-bogana-001',
  decision_status: 'keep_current'
};
assert.deepStrictEqual(validationIssues(receivedReviewed), []);
assert.strictEqual(isFinalized(receivedReviewed), true);

assert.ok(validationIssues({ ...receivedReviewed, factual_source_ref: '' }).some((issue) => issue.includes('factual_source_ref')));
assert.ok(validationIssues({ ...receivedReviewed, field_types_to_remove: 'chairperson' }).some((issue) => issue.includes('одновременно')));
assert.ok(validationIssues({ ...receivedReviewed, reviewed_at: '2026-07-17' }).some((issue) => issue.includes('раньше response_date')));

const clarification = {
  ...receivedUnreviewed,
  request_status: 'needs_clarification',
  reviewed_at: '2026-07-19',
  reviewed_by_role: 'editor',
  decision_status: 'no_change_without_evidence'
};
assert.deepStrictEqual(validationIssues(clarification), []);
assert.ok(validationIssues({ ...clarification, field_types_to_remove: 'phones' }).some((issue) => issue.includes('не допускает окончательное решение')));

const closed = {
  ...sent,
  request_status: 'closed_without_response',
  reviewed_at: '2026-07-30',
  reviewed_by_role: 'editor',
  field_types_to_remove: 'chairperson;phones',
  decision_status: 'hide_until_confirmed'
};
assert.deepStrictEqual(validationIssues(closed), []);
assert.strictEqual(isFinalized(closed), true);
assert.ok(validationIssues({ ...closed, factual_source_ref: 'fake-source' }).some((issue) => issue.includes('не создаёт factual_source_ref')));

assert.ok(validationIssues(baseRow({ sent_date: '2026-07-16' })).some((issue) => issue.includes('draft не допускает sent_date')));
assert.ok(validationIssues(baseRow({ template_id: 'publication-basis-wave-2' })).some((issue) => issue.includes('template_id')));
assert.ok(validationIssues(baseRow({ recipient_role: 'Иван Иванов' })).some((issue) => issue.includes('обезличенный системный код')));

console.log('Publication basis execution validation self-test OK');
