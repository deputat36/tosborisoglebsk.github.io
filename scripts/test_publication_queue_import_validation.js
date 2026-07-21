const assert = require('assert');
const contract = require('../assets/js/publication-queue-contract.js');
const validation = require('../assets/js/publication-queue-import-validation.js');

function queueRow(overrides = {}) {
  return {
    queue_id: 'incoming-20260721-090000',
    submission_type: 'news',
    tos_name: 'ТОС «Проверка»',
    title: 'Субботник на территории ТОС',
    source_checked: 'нет',
    permission_checked: 'нет',
    personal_data_checked: 'нет',
    media_checked: 'не применимо',
    target_file: 'data/news.json',
    status: 'draft',
    blocker: 'источник и разрешения не проверены',
    owner: '',
    next_step: 'проверить источник дату и разрешение',
    ...overrides
  };
}

function canonicalRow(overrides = {}) {
  return {
    ...queueRow(),
    queue_id: 'queue-008',
    ...overrides
  };
}

function intakeRow(overrides = {}) {
  return {
    submission_type: 'news',
    tos_name: 'ТОС «Проверка»',
    title: 'Субботник на территории ТОС',
    short_summary: 'Событие состоялось — территория убрана',
    event_or_fact_date: '2026-07-20',
    source_person: 'Организатор',
    source_contact: 'Контакт только для редакции',
    source_document_or_link: '',
    publication_permission: 'не подтверждено',
    media_attached: 'нет',
    personal_data_present: 'не проверено',
    target_section: '/news/ и data/news.json',
    status: 'draft',
    next_step: 'проверить источник дату и разрешение',
    ...overrides
  };
}

assert.deepStrictEqual(validation.QUEUE_HEADERS, contract.QUEUE_HEADERS);
assert.deepStrictEqual([...contract.STATUSES], ['draft', 'checking', 'ready', 'published', 'rejected']);
assert.strictEqual(contract.formatCanonicalId(8), 'queue-008');
assert.strictEqual(contract.parseCanonicalNumber('queue-107'), 107);
assert.strictEqual(contract.parseCanonicalNumber('incoming-20260721-090000'), null);
assert.throws(() => contract.formatCanonicalId(1000), /от 1 до 999/);

assert.strictEqual(validation.validateQueueRow(queueRow()).length, 0);
assert.ok(validation.validateQueueRow(queueRow({ queue_id: 'queue-008' })).some((message) => message.includes('временный')));
assert.strictEqual(validation.validateIntakeRow(intakeRow()).length, 0);

const queueCsv = validation.toCsv(validation.QUEUE_HEADERS, [queueRow()]);
const parsedQueue = validation.parseDocument(queueCsv, validation.QUEUE_HEADERS);
assert.deepStrictEqual(parsedQueue, [queueRow()]);

const quoted = validation.parseCsv('a,b\n1,"строка, с запятой"\n2,"две\nстроки"\n');
assert.deepStrictEqual(quoted, [['a', 'b'], ['1', 'строка, с запятой'], ['2', 'две\nстроки']]);
assert.throws(() => validation.parseDocument('a,b\n1,2\n', validation.QUEUE_HEADERS), /Схема CSV не совпадает/);
assert.throws(() => validation.parseCsv('a,b\n1,"broken\n'), /незакрытое поле/);

assert.ok(validation.validateQueueRow(queueRow({ status: 'ready' })).some((message) => message.includes('draft')));
assert.ok(validation.validateQueueRow(queueRow({ source_checked: 'да' })).some((message) => message.includes('источника')));
assert.ok(validation.validateQueueRow(queueRow({ owner: 'редактор' })).some((message) => message.includes('Ответственный')));
assert.ok(validation.validateQueueRow(queueRow({ title: '=IMPORTXML("x")' })).some((message) => message.includes('CSV-формула')));
assert.ok(validation.validateIntakeRow(intakeRow({ publication_permission: 'подтверждено' })).some((message) => message.includes('Разрешение')));
assert.ok(validation.validateIntakeRow(intakeRow({ personal_data_present: 'нет' })).some((message) => message.includes('Персональные данные')));

const exactId = validation.analyze([queueRow()], [queueRow()], []);
assert.strictEqual(exactId[0].duplicate.level, 'exact');
assert.strictEqual(exactId[0].canApprove, false);

const exactContent = validation.analyze(
  [queueRow({ queue_id: 'incoming-20260721-090001' })],
  [canonicalRow({ queue_id: 'queue-100' })],
  []
);
assert.strictEqual(exactContent[0].duplicate.level, 'exact');

const possible = validation.analyze(
  [queueRow({ title: 'Большой субботник на территории ТОС Проверка' })],
  [canonicalRow({ queue_id: 'queue-101', title: 'Субботник на территории ТОС Проверка' })],
  []
);
assert.strictEqual(possible[0].duplicate.level, 'possible');
assert.strictEqual(possible[0].canApprove, true);
assert.strictEqual(possible[0].requiresDuplicateOverride, true);

const paired = validation.analyze([queueRow()], [], [intakeRow()]);
assert.ok(paired[0].intakeRow);
assert.strictEqual(paired[0].valid, true);
assert.strictEqual(Object.prototype.hasOwnProperty.call(paired[0].row, 'source_contact'), false);

const unsafeIntake = validation.analyze([queueRow()], [], [intakeRow({ source_contact: '=HYPERLINK("x")' })]);
assert.strictEqual(unsafeIntake[0].valid, false);
assert.ok(unsafeIntake[0].intakeErrors.some((message) => message.includes('CSV-формула')));

const current = [canonicalRow({ queue_id: 'queue-001' }), canonicalRow({ queue_id: 'queue-007' })];
assert.strictEqual(contract.nextCanonicalNumber(current), 8);
const sourceRows = [
  queueRow({ queue_id: 'incoming-20260721-090010', title: 'Материал один' }),
  queueRow({ queue_id: 'incoming-20260721-090011', title: 'Материал два' })
];
const canonicalized = validation.canonicalizeApprovedRows(sourceRows, current);
assert.deepStrictEqual(canonicalized.map((row) => row.queue_id), ['queue-008', 'queue-009']);
assert.deepStrictEqual(sourceRows.map((row) => row.queue_id), ['incoming-20260721-090010', 'incoming-20260721-090011']);
canonicalized.forEach((row) => assert.deepStrictEqual(contract.validateCanonicalRow(row), []));
assert.throws(
  () => validation.canonicalizeApprovedRows([queueRow()], [canonicalRow({ queue_id: 'queue-999' })]),
  /закончился диапазон/
);

assert.ok(contract.validateCanonicalRow(canonicalRow({ status: 'source_check' })).some((message) => message.includes('unsupported status')));
assert.ok(contract.validateCanonicalRow(canonicalRow({ status: 'checking', blocker: '' })).some((message) => message.includes('requires blocker')));
assert.ok(contract.validateCanonicalRow(canonicalRow({ status: 'ready', blocker: '' })).some((message) => message.includes('requires owner')));
const ready = canonicalRow({
  status: 'ready',
  source_checked: 'да',
  permission_checked: 'не применимо',
  personal_data_checked: 'да',
  media_checked: 'не применимо',
  blocker: '',
  owner: 'редакция портала'
});
assert.deepStrictEqual(contract.validateCanonicalRow(ready), []);
assert.ok(contract.validateCanonicalRow({ ...ready, submission_type: 'media' }).some((message) => message.includes('media submission')));

const formulaCsv = validation.toCsv(['title'], [{ title: '=1+1' }]);
assert.ok(formulaCsv.includes("'=1+1"));
assert.ok(!formulaCsv.includes('\n=1+1'));

console.log('Publication queue contract OK: canonical IDs, unified statuses, duplicate-aware and formula-safe');
