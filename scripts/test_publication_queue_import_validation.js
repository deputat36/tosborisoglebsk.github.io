const assert = require('assert');
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

assert.deepStrictEqual(validation.QUEUE_HEADERS, [
  'queue_id', 'submission_type', 'tos_name', 'title', 'source_checked', 'permission_checked',
  'personal_data_checked', 'media_checked', 'target_file', 'status', 'blocker', 'owner', 'next_step'
]);
assert.strictEqual(validation.validateQueueRow(queueRow()).length, 0);
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
  [queueRow({ queue_id: 'queue-100' })],
  []
);
assert.strictEqual(exactContent[0].duplicate.level, 'exact');

const possible = validation.analyze(
  [queueRow({ title: 'Большой субботник на территории ТОС Проверка' })],
  [queueRow({ queue_id: 'queue-101', title: 'Субботник на территории ТОС Проверка' })],
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

const formulaCsv = validation.toCsv(['title'], [{ title: '=1+1' }]);
assert.ok(formulaCsv.includes("'=1+1"));
assert.ok(!formulaCsv.includes('\n=1+1'));

console.log('Publication queue import validation OK: draft-only, duplicate-aware and formula-safe');
