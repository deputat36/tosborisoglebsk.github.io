const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const TEST_PATH = path.join(ROOT, 'scripts', 'test_public_link_integrity.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'public-link-integrity.yml');

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

function main() {
  const errors = [];
  [TEST_PATH, WORKFLOW_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Public link integrity tooling audit failed:\n${errors.join('\n')}`);

  const test = fs.readFileSync(TEST_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  requireFragments(errors, 'link test', test, [
    "data/page_index.json",
    "PUBLIC_LINK_BASE_URL",
    "PUBLIC_LINK_REPORT",
    "redirect: 'follow'",
    "new URL(link.raw",
    "kind: 'internal'",
    "javascript URL",
    "missing fragment",
    "schema_version: 1",
    "Public link integrity OK"
  ]);

  requireFragments(errors, 'workflow', workflow, [
    'name: Audit public link integrity',
    'permissions:',
    'contents: read',
    'node-version: \'24\'',
    'node --check scripts/test_public_link_integrity.js',
    'node scripts/audit_public_link_integrity_tooling.js',
    'python3 -m http.server 4173 --bind 127.0.0.1',
    'PUBLIC_LINK_REPORT: .artifacts/public-link-integrity/report.json',
    'node scripts/test_public_link_integrity.js',
    'actions/upload-artifact@v4'
  ]);

  if (/contents:\s*write|pull-requests:\s*write|git\s+(?:commit|push)|git-auto-commit|create-pull-request/i.test(workflow)) {
    errors.push('workflow must remain read-only');
  }
  if (/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(test.replace(/'user-agent':\s*'[^']+'/g, ''))) {
    errors.push('test must not hard-code external network targets');
  }

  try {
    execFileSync(process.execPath, ['--check', TEST_PATH], { cwd: ROOT, stdio: 'pipe' });
  } catch (error) {
    errors.push(`link test syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`Public link integrity tooling audit failed:\n${errors.join('\n')}`);
  console.log('Public link integrity tooling OK: read-only workflow, indexed routes, internal targets and fragments');
}

main();
