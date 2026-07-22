const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PNG } = require('pngjs');
const { classifyVisualEquivalence } = require('./lib/visual_comparison_policy');

const ROOT = process.cwd();
const BASELINE_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_APPROVED || 'docs/visual-baseline');
const CURRENT_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const BASELINE_MANIFEST_PATH = path.join(BASELINE_DIR, 'manifest.json');
const BASELINE_EXTENSION_PATH = path.join(BASELINE_DIR, 'manifest-focus.json');
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

function readApprovedManifest() {
  const base = readJson(BASELINE_MANIFEST_PATH);
  if (!fs.existsSync(BASELINE_EXTENSION_PATH)) return base;

  const extension = readJson(BASELINE_EXTENSION_PATH);
  if (extension.schema_version !== 1) {
    throw new Error(`Unsupported visual baseline extension schema: ${extension.schema_version}`);
  }
  if (extension.base_manifest && extension.base_manifest !== path.basename(BASELINE_MANIFEST_PATH)) {
    throw new Error(`Visual baseline extension points to unexpected base manifest: ${extension.base_manifest}`);
  }

  const baseResults = Array.isArray(base.results) ? base.results : [];
  const extensionResults = Array.isArray(extension.results) ? extension.results : [];
  if (!extensionResults.length) throw new Error('Visual baseline extension has no results');

  const combined = [...baseResults, ...extensionResults];
  const ids = combined.map((item) => item.case_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    throw new Error(`Duplicate visual baseline case ids: ${[...new Set(duplicateIds)].join(', ')}`);
  }

  return {
    ...base,
    cases_total: combined.length,
    cases_captured: combined.length,
    results: combined,
    extensions: [path.basename(BASELINE_EXTENSION_PATH)]
  };
}

function buildRgbGrid(png, columns, rows) {
  const values = Buffer.alloc(columns * rows * 3);
  let cursor = 0;

  for (let gridY = 0; gridY < rows; gridY += 1) {
    const yStart = Math.floor((gridY * png.height) / rows);
    const yEnd = Math.floor(((gridY + 1) * png.height) / rows);
    for (let gridX = 0; gridX < columns; gridX += 1) {
      const xStart = Math.floor((gridX * png.width) / columns);
      const xEnd = Math.floor(((gridX + 1) * png.width) / columns);
      const sums = [0, 0, 0];
      let count = 0;

      for (let y = yStart; y < yEnd; y += 1) {
        for (let x = xStart; x < xEnd; x += 1) {
          const offset = (y * png.width + x) * 4;
          sums[0] += png.data[offset];
          sums[1] += png.data[offset + 1];
          sums[2] += png.data[offset + 2];
          count += 1;
        }
      }

      values[cursor] = Math.round(sums[0] / count);
      values[cursor + 1] = Math.round(sums[1] / count);
      values[cursor + 2] = Math.round(sums[2] / count);
      cursor += 3;
    }
  }

  return values;
}

function readFingerprintData(fingerprint, caseId) {
  const dataFiles = Array.isArray(fingerprint.data_files)
    ? fingerprint.data_files.filter(Boolean)
    : [];
  if (dataFiles.length) {
    return dataFiles.map((relativePath) => {
      const dataPath = path.resolve(BASELINE_DIR, relativePath);
      if (!dataPath.startsWith(BASELINE_DIR + path.sep)) {
        throw new Error(`Visual fingerprint escapes baseline directory for ${caseId}: ${relativePath}`);
      }
      if (!fs.existsSync(dataPath)) {
        throw new Error(`Missing visual fingerprint data for ${caseId}: ${relativePath}`);
      }
      return fs.readFileSync(dataPath, 'utf8').trim();
    }).join('');
  }
  if (fingerprint.data_file) {
    const dataPath = path.resolve(BASELINE_DIR, fingerprint.data_file);
    if (!dataPath.startsWith(BASELINE_DIR + path.sep)) {
      throw new Error(`Visual fingerprint escapes baseline directory for ${caseId}`);
    }
    if (!fs.existsSync(dataPath)) throw new Error(`Missing visual fingerprint data for ${caseId}`);
    return fs.readFileSync(dataPath, 'utf8').trim();
  }
  return String(fingerprint.data_base64 || '');
}

function compareVisualFingerprint(item, currentPath) {
  const fingerprint = item.visual_fingerprint || {};
  if (fingerprint.scheme !== 'rgb-grid-v1') {
    throw new Error(`Unsupported visual fingerprint scheme for ${item.case_id}: ${fingerprint.scheme}`);
  }

  const columns = Number(fingerprint.columns);
  const rows = Number(fingerprint.rows);
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
    throw new Error(`Invalid visual fingerprint grid for ${item.case_id}`);
  }

  const expected = Buffer.from(readFingerprintData(fingerprint, item.case_id), 'base64');
  if (expected.length !== columns * rows * 3) {
    throw new Error(`Visual fingerprint length mismatch for ${item.case_id}`);
  }
  const expectedHash = crypto.createHash('sha256').update(expected).digest('hex');
  if (fingerprint.sha256 && expectedHash !== fingerprint.sha256) {
    throw new Error(`Visual fingerprint SHA-256 mismatch for ${item.case_id}`);
  }

  const currentBytes = fs.readFileSync(currentPath);
  const currentPng = PNG.sync.read(currentBytes);
  const baselineWidth = Number(item.viewport?.width);
  const baselineHeight = Number(item.viewport?.height);
  const sizeEqual = currentPng.width === baselineWidth && currentPng.height === baselineHeight;
  const totalSamples = columns * rows;
  let changedSamples = null;
  let significantChangedSamples = null;
  let maxChannelDelta = null;

  if (sizeEqual) {
    const current = buildRgbGrid(currentPng, columns, rows);
    changedSamples = 0;
    significantChangedSamples = 0;
    maxChannelDelta = 0;

    for (let offset = 0; offset < expected.length; offset += 3) {
      let sampleChanged = false;
      let sampleSignificant = false;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(expected[offset + channel] - current[offset + channel]);
        if (delta > 0) sampleChanged = true;
        if (delta > MAX_CHANNEL_DELTA) sampleSignificant = true;
        if (delta > maxChannelDelta) maxChannelDelta = delta;
      }
      if (sampleChanged) changedSamples += 1;
      if (sampleSignificant) significantChangedSamples += 1;
    }
  }

  const changedRatio = sizeEqual && totalSamples ? changedSamples / totalSamples : null;
  const equivalence = classifyVisualEquivalence({
    sizeEqual,
    significantChangedPixels: significantChangedSamples,
    changedPixelRatio: changedRatio,
    maxChannelDelta
  }, {
    maxLowDeltaRatio: MAX_LOW_DELTA_RATIO,
    maxSubpixelChannelDelta: MAX_SUBPIXEL_CHANNEL_DELTA,
    maxSubpixelRatio: MAX_SUBPIXEL_RATIO,
    maxBroadSubpixelChannelDelta: 3,
    maxBroadSubpixelRatio: 0.3
  });

  return {
    comparison_mode: 'rgb_grid_fingerprint',
    size_equal: sizeEqual,
    baseline_size: { width: baselineWidth, height: baselineHeight },
    current_size: { width: currentPng.width, height: currentPng.height },
    total_pixels: totalSamples,
    pixel_identical: sizeEqual && changedSamples === 0,
    pixel_equivalent: equivalence.equivalent,
    equivalence_reason: equivalence.reason,
    changed_pixels: changedSamples,
    changed_pixel_ratio: changedRatio,
    significant_changed_pixels: significantChangedSamples,
    max_channel_delta: maxChannelDelta,
    thresholds: {
      max_channel_delta: MAX_CHANNEL_DELTA,
      max_low_delta_ratio: MAX_LOW_DELTA_RATIO,
      max_subpixel_channel_delta: MAX_SUBPIXEL_CHANNEL_DELTA,
      max_subpixel_ratio: MAX_SUBPIXEL_RATIO
    },
    bytes_identical: Boolean(item.screenshot_sha256) && sha256(currentPath) === item.screenshot_sha256,
    baseline_sha256: item.screenshot_sha256 || fingerprint.sha256,
    current_sha256: sha256(currentPath)
  };
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

  const baselineManifest = readApprovedManifest();
  const currentManifest = readJson(CURRENT_MANIFEST_PATH);
  validateManifest(baselineManifest, 'Baseline');
  validateManifest(currentManifest, 'Current');

  const baselineById = new Map(baselineManifest.results.map((item) => [item.case_id, item]));
  const comparisons = currentManifest.results.map((currentItem) => {
    const baselineItem = baselineById.get(currentItem.case_id);
    if (!baselineItem) throw new Error(`Baseline manifest is missing ${currentItem.case_id}`);

    const baselineName = baselineItem.screenshot || `${currentItem.case_id}.png`;
    const currentName = currentItem.screenshot || `${currentItem.case_id}.png`;
    const currentPath = path.join(CURRENT_DIR, currentName);
    const imageComparison = baselineItem.visual_fingerprint
      ? compareVisualFingerprint(baselineItem, currentPath)
      : comparePngs(path.join(BASELINE_DIR, baselineName), currentPath);

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
