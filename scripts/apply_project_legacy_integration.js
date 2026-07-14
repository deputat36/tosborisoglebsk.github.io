const fs = require('fs');

function insertAfter(text, marker, addition, label) {
  if (text.includes(addition.trim())) return text;
  const index = text.indexOf(marker);
  if (index < 0) throw new Error(`Missing integration marker: ${label}`);
  const end = index + marker.length;
  return `${text.slice(0, end)}${addition}${text.slice(end)}`;
}

const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.scripts['test:project-legacy-redirects'] = 'node scripts/test_project_legacy_redirects.js';
if (!packageJson.scripts['audit:all'].includes('npm run test:project-legacy-redirects')) {
  packageJson.scripts['audit:all'] = packageJson.scripts['audit:all'].replace(
    'npm run audit:vk-workflow &&',
    'npm run audit:vk-workflow && npm run test:project-legacy-redirects &&'
  );
}
if (!packageJson.scripts['audit:all'].includes('npm run test:project-legacy-redirects')) {
  throw new Error('Could not add project legacy redirect self-test to audit:all');
}
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

const normalPath = 'scripts/audit_project_mode.js';
let normal = fs.readFileSync(normalPath, 'utf8');
normal = insertAfter(
  normal,
  "  ['VK workflow topology', 'scripts/audit_vk_workflow_topology.js'],\n",
  "  ['Project legacy redirects self-test', 'scripts/test_project_legacy_redirects.js'],\n",
  'normal project-mode VK audit'
);
fs.writeFileSync(normalPath, normal, 'utf8');

const fullPath = 'scripts/audit_project_mode_full.js';
let full = fs.readFileSync(fullPath, 'utf8');
full = insertAfter(
  full,
  "  ['VK workflow topology audit', 'scripts/audit_vk_workflow_topology.js'],\n",
  "  ['Project legacy redirects self-test', 'scripts/test_project_legacy_redirects.js'],\n",
  'full project-mode VK audit'
);
fs.writeFileSync(fullPath, full, 'utf8');

const workflowPath = '.github/workflows/generate-tos-pages.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
workflow = insertAfter(
  workflow,
  '      - name: Generate project pages\n        run: node scripts/generate_project_pages.js\n',
  "      - name: Audit project legacy redirects\n        env:\n          PROJECT_LEGACY_REDIRECTS_STRICT: 'true'\n        run: node scripts/audit_projects_integrity.js\n",
  'project generator step'
);
fs.writeFileSync(workflowPath, workflow, 'utf8');

console.log('Project legacy redirect integration applied');
