const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const quality = require('../assets/js/update-center-quality.js');
const scenarioPath = path.join(process.cwd(), 'assets', 'js', 'update-center-data.js');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(scenarioPath, 'utf8'), sandbox, { filename: scenarioPath });

const scenarios = sandbox.window.TOS_UPDATE_SCENARIOS || {};
const scenarioKeys = ['card', 'news', 'photo', 'event', 'project', 'need'];

scenarioKeys.forEach((key) => {
  const scenario = scenarios[key];
  assert(scenario, `missing scenario ${key}`);

  const status = scenario.fields.find((field) => field.name === 'material_status');
  assert(status?.required, `${key}: material_status must be required`);
  assert.strictEqual(status.type, 'select', `${key}: material_status must be a select`);
  assert(Array.isArray(status.options) && status.options.length >= 3, `${key}: material_status options are missing`);

  const source = scenario.fields.find((field) => field.name === 'source');
  assert(source?.required, `${key}: source must be required`);
});

const news = scenarios.news;
const validData = {
  tos_custom: '',
  material_status: news.fields.find((field) => field.name === 'material_status').options[0],
  subject: 'Субботник на общественной территории',
  date: '2026-07-20',
  place: 'общественная территория',
  what_happened: 'Жители провели уборку территории.',
  result: 'Собран мусор и очищены дорожки.',
  source: 'организатор мероприятия',
  contact: 'контакт для редакции'
};

const ready = quality.evaluate({
  scenario: news,
  data: validData,
  tosSelected: true,
  confirmed: true,
  publicationChecked: true
});
assert.strictEqual(ready.ready, true, 'complete material must be ready');
assert.strictEqual(ready.passed, ready.total, 'complete material must pass all checks');
assert.deepStrictEqual(ready.missingRequired, []);

const incompleteData = { ...validData, material_status: '', source: '' };
const incomplete = quality.evaluate({
  scenario: news,
  data: incompleteData,
  tosSelected: true,
  confirmed: true,
  publicationChecked: true
});
assert.strictEqual(incomplete.ready, false, 'missing status and source must block export');
assert(incomplete.missingRequired.includes('Статус материала'));
assert(incomplete.missingRequired.includes('Источник подтверждения'));

const advisory = quality.evaluate({
  scenario: news,
  data: { ...validData, contact: '' },
  tosSelected: false,
  confirmed: true,
  publicationChecked: true
});
assert.strictEqual(advisory.ready, true, 'missing advisory fields must not block export');
assert.strictEqual(advisory.passed, advisory.total - 2, 'territory and contact must remain advisory');

const confirmations = quality.evaluate({
  scenario: news,
  data: validData,
  tosSelected: true,
  confirmed: false,
  publicationChecked: false
});
assert.strictEqual(confirmations.ready, false, 'two confirmations must be required');
assert.strictEqual(confirmations.blocking.length, 2);

console.log(`Update center quality OK: ${scenarioKeys.length} scenarios, ${ready.total} checks`);