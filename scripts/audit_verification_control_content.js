const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'verification-control', 'index.html');

const requiredLinks = [
  '/verification-tasks/',
  '/verification-guide/',
  '/verification-levels/',
  '/collection-board/',
  '/workbench/',
  '/update-tos/?type=card#message-builder'
];

const requiredText = [
  'Контроль подтверждения карточек ТОС БГО',
  'Контроль качества',
  'Контроль подтверждения карточек',
  'Зачем нужен контроль',
  'Лестница статусов',
  'Что повышает статус карточки',
  'Что не считается подтверждением',
  'Рабочая отметка после проверки',
  'Требует проверки',
  'Уточняется',
  'Проверено частично',
  'Подтверждено',
  'Устарело',
  'дата',
  'Источник сведений',
  'Новый статус'
];

function main() {
  if (!fs.existsSync(htmlPath)) throw new Error(`Missing file: ${htmlPath}`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const errors = [];

  if (!html.includes('<meta name="robots" content="noindex,nofollow"')) errors.push('missing noindex');
  if (!html.includes('<main id="main">')) errors.push('missing main');
  if (!html.includes('/assets/js/site.js')) errors.push('missing site.js');

  requiredText.forEach((item) => {
    if (!html.includes(item)) errors.push(`missing ${item}`);
  });

  requiredLinks.forEach((link) => {
    if (!html.includes(`href="${link}`)) errors.push(`missing link ${link}`);
    const localPath = link.split('?')[0].split('#')[0];
    if (!repoPathExists(localPath)) errors.push(`missing linked page ${localPath}`);
  });

  if (errors.length) {
    throw new Error(`Verification control audit failed:\n${errors.join('\n')}`);
  }

  console.log('Verification control content OK');
}

main();
