const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COMPARATOR_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const CAPTURE_PATH = path.join(ROOT, 'scripts', 'capture_visual_baseline.js');
const MARKER = "const APPROVED_CASE_DELTAS_VERSION = '2026-07-23';";
const CAPTURE_MARKER = "const WORKBENCH_VISUAL_FIXTURE_VERSION = '2026-09-07';";

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Visual case-delta patch marker not found: ${label}`);
  return source.replace(pattern, replacement);
}

function patchSource(current) {
  if (current.includes(MARKER)) return { content: current, changed: false };

  let source = current;
  source = replaceOrFail(
    source,
    /const \{ classifyVisualEquivalence \} = require\('\.\/lib\/visual_comparison_policy'\);/,
    `const { classifyVisualEquivalence } = require('./lib/visual_comparison_policy');\nconst { validateApprovalDocument, applyApprovedCaseDelta } = require('./lib/visual_case_delta_policy');`,
    'policy import'
  );

  source = replaceOrFail(
    source,
    /const BASELINE_EXTENSION_PATH = path\.join\(BASELINE_DIR, 'manifest-focus\.json'\);/,
    `const BASELINE_EXTENSION_PATH = path.join(BASELINE_DIR, 'manifest-focus.json');\nconst APPROVED_CASE_DELTAS_PATH = path.join(BASELINE_DIR, 'approved-case-deltas.json');\n${MARKER}`,
    'approval path'
  );

  source = replaceOrFail(
    source,
    /function buildRgbGrid\(png, columns, rows\) \{/,
    `function readApprovedCaseDeltas(baselineManifest) {\n  if (!fs.existsSync(APPROVED_CASE_DELTAS_PATH)) return new Map();\n  const document = readJson(APPROVED_CASE_DELTAS_PATH);\n  const caseIds = (Array.isArray(baselineManifest.results) ? baselineManifest.results : []).map((item) => item.case_id);\n  return validateApprovalDocument(document, caseIds);\n}\n\nfunction buildRgbGrid(png, columns, rows) {`,
    'approval reader'
  );

  source = replaceOrFail(
    source,
    /  validateManifest\(currentManifest, 'Current'\);/,
    `  validateManifest(currentManifest, 'Current');\n  const approvedCaseDeltas = readApprovedCaseDeltas(baselineManifest);`,
    'approval load'
  );

  source = replaceOrFail(
    source,
    /    return \{\n      case_id: currentItem\.case_id,\n      route: currentItem\.route,\n      theme: currentItem\.theme,\n      interaction: currentItem\.interaction,\n      mode: currentItem\.mode,\n      \.\.\.imageComparison\n    \};/,
    `    const comparison = {\n      case_id: currentItem.case_id,\n      route: currentItem.route,\n      theme: currentItem.theme,\n      interaction: currentItem.interaction,\n      mode: currentItem.mode,\n      ...imageComparison\n    };\n    return applyApprovedCaseDelta(comparison, approvedCaseDeltas.get(currentItem.case_id));`,
    'comparison approval'
  );

  source = replaceOrFail(
    source,
    /  const broadSubpixelEquivalentCases = comparisons\.filter\(\(item\) => item\.equivalence_reason === 'broad_subpixel_rendering'\);/,
    `  const broadSubpixelEquivalentCases = comparisons.filter((item) => item.equivalence_reason === 'broad_subpixel_rendering');\n  const approvedCaseDeltaCases = comparisons.filter((item) => item.equivalence_reason === 'approved_case_delta');`,
    'approval summary collection'
  );

  source = replaceOrFail(
    source,
    /      broad_subpixel_equivalent: broadSubpixelEquivalentCases\.length,/,
    `      broad_subpixel_equivalent: broadSubpixelEquivalentCases.length,\n      approved_case_delta: approvedCaseDeltaCases.length,`,
    'approval summary count'
  );

  source = replaceOrFail(
    source,
    /    broad_subpixel_equivalent_cases: broadSubpixelEquivalentCases\.map\(\(item\) => item\.case_id\),/,
    `    broad_subpixel_equivalent_cases: broadSubpixelEquivalentCases.map((item) => item.case_id),\n    approved_case_delta_cases: approvedCaseDeltaCases.map((item) => item.case_id),`,
    'approval report list'
  );

  source = replaceOrFail(
    source,
    /    `- Broad-subpixel-equivalent: \$\{report\.summary\.broad_subpixel_equivalent\}`,/,
    `    \`- Broad-subpixel-equivalent: \${report.summary.broad_subpixel_equivalent}\`,\n    \`- Approved case deltas: \${report.summary.approved_case_delta}\`,`,
    'approval markdown count'
  );

  source = replaceOrFail(
    source,
    /    \.\.\.\(broadSubpixelEquivalentCases\.length\n      \? \[`Broad low-amplitude rendering differences: \$\{broadSubpixelEquivalentCases\.map\(\(item\) => item\.case_id\)\.join\(', '\)\}`, ''\]\n      : \[\]\),/,
    `    ...(broadSubpixelEquivalentCases.length\n      ? [\`Broad low-amplitude rendering differences: \${broadSubpixelEquivalentCases.map((item) => item.case_id).join(', ')}\`, '']\n      : []),\n    ...(approvedCaseDeltaCases.length\n      ? [\`Explicitly approved case deltas: \${approvedCaseDeltaCases.map((item) => item.case_id).join(', ')}\`, '']\n      : []),`,
    'approval markdown details'
  );

  source = replaceOrFail(
    source,
    /  console\.log\(`Visual comparison: \$\{report\.summary\.pixel_equivalent\}\/\$\{report\.summary\.cases_compared\} equivalent, \$\{report\.summary\.pixel_identical\} exact, \$\{report\.summary\.subpixel_equivalent\} subpixel, \$\{report\.summary\.broad_subpixel_equivalent\} broad-subpixel`\);/,
    `  console.log(\`Visual comparison: \${report.summary.pixel_equivalent}/\${report.summary.cases_compared} equivalent, \${report.summary.pixel_identical} exact, \${report.summary.subpixel_equivalent} subpixel, \${report.summary.broad_subpixel_equivalent} broad-subpixel, \${report.summary.approved_case_delta} approved-case\`);`,
    'approval console summary'
  );

  return { content: source, changed: true };
}

function patchCaptureSource(current) {
  if (current.includes(CAPTURE_MARKER)) return { content: current, changed: false };

  let source = current;
  source = replaceOrFail(
    source,
    /const BASE_URL = String\(process\.env\.VISUAL_BASELINE_BASE_URL \|\| 'http:\/\/127\.0\.0\.1:4173'\)\.replace\(\/\\\/$\/, ''\);/,
    `const BASE_URL = String(process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\\\/$/, '');\n${CAPTURE_MARKER}`,
    'capture fixture marker'
  );

  source = replaceOrFail(
    source,
    /async function positionPageForCapture\(page, item\) \{/,
    `async function stabilizeDynamicVisualContent(page, item) {\n  if (item.case_id !== 'css-reg-010' || item.route !== '/workbench/') return false;\n\n  const meta = page.locator('#workbench-today-grid .highlight-card .meta');\n  await meta.waitFor({ state: 'visible', timeout: 5000 });\n  await page.evaluate(() => {\n    const tags = [...document.querySelectorAll('#workbench-today-grid .highlight-card .meta .tag')];\n    const stableLabels = [\n      'оценка: 12 / 100',\n      'публичных страниц: 305',\n      'ТОС: 24',\n      'verified: 0'\n    ];\n    stableLabels.forEach((label, index) => {\n      if (tags[index]) tags[index].textContent = label;\n    });\n  });\n  await page.waitForTimeout(50);\n  return true;\n}\n\nasync function positionPageForCapture(page, item) {`,
    'workbench visual fixture'
  );

  source = replaceOrFail(
    source,
    /  await applyThemeAndInteraction\(page, item\);\n\n  await page\.addStyleTag/,
    `  await applyThemeAndInteraction(page, item);\n  await stabilizeDynamicVisualContent(page, item);\n\n  await page.addStyleTag`,
    'workbench fixture invocation'
  );

  return { content: source, changed: true };
}

function patchVisualCaseDeltas() {
  if (!fs.existsSync(COMPARATOR_PATH)) throw new Error(`Missing comparator: ${COMPARATOR_PATH}`);
  if (!fs.existsSync(CAPTURE_PATH)) throw new Error(`Missing capture script: ${CAPTURE_PATH}`);

  const comparator = patchSource(fs.readFileSync(COMPARATOR_PATH, 'utf8'));
  const capture = patchCaptureSource(fs.readFileSync(CAPTURE_PATH, 'utf8'));
  if (comparator.changed) fs.writeFileSync(COMPARATOR_PATH, comparator.content, 'utf8');
  if (capture.changed) fs.writeFileSync(CAPTURE_PATH, capture.content, 'utf8');

  const changed = comparator.changed || capture.changed;
  console.log(changed ? 'Visual case-delta patch applied' : 'Visual case-delta patch already applied');
  return changed;
}

if (require.main === module) patchVisualCaseDeltas();

module.exports = { MARKER, CAPTURE_MARKER, patchSource, patchCaptureSource, patchVisualCaseDeltas };
