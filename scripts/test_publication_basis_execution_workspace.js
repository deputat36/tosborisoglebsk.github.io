const assert = require('assert');
const fs = require('fs');
const path = require('path');
const execution = require('../assets/js/publication-basis-execution');
const validation = require('../assets/js/publication-basis-validation');

const ROOT = process.cwd();
const readText = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const register = execution.parseCsv(readText('data/publication_basis_confirmation_register.csv'));
const queue = execution.parseCsv(readText('data/publication_basis_review_queue.csv'));
const templates = JSON.parse(readText('data/publication_basis_confirmation_templates.json'));
const tos = JSON.parse(readText('data/tos.json'));

const queueBySlug = execution.indexBy(queue, 'slug');
const tosBySlug = execution.buildTosIndex(tos);
const templatesById = execution.indexBy(templates.templates, 'id');
const drafts = register.filter((item) => item.request_status === 'draft');

assert.strictEqual(register.length, 24, 'register must contain 24 rows');
assert.strictEqual(drafts.length, 24, 'all 24 rows must remain draft before external action');
assert.strictEqual(queue.length, 24, 'queue must contain 24 rows');
assert.strictEqual(templates.templates.length, 3, 'three wave templates are required');
assert.strictEqual(tosBySlug.get('tancyrey')?.name, 'Танцырей');
assert.strictEqual(tosBySlug.get('chkalovec')?.name, 'Чкаловец');

for (const item of drafts) {
  const packet = execution.buildRequestPacket(
    item,
    queueBySlug.get(item.tos_slug),
    tosBySlug.get(item.tos_slug),
    templatesById.get(item.template_id),
    '2026-07-30'
  );
  assert.ok(packet, `${item.tos_slug}: packet must resolve`);
  assert.ok(packet.subject.length > 20, `${item.tos_slug}: subject must be usable`);
  assert.ok(packet.message.length > 180, `${item.tos_slug}: message must be usable`);
  assert.ok(packet.message.includes(`https://tosborisoglebsk.ru/tos/${item.tos_slug}/`), `${item.tos_slug}: card URL must be inserted`);
  assert.ok(packet.message.includes('2026-07-30'), `${item.tos_slug}: response deadline must be inserted`);
  assert.ok(!/\[(?:НАЗВАНИЕ ТОС|ССЫЛКА НА КАРТОЧКУ|ПЕРЕЧЕНЬ ТИПОВ ОПУБЛИКОВАННЫХ ПОЛЕЙ|СРОК ОТВЕТА)\]/.test(packet.subject + packet.message), `${item.tos_slug}: placeholders must be replaced`);
  assert.deepStrictEqual(validation.validationIssues(item), [], `${item.tos_slug}: canonical draft must remain valid`);
}

const first = drafts[0];
const packet = execution.buildRequestPacket(
  first,
  queueBySlug.get(first.tos_slug),
  tosBySlug.get(first.tos_slug),
  templatesById.get(first.template_id),
  '2026-07-30'
);
assert.ok(packet.subject.includes('ТОС «Богана»'));
assert.ok(packet.message.includes('председатель или уполномоченный представитель'));
assert.ok(packet.message.includes('телефон'));
assert.ok(packet.message.includes('электронная почта'));

const preparation = {
  response_deadline: '2026-07-30',
  recipient_role: 'tos_representative',
  channel_type: 'email',
  owner_role: 'editor',
  note: 'проверить текст и адрес вне публичного репозитория',
  actual_sent: false
};
const preparationResult = execution.validateExecution(first, preparation, validation);
assert.deepStrictEqual(preparationResult, { valid: true, actualSent: false, errors: [] });
assert.ok(execution.buildPreflightText(first, packet, preparation).includes('не подтверждена'));
assert.ok(execution.buildPreflightText(first, packet, preparation).includes('не создаёт publication_consent_ref'));

const incomplete = execution.validateExecution(first, { actual_sent: true }, validation);
assert.strictEqual(incomplete.valid, false);
assert.ok(incomplete.errors.length >= 5);

const sentDraft = {
  ...preparation,
  sent_date: '2026-07-16',
  follow_up_date: '2026-07-23',
  actual_sent: true
};
const sentResult = execution.validateExecution(first, sentDraft, validation);
assert.deepStrictEqual(sentResult, { valid: true, actualSent: true, errors: [] });

const updated = execution.buildUpdatedRow(first, sentDraft, validation);
assert.strictEqual(updated.request_status, 'sent');
assert.strictEqual(updated.recipient_role, 'tos_representative');
assert.strictEqual(updated.channel_type, 'email');
assert.strictEqual(updated.owner_role, 'editor');
assert.strictEqual(updated.sent_date, '2026-07-16');
assert.strictEqual(updated.follow_up_date, '2026-07-23');
assert.strictEqual(updated.response_date, '');
assert.strictEqual(updated.reviewed_at, '');
assert.strictEqual(updated.factual_source_ref, '');
assert.strictEqual(updated.decision_status, 'not_reviewed');
assert.deepStrictEqual(validation.validationIssues(updated), []);

const serialized = execution.serializeUpdatedRow(first, sentDraft, validation);
assert.ok(serialized.startsWith(`${execution.REGISTER_HEADERS.join(',')}\n`));
assert.strictEqual(serialized.split('\n').length, 2);
assert.throws(() => execution.buildUpdatedRow({ ...first, request_status: 'waiting' }, sentDraft, validation), /исходного статуса draft/);
assert.strictEqual(execution.hasSensitivePattern('token: abcdefghijklmnopqrstuvwxyz'), true);
assert.strictEqual(execution.hasSensitivePattern('role:editor'), false);
assert.strictEqual(execution.isIsoDate('2026-02-29'), false);
assert.strictEqual(execution.isIsoDate('2026-07-16'), true);

console.log('Publication basis execution workspace self-test OK: 24 resolved packets, guarded sent export');
