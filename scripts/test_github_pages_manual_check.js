const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pagesManualCheck = require('../assets/js/github-pages-manual-check');

const ROOT = process.cwd();
const templateText = fs.readFileSync(path.join(ROOT, 'data', 'github_pages_manual_check_template.csv'), 'utf8');
const templateRows = pagesManualCheck.parseCsv(templateText);

assert.strictEqual(templateRows.length, 8, 'Repository template must contain eight rows');
assert.strictEqual(pagesManualCheck.validateRows(templateRows).valid, true, 'Blank repository template must be structurally valid');
assert.deepStrictEqual(
  pagesManualCheck.summarize(templateRows),
  {
    total: 8,
    checked: 0,
    positive: 0,
    problems: 0,
    complete: false,
    passed: false,
    status: 'pending',
    validation: { valid: true, errors: [], rowErrors: [[], [], [], [], [], [], [], []] }
  }
);

const observedByField = {
  source_branch: 'GitHub Actions',
  publish_folder: 'GitHub Actions workflow',
  custom_domain: 'tosborisoglebsk.ru',
  https_enforcement: 'enabled',
  deployment_status: 'success',
  deployment_url: 'https://tosborisoglebsk.ru/',
  checked_at: '2026-07-16',
  evidence_ref: 'evidence:pages-settings-2026-07-16'
};

const completedRows = templateRows.map((row) => ({
  ...row,
  observed_value: observedByField[row.field],
  status: 'confirmed',
  evidence_ref: 'evidence:pages-settings-2026-07-16'
}));
const completedSummary = pagesManualCheck.summarize(completedRows);
assert.strictEqual(completedSummary.validation.valid, true);
assert.strictEqual(completedSummary.passed, true);
assert.strictEqual(completedSummary.status, 'passed');
const completedDiagnostic = pagesManualCheck.buildActionsDiagnosticRow(completedRows);
assert.strictEqual(completedDiagnostic.check_id, 'actions-013');
assert.strictEqual(completedDiagnostic.status, 'passed');
assert.strictEqual(completedDiagnostic.checked_at, '2026-07-16');
assert.ok(completedDiagnostic.result.includes('domain: tosborisoglebsk.ru'));
assert.ok(completedDiagnostic.result.includes('URL: https://tosborisoglebsk.ru/'));
assert.ok(pagesManualCheck.serializeActionsDiagnosticRow(completedRows).startsWith('actions-013,manual-check,'));

const partialRows = templateRows.map((row, index) => index < 2 ? {
  ...row,
  observed_value: index === 0 ? 'GitHub Actions' : 'GitHub Actions workflow',
  status: 'confirmed',
  evidence_ref: 'evidence:partial-pages-check'
} : { ...row });
const partialSummary = pagesManualCheck.summarize(partialRows);
assert.strictEqual(partialSummary.validation.valid, true);
assert.strictEqual(partialSummary.status, 'pending');
assert.strictEqual(partialSummary.passed, false);
assert.strictEqual(pagesManualCheck.buildActionsDiagnosticRow(partialRows).status, 'pending');

const warningRows = completedRows.map((row) => row.field === 'https_enforcement' ? { ...row, status: 'mismatch' } : { ...row });
assert.strictEqual(pagesManualCheck.summarize(warningRows).status, 'warning');
assert.strictEqual(pagesManualCheck.buildActionsDiagnosticRow(warningRows).status, 'warning');

const invalidUnchecked = templateRows.map((row, index) => index === 0 ? { ...row, observed_value: 'invented value' } : { ...row });
assert.strictEqual(pagesManualCheck.validateRows(invalidUnchecked).valid, false);
assert.ok(pagesManualCheck.validateRows(invalidUnchecked).errors.some((error) => error.includes('not_checked')));

const invalidUrl = completedRows.map((row) => row.field === 'deployment_url' ? { ...row, observed_value: 'tosborisoglebsk.ru' } : { ...row });
assert.strictEqual(pagesManualCheck.validateRows(invalidUrl).valid, false);
assert.ok(pagesManualCheck.validateRows(invalidUrl).errors.some((error) => error.includes('http://')));

const secretRows = completedRows.map((row, index) => index === 0 ? { ...row, evidence_ref: 'token=private-value' } : { ...row });
assert.strictEqual(pagesManualCheck.validateRows(secretRows).valid, false);
assert.ok(pagesManualCheck.validateRows(secretRows).errors.some((error) => error.includes('секрета')));

const roundTrip = pagesManualCheck.parseCsv(pagesManualCheck.serializeCsv(completedRows));
assert.deepStrictEqual(roundTrip, completedRows);

const merged = pagesManualCheck.mergeDraft(templateRows, [{
  item_id: 'pages-check-01',
  observed_value: 'GitHub Actions',
  status: 'unknown-status',
  evidence_ref: 'evidence:local'
}]);
assert.strictEqual(merged[0].field, 'source_branch');
assert.strictEqual(merged[0].observed_value, 'GitHub Actions');
assert.strictEqual(merged[0].status, 'not_checked');
assert.strictEqual(merged[0].evidence_ref, 'evidence:local');

console.log('GitHub Pages manual check wizard self-test OK');
