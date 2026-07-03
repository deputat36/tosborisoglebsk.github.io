const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'privacy', 'index.html');
const consentPath = path.join(process.cwd(), 'data', 'publication_consent_checklist.csv');

const requiredInternalLinks = [
  '/update-tos/?type=card#message-builder',
  '/sources/',
  '/verification-guide/',
  '/contacts/',
  '/collection-board/',
  '/workbench/'
];

const requiredConsentFields = new Set([
  'contact_person',
  'phone',
  'email',
  'social',
  'photo',
  'logo'
]);

const requiredPhrases = [
  'Персональные данные и публикация сведений ТОС БГО',
  'Правила осторожной публикации телефонов, email, ссылок, фотографий и других сведений',
  'Осторожная публикация',
  'Персональные данные и публикация сведений',
  'Портал публикует только те сведения, которые нужны для открытой работы ТОС и могут размещаться публично',
  'Если есть сомнения, данные лучше уточнить до публикации',
  'Сообщить исправление',
  'Источники данных',
  'Порядок проверки',
  'Контакты',
  'Что можно публиковать',
  'Можно публиковать название ТОС, населённый пункт, границы территории, общие описания работы, новости, проектные идеи, потребности территории',
  'контакты, которые председатель или ответственный представитель разрешил использовать как открытые',
  'Три уровня сведений',
  'Публичные сведения',
  'Публикация после разрешения',
  'Только рабочая информация',
  'Название ТОС, населённый пункт, общие направления работы, опубликованные новости, проекты, потребности и результаты',
  'Телефон, email, ссылка на личную страницу, портретное фото, логотип, фотоотчёт и документы, переданные для размещения',
  'Домашние адреса, паспортные данные, банковские реквизиты, внутренние списки, переписка, спорные сведения',
  'Что требует особой осторожности',
  'личные телефоны и email',
  'ссылки на личные страницы',
  'фотографии людей крупным планом',
  'фотографии детей',
  'адреса проживания, паспортные данные, реквизиты и внутренние документы',
  'материалы, которые могут вызвать спор между жителями без проверки фактов',
  'Перед публикацией ответа',
  'Уточнить, какие контакты, фото и ссылки можно разместить открыто',
  'Сохранить источник и дату ответа',
  'Если есть сомнения, публиковать общий способ связи с ТОС или ссылку на открытую страницу вместо личных данных',
  'После обновления карточки проверить страницу через',
  'Как отправлять материалы безопасно',
  'Не отправляйте документы и сведения, которые не должны находиться в открытом доступе',
  'Как удалить или исправить сведения',
  'Укажите страницу, что именно нужно изменить и какой вариант считать актуальным',
  'Эта страница не заменяет юридическую консультацию',
  'осторожный редакционный подход к публикации открытых сведений о ТОС'
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

function localPathFor(link) {
  return link.split('?')[0].split('#')[0];
}

function main() {
  const html = read(htmlPath);
  const consentRows = parseCsv(read(consentPath));
  const errors = [];

  checkContains(errors, html, 'privacy/index.html', '<html lang="ru"');
  checkContains(errors, html, 'privacy/index.html', '<title>Персональные данные и публикация сведений ТОС БГО</title>');
  checkContains(errors, html, 'privacy/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/privacy/"');
  checkContains(errors, html, 'privacy/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/privacy/"');
  checkContains(errors, html, 'privacy/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'privacy/index.html', '<main id="main">');
  checkContains(errors, html, 'privacy/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'privacy/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'privacy/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`privacy/index.html: missing linked local page ${localPath}`);
    }
  });

  ['Публичные сведения', 'Публикация после разрешения', 'Только рабочая информация'].forEach((level) => {
    if (!html.includes(`<strong>${level}.</strong>`)) {
      errors.push(`privacy/index.html: missing data level ${level}`);
    }
  });

  ['личные телефоны и email', 'фотографии детей', 'паспортные данные', 'банковские реквизиты', 'внутренние документы'].forEach((sensitiveItem) => {
    if (!html.includes(sensitiveItem)) {
      errors.push(`privacy/index.html: missing sensitive item ${sensitiveItem}`);
    }
  });

  if (consentRows.length < 2) {
    errors.push('data/publication_consent_checklist.csv must contain a header and at least one row');
  }

  const consentFields = new Set(consentRows.slice(1).map((row) => (row[1] || '').trim()).filter(Boolean));
  requiredConsentFields.forEach((field) => {
    if (!consentFields.has(field)) {
      errors.push(`data/publication_consent_checklist.csv: missing privacy-sensitive field ${field}`);
    }
  });

  if (errors.length) {
    throw new Error(`Privacy content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Privacy content OK');
}

main();
