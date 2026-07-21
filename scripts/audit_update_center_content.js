const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'update-tos', 'index.html');
const scenariosPath = path.join(process.cwd(), 'assets', 'js', 'update-center-data.js');
const qualityPath = path.join(process.cwd(), 'assets', 'js', 'update-center-quality.js');
const queueContractPath = path.join(process.cwd(), 'assets', 'js', 'publication-queue-contract.js');
const editorialExportPath = path.join(process.cwd(), 'assets', 'js', 'update-center-editorial-export.js');
const editorialUiPath = path.join(process.cwd(), 'assets', 'js', 'update-center-editorial-ui.js');
const appPath = path.join(process.cwd(), 'assets', 'js', 'update-center.js');

const requiredScenarios = new Set(['card', 'news', 'photo', 'event', 'project', 'need']);
const requiredPageFiles = [
  '/assets/css/update-center.css',
  '/assets/js/update-center-data.js',
  '/assets/js/update-center-quality.js',
  '/assets/js/publication-queue-contract.js',
  '/assets/js/update-center-editorial-export.js',
  '/assets/js/update-center.js',
  '/assets/js/update-center-editorial-ui.js',
  '/data/toses.json'
];
const requiredControls = [
  'message-builder',
  'scenario-grid',
  'tos-select',
  'dynamic-fields',
  'update-form',
  'confirmed',
  'publication-checked',
  'quality-title',
  'quality-score',
  'quality-summary',
  'quality-list',
  'message-preview',
  'copy-message',
  'download-message',
  'download-intake-csv',
  'download-queue-csv',
  'open-vk',
  'reset-form',
  'required-status',
  'builder-progress'
];
const requiredRoutes = ['/tos/', '/contacts/', '/audit/', '/content-intake/', '/publication-queue/'];

function textMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
}

function loadScenarioData(errors) {
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(scenariosPath, 'utf8'), sandbox, { filename: scenariosPath });
  } catch (error) {
    errors.push(`scenario data is not executable: ${error.message}`);
  }

  return {
    scenarios: sandbox.window.TOS_UPDATE_SCENARIOS || {},
    labels: sandbox.window.TOS_UPDATE_LABELS || {}
  };
}

function main() {
  const errors = [];

  [pagePath, scenariosPath, qualityPath, queueContractPath, editorialExportPath, editorialUiPath, appPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Update center audit failed:\n${errors.join('\n')}`);
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  const app = fs.readFileSync(appPath, 'utf8');
  const quality = fs.readFileSync(qualityPath, 'utf8');
  const queueContract = fs.readFileSync(queueContractPath, 'utf8');
  const editorialExport = fs.readFileSync(editorialExportPath, 'utf8');
  const editorialUi = fs.readFileSync(editorialUiPath, 'utf8');
  const { scenarios, labels } = loadScenarioData(errors);

  const title = textMatch(html, /<title>([^<]+)<\/title>/i);
  const description = textMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/i);

  if (!title.includes('Обновить данные ТОС') || !title.includes('ТОС БГО')) {
    errors.push('page title must identify the TOS update center');
  }

  if (description.length < 90 || !description.includes('конструктор сообщения')) {
    errors.push('meta description must explain the message builder');
  }

  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/update-tos/"')) {
    errors.push('missing canonical link for update center');
  }

  if (!html.includes('Конфиденциальность') || !html.includes('Не присылайте паспортные данные')) {
    errors.push('privacy warning is missing or too weak');
  }

  if (!html.includes('не подтверждает достоверность') || !html.includes('не публикуются автоматически')) {
    errors.push('quality check limitations must be explicit');
  }

  if (!html.includes('оба CSV создаются локально') || !html.includes('не добавляются в очередь автоматически')) {
    errors.push('editorial export boundary must be explicit');
  }

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing required control #${id}`);
  });

  requiredPageFiles.forEach((filePath) => {
    if (!repoPathExists(filePath)) errors.push(`missing update center dependency ${filePath}`);
    if (filePath !== '/data/toses.json' && !html.includes(filePath)) {
      errors.push(`page does not include dependency ${filePath}`);
    }
  });

  const qualityIndex = html.indexOf('/assets/js/update-center-quality.js');
  const contractIndex = html.indexOf('/assets/js/publication-queue-contract.js');
  const exportIndex = html.indexOf('/assets/js/update-center-editorial-export.js');
  const appIndex = html.indexOf('/assets/js/update-center.js');
  const editorialUiIndex = html.indexOf('/assets/js/update-center-editorial-ui.js');
  if (
    qualityIndex < 0 || contractIndex < 0 || exportIndex < 0 || appIndex < 0 || editorialUiIndex < 0 ||
    qualityIndex > contractIndex || contractIndex > exportIndex || exportIndex > appIndex || appIndex > editorialUiIndex
  ) {
    errors.push('quality, queue contract, editorial export, app and editorial UI scripts must load in safe order');
  }

  requiredRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`linked route does not exist ${route}`);
    if (!html.includes(`href="${route}`)) errors.push(`page does not link to ${route}`);
  });

  if (!html.includes('https://vk.ru/tosbgo')) {
    errors.push('page must link to the public VK community');
  }

  if (!html.includes('Материал публикуется после проверки редакцией')) {
    errors.push('page must disclose editorial review before publication');
  }

  requiredScenarios.forEach((scenarioKey) => {
    const scenario = scenarios[scenarioKey];
    if (!scenario) {
      errors.push(`missing scenario ${scenarioKey}`);
      return;
    }

    if (!html.includes(`data-scenario="${scenarioKey}"`)) {
      errors.push(`missing scenario button ${scenarioKey}`);
    }

    if (!scenario.title || !scenario.help) {
      errors.push(`scenario ${scenarioKey} must have title and help`);
    }

    if (!Array.isArray(scenario.fields) || scenario.fields.length < 6) {
      errors.push(`scenario ${scenarioKey} must contain at least 6 fields`);
      return;
    }

    const requiredFields = scenario.fields.filter((field) => field.required);
    if (!requiredFields.length) errors.push(`scenario ${scenarioKey} must have required fields`);

    scenario.fields.forEach((field, index) => {
      const line = `scenario ${scenarioKey} field ${index + 1}`;
      if (!field.name) errors.push(`${line}: missing name`);
      if (!field.label) errors.push(`${line}: missing label`);
      if (field.name && !labels[field.name]) errors.push(`${line}: missing public label for ${field.name}`);
      if (field.type && !['text', 'textarea', 'tel', 'email', 'url', 'date', 'time', 'select'].includes(field.type)) {
        errors.push(`${line}: unsupported type ${field.type}`);
      }
      if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length < 2)) {
        errors.push(`${line}: select must contain at least 2 options`);
      }
    });

    const statusField = scenario.fields.find((field) => field.name === 'material_status');
    if (!statusField?.required || statusField.type !== 'select') {
      errors.push(`scenario ${scenarioKey} must require material_status select`);
    }

    const sourceField = scenario.fields.find((field) => field.name === 'source');
    if (!sourceField?.required) {
      errors.push(`scenario ${scenarioKey} must require a confirmation source`);
    }
  });

  if (!app.includes("fetch('/data/toses.json'")) {
    errors.push('update center app must load the current TOS catalog');
  }

  if (!app.includes('localStorage') || !app.includes('tos-update-center-draft-v3')) {
    errors.push('update center app must keep a browser-local draft');
  }

  if (!app.includes('navigator.clipboard') || !app.includes('downloadMessage')) {
    errors.push('update center app must support copy and TXT export');
  }

  if (!app.includes('TOS_UPDATE_QUALITY') || !app.includes("createElement('select')")) {
    errors.push('update center app must render select fields and use the quality module');
  }

  if (!app.includes('publicationChecked') || !app.includes('publication_checked') || !app.includes('readyToExport')) {
    errors.push('update center app must require both confirmations before export');
  }

  if (!app.includes('URLSearchParams(location.search)') || !app.includes("params.get('type')")) {
    errors.push('update center app must support scenario links by query parameter');
  }

  ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket'].forEach((signal) => {
    if (quality.includes(signal)) errors.push(`quality module must stay local-only: ${signal}`);
    if (queueContract.includes(signal)) errors.push(`queue contract must stay local-only: ${signal}`);
    if (editorialExport.includes(signal)) errors.push(`editorial export module must stay local-only: ${signal}`);
    if (editorialUi.includes(signal)) errors.push(`editorial export UI must stay local-only: ${signal}`);
  });

  if (!quality.includes('missingRequired') || !quality.includes('publicationChecked') || !quality.includes('ready:')) {
    errors.push('quality module must evaluate required fields and publication confirmation');
  }

  if (!queueContract.includes('QUEUE_HEADERS') || !queueContract.includes('INCOMING_ID_PATTERN') || !queueContract.includes('TARGET_FILES')) {
    errors.push('shared publication queue contract is incomplete');
  }

  const requiredExportSignals = [
    'contract.QUEUE_HEADERS',
    'contract.TARGET_FILES',
    'contract.SUBMISSION_TYPES',
    'contract.INCOMING_ID_PATTERN',
    'INTAKE_HEADERS',
    "status: 'draft'",
    "source_checked: 'нет'",
    "permission_checked: 'нет'",
    "personal_data_checked: 'нет'",
    "owner: ''",
    'content_intake',
    'publication_queue'
  ];
  requiredExportSignals.forEach((signal) => {
    if (!editorialExport.includes(signal)) errors.push(`editorial export contract missing ${signal}`);
  });

  if (editorialExport.includes("const QUEUE_HEADERS = [")) {
    errors.push('editorial export must not keep a private copy of queue headers');
  }

  if (!editorialUi.includes('readyForEditorialExport') || !editorialUi.includes('new Blob') || !editorialUi.includes('download-intake-csv') || !editorialUi.includes('download-queue-csv')) {
    errors.push('editorial export UI must gate and download both CSV files');
  }

  if (errors.length) {
    throw new Error(`Update center audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Update center OK: ${Object.keys(scenarios).length} scenarios with shared queue contract and draft editorial export`);
}

main();
