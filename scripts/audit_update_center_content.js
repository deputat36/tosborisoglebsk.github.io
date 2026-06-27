const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'update-tos', 'index.html');
const scenariosPath = path.join(process.cwd(), 'assets', 'js', 'update-center-data.js');
const appPath = path.join(process.cwd(), 'assets', 'js', 'update-center.js');

const requiredScenarios = new Set(['card', 'news', 'photo', 'event', 'project', 'need']);
const requiredPageFiles = [
  '/assets/css/update-center.css',
  '/assets/js/update-center-data.js',
  '/assets/js/update-center.js',
  '/data/toses.json'
];
const requiredControls = [
  'message-builder',
  'scenario-grid',
  'tos-select',
  'dynamic-fields',
  'update-form',
  'message-preview',
  'copy-message',
  'download-message',
  'open-vk',
  'reset-form',
  'required-status',
  'builder-progress'
];
const requiredRoutes = ['/tos/', '/contacts/', '/audit/'];

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

  [pagePath, scenariosPath, appPath].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${filePath}`);
  });

  if (errors.length) {
    throw new Error(`Update center audit failed:\n${errors.join('\n')}`);
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  const app = fs.readFileSync(appPath, 'utf8');
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

  requiredControls.forEach((id) => {
    if (!html.includes(`id="${id}"`)) errors.push(`missing required control #${id}`);
  });

  requiredPageFiles.forEach((filePath) => {
    if (!repoPathExists(filePath)) errors.push(`missing update center dependency ${filePath}`);
    if (filePath !== '/data/toses.json' && !html.includes(filePath)) {
      errors.push(`page does not include dependency ${filePath}`);
    }
  });

  requiredRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`linked route does not exist ${route}`);
    if (!html.includes(`href="${route}"`)) errors.push(`page does not link to ${route}`);
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

    if (!Array.isArray(scenario.fields) || scenario.fields.length < 4) {
      errors.push(`scenario ${scenarioKey} must contain at least 4 fields`);
      return;
    }

    const requiredFields = scenario.fields.filter((field) => field.required);
    if (!requiredFields.length) errors.push(`scenario ${scenarioKey} must have required fields`);

    scenario.fields.forEach((field, index) => {
      const line = `scenario ${scenarioKey} field ${index + 1}`;
      if (!field.name) errors.push(`${line}: missing name`);
      if (!field.label) errors.push(`${line}: missing label`);
      if (field.name && !labels[field.name]) errors.push(`${line}: missing public label for ${field.name}`);
      if (field.type && !['text', 'textarea', 'tel', 'email', 'url', 'date', 'time'].includes(field.type)) {
        errors.push(`${line}: unsupported type ${field.type}`);
      }
    });
  });

  if (!scenarios.card?.fields?.some((field) => field.name === 'source' && field.required)) {
    errors.push('card update scenario must require a confirmation source');
  }

  if (!app.includes("fetch('/data/toses.json'")) {
    errors.push('update center app must load the current TOS catalog');
  }

  if (!app.includes('localStorage') || !app.includes('tos-update-center-draft')) {
    errors.push('update center app must keep a browser-local draft');
  }

  if (!app.includes('navigator.clipboard') || !app.includes('downloadMessage')) {
    errors.push('update center app must support copy and TXT export');
  }

  if (!app.includes('confirmed') || !app.includes('readyToExport')) {
    errors.push('update center app must require confirmation before export');
  }

  if (!app.includes('URLSearchParams(location.search)') || !app.includes("params.get('type')")) {
    errors.push('update center app must support scenario links by query parameter');
  }

  if (errors.length) {
    throw new Error(`Update center audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Update center OK: ${Object.keys(scenarios).length} scenarios`);
}

main();
