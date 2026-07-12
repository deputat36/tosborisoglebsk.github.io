const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'sections', 'index.html');

const primaryRoutes = [
  '/tos/',
  '/residents/',
  '/chairperson/',
  '/projects/',
  '/documents/',
  '/contacts/'
];

const requiredPublicRoutes = [
  '/',
  '/tos/',
  '/residents/',
  '/residents/action-routes/',
  '/chairperson/',
  '/chairperson/action-routes/',
  '/partners/',
  '/partners/action-routes/',
  '/projects/',
  '/documents/',
  '/contacts/',
  '/news/',
  '/calendar/',
  '/done/',
  '/needs/',
  '/create-tos/',
  '/create-tos/action-routes/',
  '/legal/',
  '/sources/',
  '/data-quality/',
  '/faq/',
  '/map/',
  '/search/',
  '/update-tos/',
  '/workbench/'
];

const forbiddenIndividualServiceRoutes = [
  '/site-health/',
  '/verification-tasks/',
  '/open-data/',
  '/improvement-plan/',
  '/collection-board/',
  '/data-dictionary/',
  '/data-requests/',
  '/source-watch/',
  '/content-discovery/',
  '/publication-queue/',
  '/editorial-calendar/',
  '/campaign/',
  '/field-checklist/'
];

const requiredCopy = [
  'Основные разделы',
  'Маршруты по роли',
  'Дополнительные публичные разделы',
  'Состояние геоданных',
  'Служебные инструменты собраны в рабочей панели',
  'Не нашли нужный маршрут?'
];

const forbiddenLegacyCopy = [
  'Рабочий контроль сайта',
  'Аудит сайта',
  'Задачи проверки',
  'Доска сбора данных',
  'Справочник данных'
];

function countMatches(content, pattern) {
  return (content.match(pattern) || []).length;
}

function extractSection(html, className) {
  const pattern = new RegExp(`<section class="${className}"[\\s\\S]*?<\\/section>`);
  const match = html.match(pattern);
  return match ? match[0] : '';
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing sections page: ${filePath}`);
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const hero = extractSection(html, 'hero');

  if (!html.includes('<title>Разделы портала ТОС БГО</title>')) {
    errors.push('sections page title must identify the public navigator');
  }

  if (!html.includes('<link rel="canonical" href="https://tosborisoglebsk.ru/sections/"')) {
    errors.push('sections page canonical is missing');
  }

  if (!html.includes('<h1>Разделы портала ТОС БГО</h1>')) {
    errors.push('sections page h1 is missing');
  }

  requiredCopy.forEach((copy) => {
    if (!html.includes(copy)) errors.push(`sections page is missing copy block: ${copy}`);
  });

  forbiddenLegacyCopy.forEach((copy) => {
    if (html.includes(copy)) errors.push(`legacy editorial showcase must not remain on sections page: ${copy}`);
  });

  requiredPublicRoutes.forEach((route) => {
    if (!repoPathExists(route)) errors.push(`sections route target is missing: ${route}`);
  });

  primaryRoutes.forEach((route) => {
    if (!html.includes(`href="${route}"`)) errors.push(`primary public section is missing: ${route}`);
  });

  const primaryCardCount = countMatches(html, /data-sections-primary/g);
  if (primaryCardCount !== 7) {
    errors.push(`sections page must contain exactly 7 primary cards, found ${primaryCardCount}`);
  }

  forbiddenIndividualServiceRoutes.forEach((route) => {
    if (html.includes(`href="${route}"`)) {
      errors.push(`individual editorial route must not be exposed on public sections page: ${route}`);
    }
  });

  const workbenchLinks = countMatches(html, /href="\/workbench\/"/g);
  if (workbenchLinks !== 1) {
    errors.push(`sections page must expose exactly one workbench entry, found ${workbenchLinks}`);
  }

  if (hero.includes('/workbench/') || hero.includes('/site-health/') || hero.includes('/verification-tasks/') || hero.includes('/open-data/')) {
    errors.push('hero must contain only public user routes');
  }

  if (!html.includes('<h3>Состояние геоданных</h3>') || !html.includes('нельзя считать официальными без подтверждённых геометрий')) {
    errors.push('map route must be presented as data status, not as an accurate public map');
  }

  if (hero.includes('/map/') || html.match(/data-sections-primary[\s\S]{0,800}href="\/map\/"/)) {
    errors.push('map route must not be a hero or primary route');
  }

  if (!html.includes('<b>Рабочая версия:</b>')) {
    errors.push('sections page must disclose working-version status');
  }

  if (!html.includes('не является официальным обращением')) {
    errors.push('sections page must distinguish editorial contact from an official appeal');
  }

  if (!html.includes('data-action="menu"') || !html.includes('aria-controls="site-nav"')) {
    errors.push('mobile menu control must target site navigation');
  }

  if (!html.includes('data-action="theme"')) {
    errors.push('theme toggle is missing');
  }

  if (errors.length) {
    throw new Error(`Sections page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Public sections page content OK');
}

main();
