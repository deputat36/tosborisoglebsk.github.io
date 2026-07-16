const assert = require('assert');
const fs = require('fs');
const path = require('path');
const execution = require('../assets/js/outreach-execution');

const ROOT = process.cwd();
const readRows = (relativePath) => execution.parseCsv(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));

const register = readRows('data/outreach_register.csv');
const sources = {
  priority: readRows('data/priority_tos_requests.csv'),
  candidates: readRows('data/candidate_registry_requests.csv'),
  projects: readRows('data/projects_2026_result_requests.csv')
};
const drafts = register.filter((item) => item.status === 'draft');
const resolved = register.find((item) => item.status === 'resolved');

assert.strictEqual(register.length, 16, 'outreach register must contain 16 rows');
assert.strictEqual(drafts.length, 15, 'outreach register must contain 15 draft rows');
assert.ok(resolved, 'one resolved row is required');

const groupCounts = drafts.reduce((result, item) => {
  result[item.request_group] = (result[item.request_group] || 0) + 1;
  return result;
}, {});
assert.deepStrictEqual(groupCounts, {
  registry: 1,
  priority_card: 4,
  candidate_registry: 5,
  project_result: 5
});

for (const item of drafts) {
  const text = execution.buildRequestText(item, sources);
  assert.ok(text.length > 80, `${item.outreach_id} must resolve to a usable request text`);
}

const candidateItem = drafts.find((item) => item.source_request_id === 'cand-req-001');
const candidateSource = sources.candidates.find((item) => item.request_id === 'cand-req-001');
assert.strictEqual(execution.buildRequestText(candidateItem, sources), candidateSource.request_text);

const projectItem = drafts.find((item) => item.source_request_id === 'req-2026-002');
const projectSource = sources.projects.find((item) => item.request_id === 'req-2026-002');
assert.strictEqual(execution.buildRequestText(projectItem, sources), projectSource.request_text);

const priorityItem = drafts.find((item) => item.source_request_id === 'gubari');
const priorityText = execution.buildRequestText(priorityItem, sources);
assert.ok(priorityText.includes('ТОС «Губари»'));
assert.ok(priorityText.includes('Публичный телефон'));
assert.ok(priorityText.includes('какие данные можно разместить публично'));

const registryItem = drafts.find((item) => item.request_group === 'registry');
assert.ok(execution.buildRequestText(registryItem, sources).includes('актуальный открытый список ТОС БГО'));

const preflightDraft = {
  channel: 'официальная форма',
  contact: 'профильный отдел',
  owner: 'координатор',
  evidence_ref: '',
  note: 'проверить адрес перед отправкой',
  actual_sent: false
};
const preflightValidation = execution.validateExecution(registryItem, preflightDraft);
assert.strictEqual(preflightValidation.valid, true);
assert.strictEqual(preflightValidation.actualSent, false);
assert.ok(execution.buildPreflightText(registryItem, execution.buildRequestText(registryItem, sources), preflightDraft).includes('не подтверждена'));

const incompleteSent = execution.validateExecution(registryItem, { actual_sent: true });
assert.strictEqual(incompleteSent.valid, false);
assert.ok(incompleteSent.errors.length >= 5);

const validSentDraft = {
  channel: 'официальная форма',
  contact: 'профильный отдел администрации',
  owner: 'координатор портала',
  sent_date: '2026-07-16',
  follow_up_date: '2026-07-23',
  evidence_ref: 'evidence:out-001-send-2026-07-16',
  note: 'след хранится вне публичного репозитория',
  actual_sent: true
};
const validSent = execution.validateExecution(registryItem, validSentDraft);
assert.deepStrictEqual(validSent, { valid: true, actualSent: true, errors: [] });

const updated = execution.buildUpdatedRow(registryItem, validSentDraft);
assert.strictEqual(updated.status, 'sent');
assert.strictEqual(updated.sent_date, '2026-07-16');
assert.strictEqual(updated.follow_up_date, '2026-07-23');
assert.strictEqual(updated.channel, 'официальная форма');
assert.strictEqual(updated.response_date, '');
assert.strictEqual(updated.response_source, '');
assert.strictEqual(updated.blocker, '');
assert.ok(updated.next_step.includes('2026-07-23'));

const serialized = execution.serializeUpdatedRow(registryItem, validSentDraft);
assert.ok(serialized.startsWith(`${execution.REGISTER_HEADERS.join(',')}\n`));
assert.strictEqual(serialized.split('\n').length, 2);

assert.throws(
  () => execution.buildUpdatedRow(resolved, validSentDraft),
  /исходного статуса draft/
);
assert.strictEqual(execution.hasSensitivePattern('token: abcdefghijklmnopqrstuvwxyz'), true);
assert.strictEqual(execution.hasSensitivePattern('публичная ссылка на workflow'), false);
assert.strictEqual(execution.isIsoDate('2026-02-29'), false);
assert.strictEqual(execution.isIsoDate('2026-07-16'), true);

console.log('Outreach execution packet self-test OK: 15 draft messages, guarded sent export');