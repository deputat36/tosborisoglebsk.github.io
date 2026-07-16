const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'personal-data-decisions', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'PERSONAL-DATA-SCENARIO-MATRIX.md');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'personal-data-decisions-audit.yml');
const MANUAL_PATH = path.join(ROOT, 'scripts', 'audit_manual_extensions.js');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireToken(errors, content, token, label) {
  if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
}

function main() {
  const errors = [];
  const page = read(PAGE_PATH);
  const doc = read(DOC_PATH);
  const workflow = read(WORKFLOW_PATH);
  const manual = read(MANUAL_PATH);

  for (const token of [
    'id="scenario-matrix"',
    'id="personal-data-scenario-stats"',
    'id="personal-data-scenario-list"',
    'Черновая матрица сценариев и групп полей',
    'Подготовительный материал · решение №2',
    'Основания, правила распространения и сроки хранения намеренно не выбраны',
    'Все строки остаются <code>draft</code>',
    'href="/data/personal_data_scenario_matrix.csv"',
    'href="/docs/PERSONAL-DATA-SCENARIO-MATRIX.md"',
    '/assets/js/personal-data-scenario-validation.js',
    '/assets/js/personal-data-scenarios.js'
  ]) requireToken(errors, page, token, 'personal-data-decisions/index.html');

  for (const link of ['/data/personal_data_scenario_matrix.csv', '/docs/PERSONAL-DATA-SCENARIO-MATRIX.md']) {
    if (!repoPathExists(link)) errors.push(`linked target is missing: ${link}`);
  }

  const decisionsIndex = page.indexOf('/assets/js/personal-data-decisions.js');
  const scenarioValidationIndex = page.indexOf('/assets/js/personal-data-scenario-validation.js');
  const scenarioPageIndex = page.indexOf('/assets/js/personal-data-scenarios.js');
  if (!(decisionsIndex >= 0 && scenarioValidationIndex > decisionsIndex && scenarioPageIndex > scenarioValidationIndex)) {
    errors.push('scenario scripts must load after the decision panel in validation/page order');
  }

  for (const token of [
    'четыре предполагаемых сценария портала',
    'Все строки имеют статус `draft`',
    '`retention_class_code`, `basis_code` и `distribution_rule_code` остаются пустыми',
    'Матрица не переводит решение `purposes_and_data_categories`',
    'ровно четыре строки и их порядок'
  ]) requireToken(errors, doc, token, 'PERSONAL-DATA-SCENARIO-MATRIX.md');

  for (const token of [
    'data/personal_data_scenario_matrix.csv',
    'assets/js/personal-data-scenario-validation.js',
    'assets/js/personal-data-scenarios.js',
    'scripts/test_personal_data_scenario_matrix.js',
    'scripts/audit_personal_data_scenario_matrix.js',
    'scripts/audit_personal_data_scenario_page.js',
    'Test personal data scenario matrix',
    'Audit personal data scenario matrix',
    'Audit personal data scenario page'
  ]) requireToken(errors, workflow, token, 'personal-data-decisions-audit.yml');

  for (const script of [
    'scripts/test_personal_data_scenario_matrix.js',
    'scripts/audit_personal_data_scenario_matrix.js',
    'scripts/audit_personal_data_scenario_page.js'
  ]) requireToken(errors, manual, script, 'audit_manual_extensions.js');

  if (errors.length) throw new Error(`Personal data scenario page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Personal data scenario page OK: matrix, documentation and CI links are connected');
}

main();
