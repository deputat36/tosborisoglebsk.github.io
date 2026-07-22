const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COMPARE_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const MARKER = "const BASELINE_EXTENSION_PATH = path.join(BASELINE_DIR, 'manifest-focus.json');";

const READER = `function readApprovedManifest() {
  const base = readJson(BASELINE_MANIFEST_PATH);
  if (!fs.existsSync(BASELINE_EXTENSION_PATH)) return base;

  const extension = readJson(BASELINE_EXTENSION_PATH);
  if (extension.schema_version !== 1) {
    throw new Error(\`Unsupported visual baseline extension schema: \${extension.schema_version}\`);
  }
  if (extension.base_manifest && extension.base_manifest !== path.basename(BASELINE_MANIFEST_PATH)) {
    throw new Error(\`Visual baseline extension points to unexpected base manifest: \${extension.base_manifest}\`);
  }

  const baseResults = Array.isArray(base.results) ? base.results : [];
  const extensionResults = Array.isArray(extension.results) ? extension.results : [];
  if (!extensionResults.length) throw new Error('Visual baseline extension has no results');

  const combined = [...baseResults, ...extensionResults];
  const ids = combined.map((item) => item.case_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    throw new Error(\`Duplicate visual baseline case ids: \${[...new Set(duplicateIds)].join(', ')}\`);
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
  if (fingerprint.data_file) {
    const dataPath = path.resolve(BASELINE_DIR, fingerprint.data_file);
    if (!dataPath.startsWith(BASELINE_DIR + path.sep)) {
      throw new Error(\`Visual fingerprint escapes baseline directory for \${caseId}\`);
    }
    if (!fs.existsSync(dataPath)) throw new Error(\`Missing visual fingerprint data for \${caseId}\`);
    return fs.readFileSync(dataPath, 'utf8').trim();
  }
  return String(fingerprint.data_base64 || '');
}

function compareVisualFingerprint(item, currentPath) {
  const fingerprint = item.visual_fingerprint || {};
  if (fingerprint.scheme !== 'rgb-grid-v1') {
    throw new Error(\`Unsupported visual fingerprint scheme for \${item.case_id}: \${fingerprint.scheme}\`);
  }

  const columns = Number(fingerprint.columns);
  const rows = Number(fingerprint.rows);
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
    throw new Error(\`Invalid visual fingerprint grid for \${item.case_id}\`);
  }

  const expected = Buffer.from(readFingerprintData(fingerprint, item.case_id), 'base64');
  if (expected.length !== columns * rows * 3) {
    throw new Error(\`Visual fingerprint length mismatch for \${item.case_id}\`);
  }
  const expectedHash = crypto.createHash('sha256').update(expected).digest('hex');
  if (fingerprint.sha256 && expectedHash !== fingerprint.sha256) {
    throw new Error(\`Visual fingerprint SHA-256 mismatch for \${item.case_id}\`);
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
}`;

function patchSource(source) {
  if (source.includes(MARKER)) return { content: source, changed: false };

  let content = source;
  const manifestLine = "const BASELINE_MANIFEST_PATH = path.join(BASELINE_DIR, 'manifest.json');";
  if (!content.includes(manifestLine)) throw new Error('compare_visual_baseline.js: baseline manifest marker not found');
  content = content.replace(manifestLine, `${manifestLine}\n${MARKER}`);

  const readFunctionPattern = /(function readJson\(filePath\) \{[\s\S]*?\n\})\n\nfunction validateThresholds/;
  const readFunctionMatch = content.match(readFunctionPattern);
  if (!readFunctionMatch) throw new Error('compare_visual_baseline.js: readJson function not found');
  content = content.replace(readFunctionPattern, `${readFunctionMatch[1]}\n\n${READER}\n\nfunction validateThresholds`);

  const readCall = '  const baselineManifest = readJson(BASELINE_MANIFEST_PATH);';
  if (!content.includes(readCall)) throw new Error('compare_visual_baseline.js: baseline read call not found');
  content = content.replace(readCall, '  const baselineManifest = readApprovedManifest();');

  const comparisonCall = `    const imageComparison = comparePngs(
      path.join(BASELINE_DIR, baselineName),
      path.join(CURRENT_DIR, currentName)
    );`;
  if (!content.includes(comparisonCall)) throw new Error('compare_visual_baseline.js: comparison call not found');
  content = content.replace(comparisonCall, `    const currentPath = path.join(CURRENT_DIR, currentName);
    const imageComparison = baselineItem.visual_fingerprint
      ? compareVisualFingerprint(baselineItem, currentPath)
      : comparePngs(path.join(BASELINE_DIR, baselineName), currentPath);`);

  return { content, changed: true };
}

function patchVisualBaselineExtensions() {
  if (!fs.existsSync(COMPARE_PATH)) throw new Error(`Missing comparator: ${COMPARE_PATH}`);
  const current = fs.readFileSync(COMPARE_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(COMPARE_PATH, result.content, 'utf8');
  console.log(`Visual baseline extension patch OK: ${result.changed ? 'comparator updated' : 'already current'}`);
  return result.changed;
}

if (require.main === module) patchVisualBaselineExtensions();

module.exports = { MARKER, patchSource, patchVisualBaselineExtensions };
