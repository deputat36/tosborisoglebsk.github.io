#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireToken(content, token, label) {
  if (!content.includes(token)) errors.push(`${label} is missing token: ${token}`);
}

function forbidToken(content, token, label) {
  if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
}

const workflow = read('.github/workflows/public-deployment-smoke.yml');
const library = read('scripts/lib/public_deployment_smoke.js');
const runner = read('scripts/public_deployment_smoke.js');
const test = read('scripts/test_public_deployment_smoke.js');
const docs = read('docs/PUBLIC-DEPLOYMENT-SMOKE.md');
const packageJsonText = read('package.json');
const projectMode = read('scripts/audit_project_mode.js');
const projectModeFull = read('scripts/audit_project_mode_full.js');

for (const token of [
  'pull_request:',
  'workflow_dispatch:',
  'schedule:',
  'workflow_run:',
  'Generate TOS pages',
  'contents: read',
  "github.event.pull_request.head.sha",
  "'release-2025-12-22'",
  'npm run test:public-deployment-smoke',
  'npm run audit:public-deployment-smoke-contract',
  'npm run smoke:public-deployment',
  'Upload public deployment diagnostics'
]) requireToken(workflow, token, 'public deployment workflow');

for (const token of [
  'contents: write',
  'git push',
  'git-auto-commit',
  'actions_diagnostics.csv',
  'update_file',
  'curl -X POST',
  'curl -X PUT',
  'curl -X PATCH',
  'curl -X DELETE'
]) forbidToken(workflow, token, 'public deployment workflow');

for (const token of [
  "fs.readFileSync(cnamePath, 'utf8').trim()",
  'env.GITHUB_REPOSITORY',
  "localPath: 'index.html'",
  "localPath: 'data/site_health.json'",
  "localPath: 'actions-check/index.html'",
  "localPath: 'sitemap.xml'",
  "id: 'github-pages-alias'",
  'Published content hash does not match repository file',
  'blockingFailures.length === 0',
  'PUBLIC_DEPLOYMENT_ATTEMPTS',
  'PUBLIC_DEPLOYMENT_RETRY_DELAY_MS',
  'PUBLIC_DEPLOYMENT_TIMEOUT_MS',
  'report.blocking_failures',
  'report.warnings'
]) requireToken(library, token, 'public deployment library');

for (const token of [
  'actions_diagnostics.csv',
  'publication_consent_ref',
  'fs.writeFileSync(path.join(root, \'data\''
]) forbidToken(library, token, 'public deployment library');

for (const token of [
  "require('./lib/public_deployment_smoke')",
  'process.exitCode = 1',
  'repository_match='
]) requireToken(runner, token, 'public deployment runner');

for (const token of [
  'A stale first response must recover on retry',
  'A repository hash mismatch must fail',
  'Optional alias failure must remain a warning',
  'Public deployment smoke self-test OK'
]) requireToken(test, token, 'public deployment self-test');

for (const token of [
  'не заменяет ручную проверку Settings → Pages',
  'не изменяет `data/actions_diagnostics.csv`',
  'точное совпадение опубликованных файлов',
  'GitHub Pages URL',
  'custom domain',
  'read-only'
]) requireToken(docs, token, 'public deployment documentation');

let packageJson = null;
try {
  packageJson = JSON.parse(packageJsonText);
} catch (error) {
  errors.push(`package.json is invalid JSON: ${error.message}`);
}

if (packageJson) {
  const expectedScripts = {
    'smoke:public-deployment': 'node scripts/public_deployment_smoke.js',
    'test:public-deployment-smoke': 'node scripts/test_public_deployment_smoke.js',
    'audit:public-deployment-smoke-contract': 'node scripts/audit_public_deployment_smoke_contract.js'
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (packageJson.scripts?.[name] !== command) errors.push(`package.json script ${name} must equal: ${command}`);
  }
  const auditAll = packageJson.scripts?.['audit:all'] || '';
  for (const command of ['npm run test:public-deployment-smoke', 'npm run audit:public-deployment-smoke-contract']) {
    if (!auditAll.includes(command)) errors.push(`audit:all is missing: ${command}`);
  }
}

for (const [label, content] of [
  ['project mode', projectMode],
  ['full project mode', projectModeFull]
]) {
  requireToken(content, "['Public deployment smoke self-test', 'scripts/test_public_deployment_smoke.js']", label);
  requireToken(content, "['Public deployment smoke contract', 'scripts/audit_public_deployment_smoke_contract.js']", label);
}

if (errors.length) {
  console.error('Public deployment smoke contract audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Public deployment smoke contract audit OK');
