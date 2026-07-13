const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PNG } = require('pngjs');

const ROOT = process.cwd();
const BASELINE_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_APPROVED || 'docs/visual-baseline');
const CURRENT_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const BASELINE_MANIFEST_PATH = path.join(BASELINE_DIR, 'manifest.json');
const CURRENT_MANIFEST_PATH = path.join(CURRENT_DIR, 'manifest.json');
const OUTPUT_JSON_PATH = path.join(CURRENT_DIR, 'comparison.json');
const OUTPUT_MD_PATH = path.join(CURRENT_DIR, 'comparison.md');

const DEFAULT_MAX_CHANNEL_DELTA = 16;
const DEFAULT_MAX_LOW_DELTA_RATIO = 0.005;
const HARD_MAX_CHANNEL_DELTA = 32;
const HARD_MAX_LOW_DELTA_RATIO = 0.01;
const MAX_CHANNEL_DELTA = Number(process.env.VISUAL_MAX_CHANNEL_DELTA || DEFAULT_MAX_CHANNEL_DELTA);
const MAX_LOW_DELTA_RATIO = Number(process.env.VISUAL_MAX_LOW_DELTA_RATIO || DEFAULT_MAX_LOW_DELTA_RATIO);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateThresholds() {
  if (!Number.isFinite(MAX_CHANNEL_DELTA) || MAX_CHANNEL_DELTA < 0 || MAX_CHANNEL_DELTA > HARD_MAX_CHANNEL_DELTA) {
    throw new Error(`Invalid VISUAL_MAX_CHANNEL_DELTA: ${MAX_CHANNEL_DELTA}; hard maximum is ${HARD_MAX_CHANNEL_DELTA}`);
  }
  if (!Number.isFinite(MAX_LOW_DELTA_RATIO) || MAX_LOW_DELTA_RATIO < 0 || MAX_LOW_DELTA_RATIO > HARD_MAX_LOW_DELTA_RATIO) {
    throw new Error(`Invalid VISUAL_MAX_LOW_DELTA_RATIO: ${MAX_LOW_DELTA_RATIO}; hard maximum is ${HARD_MAX_LOW_DELTA_RATIO}`);
  }
}

function validateManifest(manifest, label) {
  if (!Array.isArray(manifest.results) || manifest.results.length !== 14) {
    throw new Error(`${label} manifest must contain exactly 14 results`);
  }
  if ((manifest.failures || []).length) throw new Error(`${label} manifest contains runtime failures`);
  if ((manifest.quality_failures || []).length) throw new Error(`${label} manifest contains quality failures`);
  const ids = new Set();
  manifest.results.forEach((item, index) => {
    if (!/^css-reg-\d{3}$/.test(String(item.case_id || ''))) throw new Error(`${label} result ${index + 1} has invalid case_id`);
    if (ids.has(item.case_id)) throw new Error(`${label} manifest duplicates ${item.case_id}`);
    ids.add(item.case_id);
    if ((item.technical_violations || []).length) throw new Error(`${label} ${item.case_id} contains technical violations`);
    if ((item.console_errors || []).length) throw new Error(`${label} ${item.case_id} contains console errors`);
    if ((item.page_errors || []).length) throw new Error(`${label} ${item.case_id} contains page errors`);
    if ((item.failed_requests || []).length) throw new Error(`${label} ${item.case_id} contains failed requests`);
    if (item.diagnostics?.horizontalOverflow) throw new Error(`${label} ${item.case_id} contains horizontal overflow`);
  });
}

function compareMetadata(baselineItem, currentItem) {
  const fields = ['route', 'theme', 'interaction', 'mode'];
  const mismatches = [];
  fields.forEach((field) => {
    if (String(baselineItem[field] ?? '') !== String(currentItem[field] ?? '')) {
      mismatches.push(`${field}: ${baselineItem[field]} != ${currentItem[field]}`);
    }
  });
  const baselineViewport = baselineItem.viewport || {};
  const currentViewport = currentItem.viewport || {};
  if (baselineViewport.width !== currentViewport.width || baselineViewport.height !== currentViewport.height) {
    mismatches.push(`viewport: ${baselineViewport.width}x${baselineViewport.height} != ${currentViewport.width}x${currentViewport.height}`);
  }
  return mismatches;
}

function comparePngs(baselinePath, currentPath) {
  if (!fs.existsSync(baselinePath)) throw new Error(`Missing baseline PNG: ${path.relative(ROOT, baselinePath)}`);
  if (!fs.existsSync(currentPath)) throw new Error(`Missing current PNG: ${path.relative(ROOT, currentPath)}`);

  const baselineBytes = fs.readFileSync(baselinePath);
  const currentBytes = fs.readFileSync(currentPath);
  const baselinePng = PNG.sync.read(baselineBytes);
  const currentPng = PNG.sync.read(currentBytes);

  const sizeEqual = baselinePng.width === currentPng.width && baselinePng.height === currentPng.height;
  const totalPixels = baselinePng.width * baselinePng.height;
  let changedPixels = null;
  let significantChangedPixels = null;
  let maxChannelDelta = null;

  if (sizeEqual) {
    changedPixels = 0;
    significantChangedPixels = 0;
    maxChannelDelta = 0;

    for (let offset = 0; offset < baselinePng.data.length; offset += 4) {
      let pixelChanged = false;
      let pixelSignificant = false;

      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(baselinePng.data[offset + channel] - currentPng.data[offset + channel]);
        if (delta > 0) pixelChanged = true;
        if (delta > MAX_CHANNEL_DELTA) pixelSignificant = true;
        if (delta > maxChannelDelta) maxChannelDelta = delta;
      }

      if (pixelChanged) changedPixels += 1;
      if (pixelSignificant) significantChangedPixels += 1;
    }
  }

  const changedPixelRatio = sizeEqual && totalPixels ? changedPixels / totalPixels : null;
  const pixelIdentical = sizeEqual && changedPixels === 0;
  const pixelEquivalent = sizeEqual
    && significantChangedPixels === 0
    && changedPixelRatio <= MAX_LOW_DELTA_RATIO;

  return {
    size_equal: sizeEqual,
    baseline_size: { width: baselinePng.width, height: baselinePng.height },
    current_size: { width: currentPng.width, height: currentPng.height },
    total_pixels: totalPixels,
    pixel_identical: pixelIdentical,
    pixel_equivalent: pixelEquivalent,
    changed_pixels: changedPixels,
    changed_pixel_ratio: changedPixelRatio,
    significant_changed_pixels: significantChangedPixels,
    max_channel_delta: maxChannelDelta,
    thresholds: {
      max_channel_delta: MAX_CHANNEL_DELTA,
      max_low_delta_ratio: MAX_LOW_DELTA_RATIO,
      hard_max_channel_delta: HARD_MAX_CHANNEL_DELTA,
      hard_max_low_delta_ratio: HARD_MAX_LOW_DELTA_RATIO
    },
    bytes_identical: baselineBytes.equals(currentBytes),
    baseline_sha256: sha256(baselinePath),
    current_sha256: sha256(currentPath)
  };
}

function main() {
  validateThresholds();
  fs.mkdirSync(CURRENT_DIR, { recursive: true });

  const baselineManifest = readJson(BASELINE_MANIFEST_PATH);
  const currentManifest = readJson(CURRENT_MANIFEST_PATH);
  validateManifest(baselineManifest, 'Baseline');
  validateManifest(currentManifest, 'Current');

  const baselineById = new Map(baselineManifest.results.map((item) => [item.case_id, item]));
  const currentById = new Map(currentManifest.results.map((item) => [item.case_id, item]));
  const baselineIds = [...baselineById.keys()].sort();
  const currentIds = [...currentById.keys()].sort();
  const missingCurrentCases = baselineIds.filter((caseId) => !currentById.has(caseId));
  const unexpectedCurrentCases = currentIds.filter((caseId) => !baselineById.has(caseId));

  const comparisons = currentIds
    .filter((caseId) => baselineById.has(caseId))
    .map((caseId) => {
      const baselineItem = baselineById.get(caseId);
      const currentItem = currentById.get(caseId);
      const metadataMismatches = compareMetadata(baselineItem, currentItem);
      const baselineName = baselineItem.screenshot || `${caseId}.png`;
      const currentName = currentItem.screenshot || `${caseId}.png`;
      const imageComparison = comparePngs(
        path.join(BASELINE_DIR, baselineName),
        path.join(CURRENT_DIR, currentName)
      );

      return {
        case_id: caseId,
        route: currentItem.route,
        theme: currentItem.theme,
        interaction: currentItem.interaction,
        mode: currentItem.mode,
        metadata_equal: metadataMismatches.length === 0,
        metadata_mismatches: metadataMismatches,
        ...imageComparison,
        accepted: metadataMismatches.length === 0 && imageComparison.pixel_equivalent
      };
    });

  const changedCases = comparisons.filter((item) => !item.accepted);
  const antialiasEquivalentCases = comparisons.filter((item) => item.accepted && !item.pixel_identical);
  const byteDifferentButPixelIdentical = comparisons.filter((item) => item.pixel_identical && !item.bytes_identical);

  const report = {
    schema_version: 3,
    compared_at: new Date().toISOString(),
    thresholds: {
      max_channel_delta: MAX_CHANNEL_DELTA,
      max_low_delta_ratio: MAX_LOW_DELTA_RATIO,
      hard_max_channel_delta: HARD_MAX_CHANNEL_DELTA,
      hard_max_low_delta_ratio: HARD_MAX_LOW_DELTA_RATIO
    },
    baseline: {
      commit_sha: baselineManifest.commit_sha || null,
      workflow_run_id: baselineManifest.workflow_run_id || null,
      approval: baselineManifest.approval || null,
      cases: baselineManifest.results.length
    },
    current: {
      commit_sha: currentManifest.commit_sha || null,
      workflow_run_id: currentManifest.workflow_run_id || null,
      cases: currentManifest.results.length
    },
    summary: {
      cases_compared: comparisons.length,
      pixel_identical: comparisons.filter((item) => item.pixel_identical).length,
      pixel_equivalent: comparisons.filter((item) => item.accepted).length,
      antialias_equivalent: antialiasEquivalentCases.length,
      bytes_identical: comparisons.filter((item) => item.bytes_identical).length,
      byte_different_but_pixel_identical: byteDifferentButPixelIdentical.length,
      changed_cases: changedCases.length,
      missing_current_cases: missingCurrentCases.length,
      unexpected_current_cases: unexpectedCurrentCases.length
    },
    missing_current_cases: missingCurrentCases,
    unexpected_current_cases: unexpectedCurrentCases,
    changed_cases: changedCases.map((item) => item.case_id),
    antialias_equivalent_cases: antialiasEquivalentCases.map((item) => item.case_id),
    comparisons
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    '# Visual baseline comparison',
    '',
    `- Baseline run: ${report.baseline.workflow_run_id || 'unknown'}`,
    `- Current run: ${report.current.workflow_run_id || 'unknown'}`,
    `- Cases compared: ${report.summary.cases_compared}`,
    `- Pixel-identical: ${report.summary.pixel_identical}`,
    `- Pixel-equivalent: ${report.summary.pixel_equivalent}`,
    `- Antialias-equivalent: ${report.summary.antialias_equivalent}`,
    `- Byte-identical: ${report.summary.bytes_identical}`,
    `- Changed cases: ${report.summary.changed_cases}`,
    `- Missing current cases: ${report.summary.missing_current_cases}`,
    `- Unexpected current cases: ${report.summary.unexpected_current_cases}`,
    `- Maximum accepted channel delta: ${MAX_CHANNEL_DELTA}`,
    `- Maximum accepted low-delta ratio: ${MAX_LOW_DELTA_RATIO}`,
    '',
    ...(antialiasEquivalentCases.length
      ? [`Bounded antialias differences: ${antialiasEquivalentCases.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(byteDifferentButPixelIdentical.length
      ? [`Encoding-only differences: ${byteDifferentButPixelIdentical.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(changedCases.length
      ? ['Changed cases:', ...changedCases.map((item) => `- ${item.case_id}: metadata=${item.metadata_equal}, significant=${item.significant_changed_pixels ?? 'size mismatch'}, raw=${item.changed_pixels ?? 'unknown'}, max_delta=${item.max_channel_delta ?? 'unknown'}`), '']
      : ['No visual regressions detected.', ''])
  ].join('\n');
  fs.writeFileSync(OUTPUT_MD_PATH, `${markdown}\n`);

  console.log(`Visual comparison: ${report.summary.pixel_equivalent}/${report.summary.cases_compared} equivalent, ${report.summary.pixel_identical} exact`);

  if (
    missingCurrentCases.length
    || unexpectedCurrentCases.length
    || changedCases.length
    || comparisons.length !== baselineManifest.results.length
  ) {
    throw new Error(`Visual regression detected: changed=${changedCases.length}, missing=${missingCurrentCases.length}, unexpected=${unexpectedCurrentCases.length}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
