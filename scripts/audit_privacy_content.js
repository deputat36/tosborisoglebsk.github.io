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
  'Текущий статус готовности портала и редакционные правила осторожной публикации',
  'Осторожная публикация',
  'редакционная памятка, а не юридически утверждённая политика',
  'Юридически утверждённая политика обработки персональных данных пока не опубликована',
  'Оператор портала пока не определён',
  'Что действует сейчас',
  'оригиналы согласий и закрытые доказательства нельзя загружать в публичный GitHub',
  'Что ещё не завершено',
  'назначение оператора портала и ответственного за данные',
  'подготовка формы согласия на распространение конкретного перечня сведений',
  'Три уровня сведений',
  'Публичные сведения',
  'Публикация после отдельного подтверждения',
  'Только закрытая рабочая информация',
  'личные телефоны и email',
  'фотографии детей',
  'паспортные данные',
  'банковские реквизиты',
  'Что не является согласием',
  'не является согласием на обработку или распространение персональных данных',
  'Перед публикацией сведений',
  'publication_consent_ref',
  'Сам оригинал не размещать в публичном репозитории',
  'Как отправлять материалы безопасно',
  'Отзыв, исправление и удаление',
  'Отдельный юридически проверенный порядок пока не утверждён',
  'Этот временный маршрут не выдаётся за окончательно утверждённую процедуру',
  'Она не является юридическим заключением, утверждённой политикой или формой согласия'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
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

  requiredPhrases.forEach((phrase) => checkContains(errors, html, 'privacy/index.html', phrase));

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'privacy/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) errors.push(`privacy/index.html: missing linked local page ${localPath}`);
  });

  ['Публичные сведения', 'Публикация после отдельного подтверждения', 'Только закрытая рабочая информация'].forEach((level) => {
    if (!html.includes(`<strong>${level}.</strong>`)) errors.push(`privacy/index.html: missing data level ${level}`);
  });

  if (/<form\b/i.test(html)) errors.push('privacy/index.html must not collect data before legal readiness');
  if (/действующ(?:ая|ей)\s+политик(?:а|и)\s+обработки\s+персональных\s+данных/i.test(html)) {
    errors.push('privacy/index.html must not claim that a formal policy is in force');
  }

  if (consentRows.length < 2) errors.push('data/publication_consent_checklist.csv must contain a header and at least one row');
  const consentFields = new Set(consentRows.slice(1).map((row) => (row[1] || '').trim()).filter(Boolean));
  requiredConsentFields.forEach((field) => {
    if (!consentFields.has(field)) errors.push(`data/publication_consent_checklist.csv: missing privacy-sensitive field ${field}`);
  });

  if (errors.length) throw new Error(`Privacy content audit failed:\n${errors.join('\n')}`);
  console.log('Privacy content OK: editorial guidance is clearly separated from formal legal readiness');
}

main();
