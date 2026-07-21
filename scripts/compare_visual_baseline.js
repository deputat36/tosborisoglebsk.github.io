const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PNG } = require('pngjs');
const { classifyVisualEquivalence } = require('./lib/visual_comparison_policy');

const ROOT = process.cwd();
const BASELINE_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_APPROVED || 'docs/visual-baseline');
const CURRENT_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const BASELINE_MANIFEST_PATH = path.join(BASELINE_DIR, 'manifest.json');
const CURRENT_MANIFEST_PATH = path.join(CURRENT_DIR, 'manifest.json');
const OUTPUT_JSON_PATH = path.join(CURRENT_DIR, 'comparison.json');
const OUTPUT_MD_PATH = path.join(CURRENT_DIR, 'comparison.md');
const MAX_CHANNEL_DELTA = Number(process.env.VISUAL_MAX_CHANNEL_DELTA || 16);
const MAX_LOW_DELTA_RATIO = Number(process.env.VISUAL_MAX_LOW_DELTA_RATIO || 0.005);
const MAX_SUBPIXEL_CHANNEL_DELTA = Number(process.env.VISUAL_MAX_SUBPIXEL_CHANNEL_DELTA || 4);
const MAX_SUBPIXEL_RATIO = Number(process.env.VISUAL_MAX_SUBPIXEL_RATIO || 0.1);
const MAX_BROAD_SUBPIXEL_CHANNEL_DELTA = Number(process.env.VISUAL_MAX_BROAD_SUBPIXEL_CHANNEL_DELTA || 3);
const MAX_BROAD_SUBPIXEL_RATIO = Number(process.env.VISUAL_MAX_BROAD_SUBPIXEL_RATIO || 0.3);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateThresholds() {
  if (!Number.isFinite(MAX_CHANNEL_DELTA) || MAX_CHANNEL_DELTA < 0 || MAX_CHANNEL_DELTA > 32) {
    throw new Error(`Invalid VISUAL_MAX_CHANNEL_DELTA: ${MAX_CHANNEL_DELTA}`);
  }
  if (!Number.isFinite(MAX_LOW_DELTA_RATIO) || MAX_LOW_DELTA_RATIO < 0 || MAX_LOW_DELTA_RATIO > 0.01) {
    throw new Error(`Invalid VISUAL_MAX_LOW_DELTA_RATIO: ${MAX_LOW_DELTA_RATIO}`);
  }
  if (!Number.isFinite(MAX_SUBPIXEL_CHANNEL_DELTA) || MAX_SUBPIXEL_CHANNEL_DELTA < 0 || MAX_SUBPIXEL_CHANNEL_DELTA > 8) {
    throw new Error(`Invalid VISUAL_MAX_SUBPIXEL_CHANNEL_DELTA: ${MAX_SUBPIXEL_CHANNEL_DELTA}`);
  }
  if (!Number.isFinite(MAX_SUBPIXEL_RATIO) || MAX_SUBPIXEL_RATIO < MAX_LOW_DELTA_RATIO || MAX_SUBPIXEL_RATIO > 0.2) {
    throw new Error(`Invalid VISUAL_MAX_SUBPIXEL_RATIO: ${MAX_SUBPIXEL_RATIO}`);
  }
  if (!Number.isFinite(MAX_BROAD_SUBPIXEL_CHANNEL_DELTA)
    || MAX_BROAD_SUBPIXEL_CHANNEL_DELTA < 0
    || MAX_BROAD_SUBPIXEL_CHANNEL_DELTA > MAX_SUBPIXEL_CHANNEL_DELTA) {
    throw new Error(`Invalid VISUAL_MAX_BROAD_SUBPIXEL_CHANNEL_DELTA: ${MAX_BROAD_SUBPIXEL_CHANNEL_DELTA}`);
  }
  if (!Number.isFinite(MAX_BROAD_SUBPIXEL_RATIO)
    || MAX_BROAD_SUBPIXEL_RATIO < MAX_SUBPIXEL_RATIO
    || MAX_BROAD_SUBPIXEL_RATIO > 0.35) {
    throw new Error(`Invalid VISUAL_MAX_BROAD_SUBPIXEL_RATIO: ${MAX_BROAD_SUBPIXEL_RATIO}`);
  }
}

function validateManifest(manifest, label) {
  if (!Array.isArray(manifest.results) || !manifest.results.length) {
    throw new Error(`${label} manifest has no results`);
  }
  if ((manifest.failures || []).length) {
    throw new Error(`${label} manifest contains runtime failures`);
  }
  if ((manifest.quality_failures || []).length) {
    throw new Error(`${label} manifest contains quality failures`);
  }
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
  const equivalence = classifyVisualEquivalence({
    sizeEqual,
    significantChangedPixels,
    changedPixelRatio,
    maxChannelDelta
  }, {
    maxLowDeltaRatio: MAX_LOW_DELTA_RATIO,
    maxSubpixelChannelDelta: MAX_SUBPIXEL_CHANNEL_DELTA,
    maxSubpixelRatio: MAX_SUBPIXEL_RATIO,
    maxBroadSubpixelChannelDelta: MAX_BROAD_SUBPIXEL_CHANNEL_DELTA,
    maxBroadSubpixelRatio: MAX_BROAD_SUBPIXEL_RATIO
  });

  return {
    size_equal: sizeEqual,
    baseline_size: { width: baselinePng.width, height: baselinePng.height },
    current_size: { width: currentPng.width, height: currentPng.height },
    total_pixels: totalPixels,
    pixel_identical: pixelIdentical,
    pixel_equivalent: equivalence.equivalent,
    equivalence_reason: equivalence.reason,
    changed_pixels: changedPixels,
    changed_pixel_ratio: changedPixelRatio,
    significant_changed_pixels: significantChangedPixels,
    max_channel_delta: maxChannelDelta,
    thresholds: {
      max_channel_delta: MAX_CHANNEL_DELTA,
      max_low_delta_ratio: MAX_LOW_DELTA_RATIO,
      max_subpixel_channel_delta: MAX_SUBPIXEL_CHANNEL_DELTA,
      max_subpixel_ratio: MAX_SUBPIXEL_RATIO,
      max_broad_subpixel_channel_delta: MAX_BROAD_SUBPIXEL_CHANNEL_DELTA,
      max_broad_subpixel_ratio: MAX_BROAD_SUBPIXEL_RATIO
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
  const comparisons = currentManifest.results.map((currentItem) => {
    const baselineItem = baselineById.get(currentItem.case_id);
    if (!baselineItem) throw new Error(`Baseline manifest is missing ${currentItem.case_id}`);

    const baselineName = baselineItem.screenshot || `${currentItem.case_id}.png`;
    const currentName = currentItem.screenshot || `${currentItem.case_id}.png`;
    const imageComparison = comparePngs(
      path.join(BASELINE_DIR, baselineName),
      path.join(CURRENT_DIR, currentName)
    );

    return {
      case_id: currentItem.case_id,
      route: currentItem.route,
      theme: currentItem.theme,
      interaction: currentItem.interaction,
      mode: currentItem.mode,
      ...imageComparison
    };
  });

  const missingCurrentCases = baselineManifest.results
    .map((item) => item.case_id)
    .filter((caseId) => !currentManifest.results.some((item) => item.case_id === caseId));

  const changedCases = comparisons.filter((item) => !item.pixel_equivalent);
  const antialiasEquivalentCases = comparisons.filter((item) => item.equivalence_reason === 'bounded_antialias');
  const subpixelEquivalentCases = comparisons.filter((item) => item.equivalence_reason === 'subpixel_rendering');
  const broadSubpixelEquivalentCases = comparisons.filter((item) => item.equivalence_reason === 'broad_subpixel_rendering');
  const byteDifferentButPixelIdentical = comparisons.filter((item) => item.pixel_identical && !item.bytes_identical);

  const report = {
    schema_version: 3,
    compared_at: new Date().toISOString(),
    thresholds: {
      max_channel_delta: MAX_CHANNEL_DELTA,
      max_low_delta_ratio: MAX_LOW_DELTA_RATIO,
      max_subpixel_channel_delta: MAX_SUBPIXEL_CHANNEL_DELTA,
      max_subpixel_ratio: MAX_SUBPIXEL_RATIO,
      max_broad_subpixel_channel_delta: MAX_BROAD_SUBPIXEL_CHANNEL_DELTA,
      max_broad_subpixel_ratio: MAX_BROAD_SUBPIXEL_RATIO
    },
    baseline: {
      commit_sha: baselineManifest.commit_sha || null,
      workflow_run_id: baselineManifest.workflow_run_id || null,
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
      pixel_equivalent: comparisons.filter((item) => item.pixel_equivalent).length,
      antialias_equivalent: antialiasEquivalentCases.length,
      subpixel_equivalent: subpixelEquivalentCases.length,
      broad_subpixel_equivalent: broadSubpixelEquivalentCases.length,
      bytes_identical: comparisons.filter((item) => item.bytes_identical).length,
      byte_different_but_pixel_identical: byteDifferentButPixelIdentical.length,
      changed_cases: changedCases.length,
      missing_current_cases: missingCurrentCases.length
    },
    missing_current_cases: missingCurrentCases,
    changed_cases: changedCases.map((item) => item.case_id),
    antialias_equivalent_cases: antialiasEquivalentCases.map((item) => item.case_id),
    subpixel_equivalent_cases: subpixelEquivalentCases.map((item) => item.case_id),
    broad_subpixel_equivalent_cases: broadSubpixelEquivalentCases.map((item) => item.case_id),
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
    `- Subpixel-equivalent: ${report.summary.subpixel_equivalent}`,
    `- Broad-subpixel-equivalent: ${report.summary.broad_subpixel_equivalent}`,
    `- Byte-identical: ${report.summary.bytes_identical}`,
    `- Changed cases: ${report.summary.changed_cases}`,
    `- Maximum accepted channel delta: ${MAX_CHANNEL_DELTA}`,
    `- Maximum accepted low-delta ratio: ${MAX_LOW_DELTA_RATIO}`,
    `- Subpixel guard: delta <= ${MAX_SUBPIXEL_CHANNEL_DELTA}, ratio <= ${MAX_SUBPIXEL_RATIO}`,
    `- Broad subpixel guard: delta <= ${MAX_BROAD_SUBPIXEL_CHANNEL_DELTA}, ratio <= ${MAX_BROAD_SUBPIXEL_RATIO}`,
    '',
    ...(antialiasEquivalentCases.length
      ? [`Bounded antialias differences: ${antialiasEquivalentCases.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(subpixelEquivalentCases.length
      ? [`Bounded subpixel rendering differences: ${subpixelEquivalentCases.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(broadSubpixelEquivalentCases.length
      ? [`Broad low-amplitude rendering differences: ${broadSubpixelEquivalentCases.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(byteDifferentButPixelIdentical.length
      ? [`Encoding-only differences: ${byteDifferentButPixelIdentical.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(changedCases.length
      ? ['Changed cases:', ...changedCases.map((item) => `- ${item.case_id}: ${item.significant_changed_pixels ?? 'size mismatch'} significant pixels, ${item.changed_pixels ?? 'unknown'} raw pixels, reason=${item.equivalence_reason}`), '']
      : ['No visual regressions detected.', ''])
  ].join('\n');
  fs.writeFileSync(OUTPUT_MD_PATH, `${markdown}\n`);

  console.log(`Visual comparison: ${report.summary.pixel_equivalent}/${report.summary.cases_compared} equivalent, ${report.summary.pixel_identical} exact, ${report.summary.subpixel_equivalent} subpixel, ${report.summary.broad_subpixel_equivalent} broad-subpixel`);

  if (missingCurrentCases.length || changedCases.length || comparisons.length !== baselineManifest.results.length) {
    throw new Error(`Visual regression detected: changed=${changedCases.length}, missing=${missingCurrentCases.length}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
