const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const CAPTURE_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const CAPTURE_MANIFEST = path.join(CAPTURE_DIR, 'manifest.json');
const APPROVED_DIR = path.join(ROOT, 'docs', 'visual-baseline');
const APPROVED_MANIFEST = path.join(APPROVED_DIR, 'manifest.json');
const APPROVED_README = path.join(APPROVED_DIR, 'README.md');
const MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const EXPECTED_CASES = 14;

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function assertCleanManifest(manifest) {
  const errors = [];
  if (manifest.schema_version !== 3) errors.push(`unsupported schema_version ${manifest.schema_version}`);
  if (manifest.cases_total !== EXPECTED_CASES) errors.push(`cases_total must equal ${EXPECTED_CASES}`);
  if (manifest.cases_captured !== EXPECTED_CASES) errors.push(`cases_captured must equal ${EXPECTED_CASES}`);
  if (!Array.isArray(manifest.results) || manifest.results.length !== EXPECTED_CASES) errors.push(`results must contain ${EXPECTED_CASES} cases`);
  if ((manifest.failures || []).length) errors.push(`runtime failures: ${(manifest.failures || []).length}`);
  if ((manifest.quality_failures || []).length) errors.push(`quality failures: ${(manifest.quality_failures || []).length}`);

  (manifest.results || []).forEach((item) => {
    if (!item.case_id || !item.screenshot || !item.sha256) errors.push('each result requires case_id, screenshot and sha256');
    if ((item.technical_violations || []).length) errors.push(`${item.case_id}: technical violations are present`);
    if ((item.console_errors || []).length) errors.push(`${item.case_id}: console errors are present`);
    if ((item.page_errors || []).length) errors.push(`${item.case_id}: page errors are present`);
    if ((item.failed_requests || []).length) errors.push(`${item.case_id}: failed requests are present`);
    if (item.diagnostics?.horizontalOverflow) errors.push(`${item.case_id}: horizontal overflow is present`);
    const screenshotPath = path.join(CAPTURE_DIR, item.screenshot || '');
    if (!fs.existsSync(screenshotPath)) errors.push(`${item.case_id}: screenshot is missing`);
  });

  if (errors.length) throw new Error(`Visual baseline approval failed:\n${errors.join('\n')}`);
}

function updateMatrix(manifest) {
  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const headers = (rows[0] || []).map((value) => String(value || '').replace(/^\uFEFF/, '').trim());
  const statusIndex = headers.indexOf('status');
  const evidenceIndex = headers.indexOf('evidence_ref');
  const caseIndex = headers.indexOf('case_id');
  if ([statusIndex, evidenceIndex, caseIndex].some((index) => index < 0)) {
    throw new Error('CSS regression matrix is missing case_id, status or evidence_ref');
  }

  const approvedIds = new Set((manifest.results || []).map((item) => item.case_id));
  if (approvedIds.size !== EXPECTED_CASES) throw new Error(`Approved manifest must contain ${EXPECTED_CASES} unique case ids`);

  rows.slice(1).forEach((row) => {
    const caseId = String(row[caseIndex] || '').trim();
    if (!approvedIds.has(caseId)) throw new Error(`Matrix case is missing from approved manifest: ${caseId}`);
    row[statusIndex] = 'baseline_captured';
    row[evidenceIndex] = `docs/visual-baseline/${caseId}.png`;
  });

  fs.writeFileSync(MATRIX_PATH, `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`, 'utf8');
}

function writeReadme(manifest) {
  const artifactName = process.env.VISUAL_BASELINE_ARTIFACT || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const commitSha = process.env.GITHUB_SHA || manifest.commit_sha || '';
  const lines = [
    '# Утверждённый visual baseline',
    '',
    `Сформирован: ${manifest.captured_at || new Date().toISOString()}.`,
    '',
    '## Происхождение',
    '',
    `- ветка capture: \`${process.env.GITHUB_REF_NAME || ''}\`;`,
    `- commit capture: \`${commitSha}\`;`,
    `- GitHub Actions run: \`${runId}\`;`,
    `- artifact: \`${artifactName}\`;`,
    `- сценариев: ${manifest.cases_captured || 0} из ${manifest.cases_total || 0};`,
    '- runtime failures: 0;',
    '- quality failures: 0;',
    '- horizontal overflow: 0;',
    '- console/page errors: 0;',
    '- failed requests: 0.',
    '',
    '## Статус',
    '',
    'PNG и manifest имеют статус `baseline_captured`. Они являются кандидатом на утверждение в отдельном pull request.',
    '',
    'Статус `passed` допускается только после повторного strict capture и comparator на pull request без дополнительных CSS-изменений.',
    '',
    '## Состав',
    '',
    ...(manifest.results || []).map((item) => `- \`${item.case_id}.png\` — ${item.area}, ${item.viewport?.width}×${item.viewport?.height}, ${item.theme}, SHA-256 \`${item.sha256}\`.`),
    '',
    'Скриншоты фиксируют внешний вид, но не подтверждают достоверность опубликованных сведений о ТОСах.'
  ];
  fs.writeFileSync(APPROVED_README, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(CAPTURE_MANIFEST)) throw new Error(`Missing capture manifest: ${CAPTURE_MANIFEST}`);
  const manifest = JSON.parse(fs.readFileSync(CAPTURE_MANIFEST, 'utf8'));
  assertCleanManifest(manifest);

  fs.mkdirSync(APPROVED_DIR, { recursive: true });
  (manifest.results || []).forEach((item) => {
    fs.copyFileSync(path.join(CAPTURE_DIR, item.screenshot), path.join(APPROVED_DIR, `${item.case_id}.png`));
  });

  const approvedManifest = {
    ...manifest,
    approval_status: 'baseline_captured',
    approved_at: new Date().toISOString(),
    approved_source: {
      branch: process.env.GITHUB_REF_NAME || '',
      commit_sha: process.env.GITHUB_SHA || manifest.commit_sha || '',
      workflow_run_id: process.env.GITHUB_RUN_ID || manifest.workflow_run_id || '',
      workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT || manifest.workflow_run_attempt || '',
      artifact: process.env.VISUAL_BASELINE_ARTIFACT || ''
    },
    output_path: 'docs/visual-baseline'
  };
  fs.writeFileSync(APPROVED_MANIFEST, `${JSON.stringify(approvedManifest, null, 2)}\n`, 'utf8');
  updateMatrix(approvedManifest);
  writeReadme(approvedManifest);

  console.log(`Visual baseline candidates approved for PR review: ${approvedManifest.results.length} PNG files`);
}

main();
