const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'contacts', 'index.html');

const requiredInternalLinks = [
  '/submit-materials/',
  '/update-tos/',
  '/data-requests/',
  '/sources/',
  '/privacy/',
  '/collection-board/',
  '/workbench/',
  '/documents/',
  '/create-tos/',
  '/chairperson/',
  '/tos/'
];

const requiredPhrases = [
  'Контакты портала ТОС БГО',
  'Отправить материал, исправление или вопрос по ТОС',
  'Ирина Алексеевна Сотниченко',
  '+7 (910) 249-82-84',
  'vk.ru/tosbgo',
  'Рабочая почта будет добавлена позже',
  'Что можно отправить',
  'Мини-шаблоны сообщений',
  'Порядок публикации',
  'не отправляйте для публичной публикации лишние персональные данные',
  'Какие сведения можно публиковать открыто'
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

  checkContains(errors, html, 'contacts/index.html', '<html lang="ru"');
  checkContains(errors, html, 'contacts/index.html', '<title>Контакты портала ТОС БГО — отправить новость, проект или исправление</title>');
  checkContains(errors, html, 'contacts/index.html', 'https://tosborisoglebsk.ru/contacts/');
  checkContains(errors, html, 'contacts/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/contacts/"');
  checkContains(errors, html, 'contacts/index.html', '<main id="main">');
  checkContains(errors, html, 'contacts/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'contacts/index.html', 'href="tel:+79102498284"');
  checkContains(errors, html, 'contacts/index.html', 'href="https://vk.ru/tosbgo" target="_blank" rel="noopener"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'contacts/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'contacts/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`contacts/index.html: missing linked local page ${link}`);
    }
  });

  if (!html.includes('type=card#message-builder')) {
    errors.push('contacts/index.html: missing card update message builder link');
  }

  if (!html.includes('type=news#message-builder')) {
    errors.push('contacts/index.html: missing news message builder link');
  }

  if (!html.includes('type=need#message-builder')) {
    errors.push('contacts/index.html: missing need message builder link');
  }

  if (!html.includes('type=project#message-builder')) {
    errors.push('contacts/index.html: missing project message builder link');
  }

  if (errors.length) {
    throw new Error(`Contacts page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Contacts page content OK');
}

main();
