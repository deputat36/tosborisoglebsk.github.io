const assert = require('assert');
const contract = require('../assets/js/publication-queue-contract.js');
const exporter = require('../assets/js/update-center-editorial-export.js');

function build(scenarioKey, data = {}) {
  return exporter.buildPackage({
    scenarioKey,
    scenario: { title: `Сценарий ${scenarioKey}` },
    tosName: 'ТОС «Проверка»',
    generatedAt: '2026-07-20T15:30:45.000Z',
    data: {
      material_status: 'Черновой факт',
      subject: 'Тестовый материал',
      source: 'Заявитель',
      contact: 'Контакт только для редакции',
      ...data
    }
  });
}

assert.strictEqual(exporter.contract, contract);
assert.deepStrictEqual(exporter.QUEUE_HEADERS, contract.QUEUE_HEADERS);
assert.deepStrictEqual(Object.keys(exporter.PROFILES).sort(), ['card', 'event', 'need', 'news', 'photo', 'project']);
assert.strictEqual(exporter.TEMPLATE_FILES.intake, 'data/content_intake_template.csv');
assert.strictEqual(exporter.TEMPLATE_FILES.queue, 'data/publication_queue.csv');
assert.strictEqual(exporter.profileFor('card').submissionType, 'card_update');
assert.strictEqual(exporter.profileFor('event').submissionType, 'news');
assert.strictEqual(exporter.profileFor('photo').submissionType, 'media');
assert.strictEqual(exporter.profileFor('project').targetFile, 'data/projects.json');
assert.strictEqual(exporter.profileFor('need').targetFile, 'data/needs.json');
Object.values(exporter.PROFILES).forEach((profile) => {
  assert.ok(contract.SUBMISSION_TYPES.has(profile.submissionType));
  assert.ok(contract.TARGET_FILES.has(profile.targetFile));
});

const news = build('news', {
  date: '2026-07-19',
  what_happened: 'Состоялась встреча жителей',
  result: 'Сформирован перечень вопросов',
  source_link: 'https://example.test/source'
});

assert.strictEqual(news.queue.queue_id, 'incoming-20260720-153045');
assert.ok(contract.INCOMING_ID_PATTERN.test(news.queue.queue_id));
assert.strictEqual(news.intake.status, 'draft');
assert.strictEqual(news.queue.status, 'draft');
assert.strictEqual(news.queue.source_checked, 'нет');
assert.strictEqual(news.queue.permission_checked, 'нет');
assert.strictEqual(news.queue.personal_data_checked, 'нет');
assert.strictEqual(news.queue.media_checked, 'не применимо');
assert.strictEqual(news.queue.owner, '');
assert.strictEqual(news.intake.source_contact, 'Контакт только для редакции');
assert.ok(!Object.prototype.hasOwnProperty.call(news.queue, 'source_contact'));
assert.strictEqual(news.intake.publication_permission, 'не подтверждено');
assert.strictEqual(news.intake.personal_data_present, 'не проверено');
assert.strictEqual(news.intake.event_or_fact_date, '2026-07-19');
assert.ok(news.intake.short_summary.includes('Состоялась встреча жителей'));
assert.ok(news.intakeCsv.startsWith(`${exporter.INTAKE_HEADERS.join(',')}\n`));
assert.ok(news.queueCsv.startsWith(`${contract.QUEUE_HEADERS.join(',')}\n`));

const photo = build('photo', { media: 'https://example.test/photo', work: 'Выполнены работы', after: 'Территория убрана' });
assert.strictEqual(photo.intake.submission_type, 'media');
assert.strictEqual(photo.intake.media_attached, 'да');
assert.strictEqual(photo.queue.media_checked, 'нет');
assert.ok(photo.queue.blocker.includes('медиа не проверены'));

const card = build('card', { subject: '', changes: 'Изменить поле', correct_value: 'Новое значение' });
assert.strictEqual(card.intake.submission_type, 'card_update');
assert.strictEqual(card.intake.title, 'Обновление карточки ТОС «Проверка»');

const quoted = exporter.toCsv(['a', 'b'], { a: 'текст, с запятой', b: 'строка "в кавычках"\nи перенос' });
assert.ok(quoted.includes('"текст, с запятой"'));
assert.ok(quoted.includes('"строка ""в кавычках""\nи перенос"'));
assert.strictEqual(exporter.safeSpreadsheetText('=HYPERLINK("https://example.test")'), "'=HYPERLINK(\"https://example.test\")");
assert.strictEqual(exporter.safeSpreadsheetText('+1+1'), "'+1+1");
assert.strictEqual(exporter.safeSpreadsheetText('@SUM(A1:A2)'), "'@SUM(A1:A2)");
assert.ok(exporter.toCsv(['value'], { value: '=1+1' }).includes("'=1+1"));

['card', 'news', 'photo', 'event', 'project', 'need'].forEach((scenarioKey) => {
  const result = build(scenarioKey);
  assert.strictEqual(result.intake.status, 'draft');
  assert.strictEqual(result.queue.status, 'draft');
  assert.strictEqual(result.queue.owner, '');
  assert.strictEqual(result.queue.source_checked, 'нет');
  assert.strictEqual(result.queue.permission_checked, 'нет');
  assert.strictEqual(result.queue.personal_data_checked, 'нет');
  assert.ok(contract.INCOMING_ID_PATTERN.test(result.queue.queue_id));
});

console.log('Update center editorial export OK: shared queue contract, 6 draft scenarios and CSV safety');
