const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const policyPath = path.join(root, 'data', 'private_evidence_reference_policy.json');
const gitignorePath = path.join(root, '.gitignore');

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function walkJson(value, callback, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, callback, [...trail, String(index)]));
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    callback(key, child, [...trail, key]);
    walkJson(child, callback, [...trail, key]);
  }
}

function parseCsvHeader(content) {
  const firstLine = String(content || '').split(/\r?\n/, 1)[0] || '';
  const headers = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    const next = firstLine[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      headers.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  headers.push(value.trim());
  return headers.filter(Boolean);
}

function main() {
  const errors = [];

  if (!fs.existsSync(policyPath)) {
    throw new Error('Missing data/private_evidence_reference_policy.json');
  }

  if (!fs.existsSync(gitignorePath)) {
    throw new Error('Missing .gitignore');
  }

  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  const tracked = listTrackedFiles();
  const forbiddenDirectories = policy.forbidden_directories || [];
  const forbiddenFields = new Set((policy.forbidden_structured_fields || []).map((field) => String(field).toLowerCase()));

  forbiddenDirectories.forEach((directory) => {
    if (!gitignore.split(/\r?\n/).includes(directory)) {
      errors.push(`.gitignore is missing private directory rule: ${directory}`);
    }
  });

  const forbiddenFilePatterns = [
    /(^|\/)(consent|agreement|signature)[-_ ]?(scan|signed)?\.(pdf|jpe?g|png|webp|tiff?)$/i,
    /(^|\/)(passport|snils|bank[-_ ]?(card|account)|personal[-_ ]?document)[^/]*\.(pdf|jpe?g|png|webp|docx?|xlsx?)$/i,
    /\.private\./i,
    /\.consent-scan\./i,
    /\.signature-scan\./i
  ];

  for (const file of tracked) {
    const normalized = file.replace(/\\/g, '/');

    forbiddenDirectories.forEach((directory) => {
      const prefix = directory.replace(/^\.\//, '');
      if (normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix)) {
        errors.push(`private evidence directory must not be tracked: ${file}`);
      }
    });

    forbiddenFilePatterns.forEach((pattern) => {
      if (pattern.test(normalized)) errors.push(`sensitive evidence file must not be tracked: ${file}`);
    });

    const extension = path.extname(normalized).toLowerCase();
    const absolute = path.join(root, normalized);
    if (!fs.existsSync(absolute)) continue;

    if (extension === '.json') {
      const raw = fs.readFileSync(absolute, 'utf8');
      if (!raw.trim()) continue;

      let data;
      try {
        data = JSON.parse(raw);
      } catch (error) {
        errors.push(`${file}: non-empty JSON cannot be parsed for sensitive field audit`);
        continue;
      }

      walkJson(data, (key, value, trail) => {
        const lowerKey = String(key).toLowerCase();
        if (forbiddenFields.has(lowerKey)) {
          errors.push(`${file}: forbidden structured field ${trail.join('.')}`);
        }

        if (lowerKey === 'publication_consent_ref' && value) {
          const ref = String(value);
          if (!/^consent:[a-z0-9][a-z0-9._:-]*$/i.test(ref)) {
            errors.push(`${file}: publication_consent_ref must be an opaque consent: reference`);
          }
          if (/[\s@+]/.test(ref) || /https?:\/\//i.test(ref)) {
            errors.push(`${file}: publication_consent_ref must not expose contact data or a private URL`);
          }
        }
      });
    }

    if (extension === '.csv') {
      const headers = parseCsvHeader(fs.readFileSync(absolute, 'utf8'));
      headers.forEach((header) => {
        if (forbiddenFields.has(String(header).toLowerCase())) {
          errors.push(`${file}: forbidden CSV field ${header}`);
        }
      });
    }
  }

  if (errors.length) {
    throw new Error(`Public repository sensitive data audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Public repository sensitive data OK: ${tracked.length} tracked files checked`);
}

main();
