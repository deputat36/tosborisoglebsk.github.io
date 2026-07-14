const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { HEADERS, buildQueue, toCsv } = require('./generate_publication_basis_review_queue');

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, 'data', 'publication_basis_inventory.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'publication_basis_review_queue.csv');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const DOC_PATH = path.join(ROOT, 'docs', 'PUBLICATION-BASIS-REVIEW-QUEUE-2026-07-14.md');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const errors = [];
  const inventory = JSON.parse(read(INVENTORY_PATH));
  const expectedRows = buildQueue(inventory);
  const expectedCsv = toCsv(expectedRows);
  const actualCsv = read(QUEUE_PATH);
  const parsed = parseCsv(actualCsv);

  if (actualCsv !== expectedCsv) errors.push('publication basis review queue is stale or not deterministically generated');
  if (!parsed.length) errors.push('publication basis review queue is empty');
  if (parsed.length && JSON.stringify(parsed[0]) !== JSON.stringify(HEADERS)) errors.push('publication basis review queue headers do not match the contract');
  if (parsed.length - 1 !== expectedRows.length) errors.push('publication basis review queue row count does not match inventory risks');

  if (/https?:\/\//i.test(actualCsv)) errors.push('publication basis review queue must not contain URLs');
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(actualCsv)) errors.push('publication basis review queue must not contain email addresses');
  if (/\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(actualCsv)) errors.push('publication basis review queue must not contain phone numbers');

  const slugs = new Set();
  let previousWave = 0;
  let previousScore = Number.POSITIVE_INFINITY;
  for (const row of expectedRows) {
    if (slugs.has(row.slug)) errors.push(`duplicate queue slug ${row.slug}`);
    slugs.add(row.slug);
    if (![1, 2, 3].includes(row.wave)) errors.push(`${row.slug}: wave must be 1, 2 or 3`);
    if (row.priority !== `P0-${row.wave}`) errors.push(`${row.slug}: priority does not match wave`);
    if (row.status !== 'pending_external_confirmation') errors.push(`${row.slug}: unsupported queue status`);
    if (!row.next_action) errors.push(`${row.slug}: missing next_action`);
    if (!row.reason_codes.includes('publication_consent_ref_missing')) errors.push(`${row.slug}: missing publication consent reason`);
    if (!row.reason_codes.includes('source_ref_missing')) errors.push(`${row.slug}: missing source reason`);

    if (row.wave < previousWave) errors.push('queue waves are not sorted');
    if (row.wave === previousWave && row.score > previousScore) errors.push('queue scores are not sorted within wave');
    previousWave = row.wave;
    previousScore = row.score;
  }

  const metrics = inventory.metrics || {};
  if (expectedRows.length !== Number(metrics.basis_review_required || 0) + Number(metrics.source_only_consent_missing || 0)) {
    errors.push('queue must include every personal publication risk from inventory');
  }
  if (!expectedRows.some((row) => row.wave === 1)) errors.push('queue must contain wave 1 tasks');
  if (!expectedRows.some((row) => row.wave === 2)) errors.push('queue must contain wave 2 tasks');
  if (!expectedRows.some((row) => row.wave === 3)) errors.push('queue must contain wave 3 tasks');

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scripts = packageJson.scripts || {};
  const expectedScripts = {
    'report:publication-basis-queue': 'node scripts/generate_publication_basis_review_queue.js',
    'test:publication-basis-queue': 'node scripts/test_publication_basis_review_queue.js',
    'audit:publication-basis-queue': 'node scripts/audit_publication_basis_review_queue.js'
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) errors.push(`package.json must define ${name}`);
    if (!String(scripts['audit:all'] || '').includes(`npm run ${name}`)) errors.push(`audit:all must include ${name}`);
  }

  const projectMode = read(PROJECT_MODE_PATH);
  const projectModeFull = read(PROJECT_MODE_FULL_PATH);
  for (const [label, content] of [['project-mode', projectMode], ['project-mode-full', projectModeFull]]) {
    for (const script of ['scripts/test_publication_basis_review_queue.js', 'scripts/audit_publication_basis_review_queue.js']) {
      if (!content.includes(script)) errors.push(`${label} must include ${script}`);
    }
  }

  const workflow = read(WORKFLOW_PATH);
  const generationIndex = workflow.indexOf('Generate publication basis review queue');
  const auditIndex = workflow.indexOf('Audit publication basis review queue');
  if (generationIndex === -1 || auditIndex === -1 || generationIndex > auditIndex) {
    errors.push('main workflow must generate publication basis review queue before audit');
  }

  const doc = read(DOC_PATH).toLowerCase();
  for (const token of ['обезлич', 'волна 1', 'волна 2', 'волна 3', 'не содержит контактов', 'не является юридическим заключением']) {
    if (!doc.includes(token)) errors.push(`review queue documentation is missing ${token}`);
  }

  if (errors.length) {
    throw new Error(`Publication basis review queue audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  const waves = [1, 2, 3].map((wave) => expectedRows.filter((row) => row.wave === wave).length);
  console.log(`Publication basis review queue OK: ${expectedRows.length} tasks; waves ${waves.join('/')}`);
}

main();
