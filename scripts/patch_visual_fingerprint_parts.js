const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COMPARE_PATH = path.join(ROOT, 'scripts', 'compare_visual_baseline.js');
const TOOLING_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_visual_capture_tooling.js');
const DOC_PATH = path.join(ROOT, 'docs', 'VISUAL-BASELINE-CAPTURE.md');
const MARKER = 'const dataFiles = Array.isArray(fingerprint.data_files)';

const MULTI_FILE_READER = `function readFingerprintData(fingerprint, caseId) {
  const dataFiles = Array.isArray(fingerprint.data_files)
    ? fingerprint.data_files.filter(Boolean)
    : [];
  if (dataFiles.length) {
    return dataFiles.map((relativePath) => {
      const dataPath = path.resolve(BASELINE_DIR, relativePath);
      if (!dataPath.startsWith(BASELINE_DIR + path.sep)) {
        throw new Error(\`Visual fingerprint escapes baseline directory for \${caseId}: \${relativePath}\`);
      }
      if (!fs.existsSync(dataPath)) {
        throw new Error(\`Missing visual fingerprint data for \${caseId}: \${relativePath}\`);
      }
      return fs.readFileSync(dataPath, 'utf8').trim();
    }).join('');
  }
  if (fingerprint.data_file) {
    const dataPath = path.resolve(BASELINE_DIR, fingerprint.data_file);
    if (!dataPath.startsWith(BASELINE_DIR + path.sep)) {
      throw new Error(\`Visual fingerprint escapes baseline directory for \${caseId}\`);
    }
    if (!fs.existsSync(dataPath)) throw new Error(\`Missing visual fingerprint data for \${caseId}\`);
    return fs.readFileSync(dataPath, 'utf8').trim();
  }
  return String(fingerprint.data_base64 || '');
}`;

const AUDIT_MULTI_FILE_BLOCK = `    const dataFiles = Array.isArray(fingerprint.data_files)
      ? fingerprint.data_files.filter(Boolean)
      : [];
    if (!dataFiles.length) {
      errors.push(\`\${label}: fingerprint data_files are missing\`);
      return;
    }

    let encoded = '';
    dataFiles.forEach((relativePath) => {
      const dataPath = path.resolve(path.dirname(FOCUS_MANIFEST_PATH), relativePath);
      if (!dataPath.startsWith(path.dirname(FOCUS_MANIFEST_PATH) + path.sep)) {
        errors.push(\`\${label}: fingerprint data escapes baseline directory: \${relativePath}\`);
        return;
      }
      if (!fs.existsSync(dataPath)) {
        errors.push(\`\${label}: fingerprint data file is missing: \${relativePath}\`);
        return;
      }
      encoded += fs.readFileSync(dataPath, 'utf8').trim();
    });
    if (!encoded) return;

    const decoded = Buffer.from(encoded, 'base64');`;

function patchComparator(source) {
  if (source.includes(MARKER)) return { content: source, changed: false };
  const pattern = /function readFingerprintData\(fingerprint, caseId\) \{[\s\S]*?\n\}\n\nfunction compareVisualFingerprint/;
  if (!pattern.test(source)) throw new Error('compare_visual_baseline.js: fingerprint reader not found');
  return {
    content: source.replace(pattern, `${MULTI_FILE_READER}\n\nfunction compareVisualFingerprint`),
    changed: true
  };
}

function patchToolingAudit(source) {
  if (source.includes('fingerprint data_files are missing')) return { content: source, changed: false };
  const pattern = /    const dataPath = path\.resolve\(path\.dirname\(FOCUS_MANIFEST_PATH\), String\(fingerprint\.data_file \|\| ''\)\);[\s\S]*?    const decoded = Buffer\.from\(fs\.readFileSync\(dataPath, 'utf8'\)\.trim\(\), 'base64'\);/;
  if (!pattern.test(source)) throw new Error('audit_visual_capture_tooling.js: single fingerprint data block not found');
  const content = source
    .replace(pattern, AUDIT_MULTI_FILE_BLOCK)
    .replaceAll("'data_file'", "'data_files'");
  return { content, changed: true };
}

function patchDoc(source) {
  if (source.includes('массив `data_files`')) return { content: source, changed: false };
  const marker = '- `data_file` с компактными RGB-значениями всей поверхности кадра;';
  if (!source.includes(marker)) throw new Error('VISUAL-BASELINE-CAPTURE.md: data_file marker not found');
  return {
    content: source.replace(marker, '- массив `data_files` с небольшими частями компактных RGB-значений всей поверхности кадра;'),
    changed: true
  };
}

function patchFile(filePath, patcher, label) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${label}: ${filePath}`);
  const current = fs.readFileSync(filePath, 'utf8');
  const result = patcher(current);
  if (result.changed) fs.writeFileSync(filePath, result.content, 'utf8');
  return result.changed;
}

function patchVisualFingerprintParts() {
  let changed = 0;
  if (patchFile(COMPARE_PATH, patchComparator, 'visual comparator')) changed += 1;
  if (patchFile(TOOLING_AUDIT_PATH, patchToolingAudit, 'visual tooling audit')) changed += 1;
  if (patchFile(DOC_PATH, patchDoc, 'visual baseline documentation')) changed += 1;
  console.log(`Visual fingerprint parts patch OK: ${changed} files updated`);
  return changed;
}

if (require.main === module) patchVisualFingerprintParts();

module.exports = { MARKER, patchComparator, patchToolingAudit, patchDoc, patchVisualFingerprintParts };
