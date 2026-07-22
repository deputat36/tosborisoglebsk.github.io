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

function resolveApprovedPng(item, screenshotName) {
  const directPath = path.join(BASELINE_DIR, screenshotName);
  if (fs.existsSync(directPath)) return directPath;

  const parts = Array.isArray(item.base64_parts) ? item.base64_parts : [];
  if (!parts.length) return directPath;

  const encoded = parts.map((relativePath) => {
    const partPath = path.resolve(BASELINE_DIR, relativePath);
    if (!partPath.startsWith(BASELINE_DIR + path.sep)) {
      throw new Error(\`Visual baseline part escapes approved directory: \${relativePath}\`);
    }
    if (!fs.existsSync(partPath)) throw new Error(\`Missing visual baseline part: \${relativePath}\`);
    return fs.readFileSync(partPath, 'utf8').trim();
  }).join('');

  const cacheDir = path.join(CURRENT_DIR, '.approved-baseline-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, screenshotName);
  fs.writeFileSync(cachePath, Buffer.from(encoded, 'base64'));

  if (item.sha256 && sha256(cachePath) !== item.sha256) {
    throw new Error(\`Decoded visual baseline SHA-256 mismatch: \${item.case_id}\`);
  }
  if (item.bytes && fs.statSync(cachePath).size !== Number(item.bytes)) {
    throw new Error(\`Decoded visual baseline byte size mismatch: \${item.case_id}\`);
  }

  return cachePath;
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

  const baselinePathCall = '      path.join(BASELINE_DIR, baselineName),';
  if (!content.includes(baselinePathCall)) throw new Error('compare_visual_baseline.js: baseline PNG path call not found');
  content = content.replace(baselinePathCall, '      resolveApprovedPng(baselineItem, baselineName),');

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
