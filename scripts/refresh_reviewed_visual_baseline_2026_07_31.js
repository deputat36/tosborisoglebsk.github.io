const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const SOURCE_DIR = path.resolve(ROOT, process.env.REVIEWED_VISUAL_SOURCE || '.artifacts/reviewed-baseline');
const TARGET_DIR = path.join(ROOT, 'docs', 'visual-baseline');
const TARGET_MANIFEST = path.join(TARGET_DIR, 'manifest.json');
const APPROVAL_PATH = path.join(TARGET_DIR, 'approved-case-deltas.json');
const EXPECTED_RUN_ID = '30662143264';
const EXPECTED_ARTIFACT = 'visual-baseline-306-1';
const SELECTED_CASES = new Set(['css-reg-006', 'css-reg-007', 'css-reg-010', 'css-reg-011']);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const sourceManifestPath = path.join(SOURCE_DIR, 'manifest.json');
  const sourceManifest = readJson(sourceManifestPath);
  const targetManifest = readJson(TARGET_MANIFEST);

  assert(String(sourceManifest.workflow_run_id) === EXPECTED_RUN_ID, `Unexpected reviewed run: ${sourceManifest.workflow_run_id}`);
  assert(sourceManifest.schema_version === 3, `Unexpected source manifest schema: ${sourceManifest.schema_version}`);
  assert(sourceManifest.cases_total === 16 && sourceManifest.cases_captured === 16, 'Reviewed artifact must contain 16 captured cases');
  assert(!(sourceManifest.failures || []).length, 'Reviewed artifact contains runtime failures');
  assert(!(sourceManifest.quality_failures || []).length, 'Reviewed artifact contains quality failures');
  assert(targetManifest.schema_version === 3, `Unexpected target manifest schema: ${targetManifest.schema_version}`);
  assert(targetManifest.cases_total === 14 && targetManifest.results.length === 14, 'Base manifest must contain exactly 14 cases');

  const sourceById = new Map(sourceManifest.results.map((item) => [item.case_id, item]));
  const targetById = new Map(targetManifest.results.map((item) => [item.case_id, item]));

  for (const caseId of SELECTED_CASES) {
    const source = sourceById.get(caseId);
    const target = targetById.get(caseId);
    assert(source && target, `${caseId}: case is missing in source or target manifest`);
    ['route', 'theme', 'interaction', 'mode', 'screenshot'].forEach((key) => {
      assert(source[key] === target[key], `${caseId}: ${key} changed from ${target[key]} to ${source[key]}`);
    });
    assert(source.viewport?.width === target.viewport?.width && source.viewport?.height === target.viewport?.height, `${caseId}: viewport changed`);
    const sourcePng = path.join(SOURCE_DIR, source.screenshot);
    assert(fs.existsSync(sourcePng), `${caseId}: reviewed PNG is missing`);
    assert(sha256(sourcePng) === source.sha256, `${caseId}: reviewed PNG SHA does not match manifest`);
    fs.copyFileSync(sourcePng, path.join(TARGET_DIR, source.screenshot));
  }

  const refreshedResults = targetManifest.results.map((item) => {
    if (!SELECTED_CASES.has(item.case_id)) return item;
    const source = sourceById.get(item.case_id);
    return {
      ...source,
      target_url: source.target_url,
      screenshot: item.screenshot
    };
  });

  const refreshedManifest = {
    ...targetManifest,
    captured_at: sourceManifest.captured_at,
    commit_sha: sourceManifest.commit_sha,
    workflow_run_id: sourceManifest.workflow_run_id,
    workflow_run_attempt: sourceManifest.workflow_run_attempt,
    output_path: 'docs/visual-baseline',
    baseline_refresh: {
      type: 'incremental',
      approved_at: '2026-07-31',
      reviewed_run_id: EXPECTED_RUN_ID,
      reviewed_artifact: EXPECTED_ARTIFACT,
      refreshed_cases: [...SELECTED_CASES].sort(),
      reason: 'Обновлены только проверенные кадры карточки ТОС и динамических рабочих метрик; остальные утверждённые эталоны сохранены.'
    },
    results: refreshedResults
  };

  fs.writeFileSync(TARGET_MANIFEST, stableJson(refreshedManifest), 'utf8');

  const approvals = {
    schema_version: 1,
    approved_at: '2026-07-31',
    reviewed_run_id: EXPECTED_RUN_ID,
    reviewed_artifact: EXPECTED_ARTIFACT,
    cases: {
      'css-reg-012': {
        baseline_sha256: '357da2d1d2a9517e9b2b4663d5e0d030e9b6e9993ce948c2dfa57c66ef677b4b',
        route: '/site-health/',
        theme: 'dark',
        interaction: 'toggle-theme',
        mode: 'screen',
        max_significant_changed_pixels: 0,
        max_changed_pixel_ratio: 0.12,
        max_channel_delta: 10,
        observed_significant_changed_pixels: 0,
        observed_changed_pixel_ratio: 0.1163279569892473,
        observed_max_channel_delta: 10,
        reason: 'Сохранён ранее проверенный узкий допуск мобильной тёмной технической сводки: размеры, тема и компоновка не меняются, значимых пикселей нет.'
      }
    }
  };
  fs.writeFileSync(APPROVAL_PATH, stableJson(approvals), 'utf8');

  const writtenManifest = readJson(TARGET_MANIFEST);
  writtenManifest.results.forEach((item) => {
    const pngPath = path.join(TARGET_DIR, item.screenshot);
    assert(fs.existsSync(pngPath), `${item.case_id}: baseline PNG is missing after refresh`);
    assert(sha256(pngPath) === item.sha256, `${item.case_id}: baseline PNG SHA does not match refreshed manifest`);
    assert(fs.statSync(pngPath).size === item.bytes, `${item.case_id}: baseline PNG byte size does not match refreshed manifest`);
  });

  console.log(`Reviewed visual baseline refreshed from ${EXPECTED_ARTIFACT}: ${[...SELECTED_CASES].sort().join(', ')}`);
}

main();
