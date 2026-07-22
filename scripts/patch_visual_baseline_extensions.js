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
