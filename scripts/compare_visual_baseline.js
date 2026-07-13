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

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  let changedPixels = null;
  let maxChannelDelta = null;

  if (sizeEqual) {
    changedPixels = 0;
    maxChannelDelta = 0;
    for (let offset = 0; offset < baselinePng.data.length; offset += 4) {
      let pixelChanged = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(baselinePng.data[offset + channel] - currentPng.data[offset + channel]);
        if (delta > 0) pixelChanged = true;
        if (delta > maxChannelDelta) maxChannelDelta = delta;
      }
      if (pixelChanged) changedPixels += 1;
    }
  }

  return {
    size_equal: sizeEqual,
    baseline_size: { width: baselinePng.width, height: baselinePng.height },
    current_size: { width: currentPng.width, height: currentPng.height },
    pixel_identical: sizeEqual && changedPixels === 0,
    changed_pixels: changedPixels,
    max_channel_delta: maxChannelDelta,
    bytes_identical: baselineBytes.equals(currentBytes),
    baseline_sha256: sha256(baselinePath),
    current_sha256: sha256(currentPath)
  };
}

function main() {
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

  const changedCases = comparisons.filter((item) => !item.pixel_identical);
  const byteDifferentButPixelIdentical = comparisons.filter((item) => item.pixel_identical && !item.bytes_identical);

  const report = {
    schema_version: 1,
    compared_at: new Date().toISOString(),
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
      bytes_identical: comparisons.filter((item) => item.bytes_identical).length,
      byte_different_but_pixel_identical: byteDifferentButPixelIdentical.length,
      changed_cases: changedCases.length,
      missing_current_cases: missingCurrentCases.length
    },
    missing_current_cases: missingCurrentCases,
    changed_cases: changedCases.map((item) => item.case_id),
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
    `- Byte-identical: ${report.summary.bytes_identical}`,
    `- Byte-different but pixel-identical: ${report.summary.byte_different_but_pixel_identical}`,
    `- Changed cases: ${report.summary.changed_cases}`,
    `- Missing current cases: ${report.summary.missing_current_cases}`,
    '',
    ...(byteDifferentButPixelIdentical.length
      ? [`Encoding-only differences: ${byteDifferentButPixelIdentical.map((item) => item.case_id).join(', ')}`, '']
      : []),
    ...(changedCases.length
      ? ['Changed cases:', ...changedCases.map((item) => `- ${item.case_id}: ${item.changed_pixels ?? 'size mismatch'} changed pixels`), '']
      : ['No visual differences detected.', ''])
  ].join('\n');
  fs.writeFileSync(OUTPUT_MD_PATH, `${markdown}\n`);

  console.log(`Visual comparison: ${report.summary.pixel_identical}/${report.summary.cases_compared} pixel-identical, ${report.summary.bytes_identical} byte-identical`);

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
