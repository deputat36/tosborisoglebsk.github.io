const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'publication-consent', 'index.html');

const requiredInternalLinks = [
  '/data/publication_consent_checklist.csv',
  '/verification-pilot/',
  '/reply-review/',
  '/verification-guide/',
  '/update-tos/',
  '/reply-review/'
];

const requiredPhrases = [
  'Разрешения на публикацию данных ТОС БГО',
  'Рабочий чек-лист перед публикацией контактов, фото, логотипов и сведений карточек ТОС БГО',
  'Публикация данных',
  'Разрешения на публикацию данных',
  'Перед публикацией телефона, email, имени ответственного лица, фото, логотипа или результата проекта нужно понимать источник и разрешение на открытую публикацию',
  'Эта страница — редакционный чек-лист, а не юридическое заключение',
  'Скачать CSV',
  'Пилот верификации',
  'Разбор ответа',
  'Инструкция',
  'Обновить карточку',
  'проверяемых полей',
  'публикаций без источника',
  'сомневаешься — уточняй',
  'Базовое правило',
  'Если поле относится к человеку, личному контакту или авторскому медиа, оно не публикуется по умолчанию',
  'Нужен источник и понятное подтверждение, что эти сведения можно размещать открыто на сайте',
  'Что проверять',
  'Минимальный контроль перед обновлением карточки',
  'Название ТОС',
  'Территория',
  'Председатель или ответственное лицо',
  'Телефон или email',
  'Соцсеть или группа',
  'Фото и логотип',
  'Проекты и результаты',
  'Дата проверки',
  'Безопасная публикация',
  'Публиковать только поля с понятным источником',
  'Отделять публичные контакты от личных контактов для внутренней связи',
  'Сохранять дату подтверждения в карточке или рабочей таблице',
  'Фото и логотипы принимать от представителя ТОС или из разрешённого источника',
  'Оставить на уточнение',
  'Нет подтверждения, что телефон можно разместить на сайте',
  'Ответ пришёл от человека, чья роль неясна',
  'Есть фото без автора и места съёмки',
  'Источник старый или противоречит текущей карточке',
  'Короткий запрос разрешения',
  'Подтвердите, пожалуйста, какие сведения можно разместить открыто',
  'Если какие-то данные нужны только для внутренней связи и не должны публиковаться, отметьте это отдельно',
  'Рабочий чек-лист разрешений на публикацию'
];

const requiredTableLabels = [
  'Факт',
  'Персональные данные',
  'Контакт',
  'Публичный канал',
  'Медиа',
  'Метаданные'
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
  const errors = [];

  checkContains(errors, html, 'publication-consent/index.html', '<html lang="ru"');
  checkContains(errors, html, 'publication-consent/index.html', '<title>Разрешения на публикацию данных ТОС БГО</title>');
  checkContains(errors, html, 'publication-consent/index.html', '<meta name="robots" content="noindex,nofollow"');
  checkContains(errors, html, 'publication-consent/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/publication-consent/"');
  checkContains(errors, html, 'publication-consent/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/publication-consent/"');
  checkContains(errors, html, 'publication-consent/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'publication-consent/index.html', '<main id="main">');
  checkContains(errors, html, 'publication-consent/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'publication-consent/index.html', phrase);
  });

  requiredTableLabels.forEach((label) => {
    checkContains(errors, html, 'publication-consent/index.html', label);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'publication-consent/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`publication-consent/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Publication consent content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Publication consent content OK');
}

main();
