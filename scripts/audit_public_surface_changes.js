const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const registryPath = path.join(root, 'data', 'public_section_registry.json');

function hasNoindex(html) {
  const match = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i);
  return Boolean(match && String(match[1]).toLowerCase().includes('noindex'));
}

function getDiffBase() {
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD^'], { cwd: root, stdio: 'ignore' });
    return 'HEAD^';
  } catch (error) {
    return '';
  }
}

function getChangedFiles(base) {
  if (!base) return [];

  try {
    const output = execFileSync('git', ['diff', '--name-status', base, '--'], {
      cwd: root,
      encoding: 'utf8'
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t');
        const status = parts[0] || '';
        const file = (status.startsWith('R') || status.startsWith('C')) ? parts[2] : parts[1];
        return { status, file: file || '' };
      });
  } catch (error) {
    throw new Error(`Cannot inspect Git diff from ${base}: ${error.message}`);
  }
}

function validateRegistry(registry, errors) {
  if (registry.mode !== 'freeze_new_root_public_sections') {
    errors.push('public surface policy mode must be freeze_new_root_public_sections');
  }

  if (!Array.isArray(registry.approved_new_sections)) {
    errors.push('approved_new_sections must be an array');
    return new Map();
  }

  const entries = new Map();
  for (const entry of registry.approved_new_sections) {
    const required = ['path', 'route', 'status', 'audience', 'user_task', 'owner', 'decision_ref'];
    required.forEach((field) => {
      if (!String(entry[field] || '').trim()) {
        errors.push(`approved section is missing ${field}: ${entry.path || 'unknown'}`);
      }
    });

    if (entry.status !== 'approved') {
      errors.push(`approved section must have status=approved: ${entry.path || 'unknown'}`);
    }

    if (!/^[^/]+\/index\.html$/.test(String(entry.path || ''))) {
      errors.push(`approved section path must be a root index.html: ${entry.path || 'unknown'}`);
    }

    const expectedRoute = entry.path ? `/${entry.path.replace(/index\.html$/, '')}` : '';
    if (entry.route && entry.route !== expectedRoute) {
      errors.push(`route does not match path for ${entry.path}: ${entry.route} !== ${expectedRoute}`);
    }

    if (entries.has(entry.path)) {
      errors.push(`duplicate approved section path: ${entry.path}`);
    }
    entries.set(entry.path, entry);

    const filePath = path.join(root, entry.path || '');
    if (entry.path && !fs.existsSync(filePath)) {
      errors.push(`approved section file does not exist: ${entry.path}`);
    }
  }

  return entries;
}

function main() {
  const errors = [];

  if (!fs.existsSync(registryPath)) {
    throw new Error('Missing data/public_section_registry.json');
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const approved = validateRegistry(registry, errors);
  const base = getDiffBase();
  const changed = getChangedFiles(base);

  const newRootPages = changed.filter(({ status, file }) => {
    const isAdded = status === 'A' || status.startsWith('R') || status.startsWith('C');
    return isAdded && /^[^/]+\/index\.html$/.test(file);
  });

  for (const { file } of newRootPages) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`new root page is missing from working tree: ${file}`);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    if (hasNoindex(html)) continue;

    const entry = approved.get(file);
    if (!entry) {
      errors.push(`new public root section requires registry approval: ${file}`);
      continue;
    }

    if (!html.includes('data-public-section-approved')) {
      errors.push(`approved public root section is missing data-public-section-approved marker: ${file}`);
    }
  }

  if (errors.length) {
    throw new Error(`Public surface audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Public surface policy OK: base=${base || 'unavailable'}, new root pages=${newRootPages.length}, approved entries=${approved.size}`);
}

main();
