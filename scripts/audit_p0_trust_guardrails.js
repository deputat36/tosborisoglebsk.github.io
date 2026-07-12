const fs = require('fs');
const path = require('path');

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'generate-tos-pages.yml');
const documentsPath = path.join(root, 'data', 'documents.json');

const publicPages = [
  'index.html',
  'tos/index.html',
  'residents/index.html',
  'partners/index.html',
  'projects/index.html',
  'needs/index.html',
  'done/index.html',
  'calendar/index.html',
  'documents/index.html',
  'legal/index.html',
  'create-tos/index.html',
  'contacts/index.html'
];

const forbiddenStarterCommands = [
  'node scripts/generate_tos_starter_content.js',
  'node scripts/generate_tos_starter_news.js',
  'node scripts/generate_tos_starter_done.js'
];

function main() {
  const errors = [];

  if (!fs.existsSync(workflowPath)) {
    errors.push('missing main generation workflow');
  } else {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    forbiddenStarterCommands.forEach((command) => {
      if (workflow.includes(command)) {
        errors.push(`automatic starter content generation must stay disabled: ${command}`);
      }
    });

    if (!workflow.includes('node scripts/patch_p0_public_trust.js')) {
      errors.push('main workflow must run patch_p0_public_trust.js');
    }

    if (!workflow.includes('node scripts/audit_p0_trust_guardrails.js')) {
      errors.push('main workflow must run audit_p0_trust_guardrails.js');
    }
  }

  publicPages.forEach((relativePath) => {
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) {
      errors.push(`missing key public page: ${relativePath}`);
      return;
    }

    const html = fs.readFileSync(filePath, 'utf8');
    if (!html.includes('data-portal-working-status')) {
      errors.push(`working-version status is missing: ${relativePath}`);
    }
    if (!html.includes('/data-update/') || !html.includes('/sources/')) {
      errors.push(`working-version links are incomplete: ${relativePath}`);
    }
  });

  const homePath = path.join(root, 'index.html');
  if (fs.existsSync(homePath)) {
    const home = fs.readFileSync(homePath, 'utf8');
    if (home.includes('реальные истории благоустройства')) {
      errors.push('homepage must not promise verified real stories while verified results are absent');
    }
  }

  if (!fs.existsSync(documentsPath)) {
    errors.push('missing data/documents.json');
  } else {
    const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
    const charter = documents.find((item) => item.title === 'Устав Борисоглебского городского округа');

    if (!charter) {
      errors.push('BGO charter entry is missing');
    } else {
      if (!String(charter.status || '').includes('требует официальной сверки')) {
        errors.push('BGO charter must be marked as requiring official verification');
      }
      if (charter.legal_applicability !== 'requires_official_check') {
        errors.push('BGO charter legal_applicability must be requires_official_check');
      }
      if (String(charter.status || '').startsWith('Действующий')) {
        errors.push('local BGO charter copy must not be presented as verified current law');
      }
      if (/действующая редакция/i.test(String(charter.description || ''))) {
        errors.push('BGO charter description must not claim a current verified edition');
      }
      if (charter.official_source_url && !charter.legal_checked_at) {
        errors.push('official_source_url requires legal_checked_at');
      }
    }
  }

  if (errors.length) {
    throw new Error(`P0 trust guardrails audit failed:\n${errors.join('\n')}`);
  }

  console.log(`P0 trust guardrails OK: ${publicPages.length} key pages checked`);
}

main();
