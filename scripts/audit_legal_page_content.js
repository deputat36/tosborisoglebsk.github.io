const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'legal', 'index.html');

const requiredInternalLinks = [
  '/documents/',
  '/create-tos/',
  '/chairperson/',
  '/contacts/'
];

const requiredPhrases = [
  'Правовая основа ТОС простыми словами',
  'раздел носит информационный характер',
  'не является официальным толкованием законодательства',
  'Федеральный закон №33-ФЗ',
  'Устав БГО',
  'Закон Воронежской области №116-ОЗ',
  'утратил силу',
  'регистрация устава ТОС',
  'Государственная регистрация НКО — отдельная процедура',
  'границы установлены решением представительного органа',
  'собрание или конференция граждан',
  'Проверить документы'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) {
    errors.push(`${label}: missing ${needle}`);
  }
}

function main() {
  const html = read(htmlPath);
  const errors = [];

  checkContains(errors, html, 'legal/index.html', '<html lang="ru"');
  checkContains(errors, html, 'legal/index.html', '<title>Правовая основа ТОС простыми словами — ТОС БГО</title>');
  checkContains(errors, html, 'legal/index.html', 'https://tosborisoglebsk.ru/legal/');
  checkContains(errors, html, 'legal/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/legal/"');
  checkContains(errors, html, 'legal/index.html', '<main id="main">');
  checkContains(errors, html, 'legal/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'legal/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'legal/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`legal/index.html: missing linked local page ${link}`);
    }
  });

  if (!html.includes('tag warn')) {
    errors.push('legal/index.html: missing warning tags for non-current or check-required documents');
  }

  if (!html.includes('tag ok')) {
    errors.push('legal/index.html: missing ok tag for federal foundation block');
  }

  if (errors.length) {
    throw new Error(`Legal page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Legal page content OK');
}

main();
