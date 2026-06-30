const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'registry-intake', 'index.html');

const requiredInternalLinks = [
  '/data/registry_intake_checklist.csv',
  '/data-requests/tos-registry-request/',
  '/registry-check/',
  '/registry-type-check/',
  '/new-tos-card/',
  '/publication-consent/',
  '/verification-evidence/',
  '/verification-readiness/'
];

const requiredPhrases = [
  'Приём официального реестра ТОС БГО',
  'Рабочий порядок приёма официального реестра 46 ТОС БГО',
  'Полный реестр',
  'Приём официального реестра ТОС',
  'Когда будет получен актуальный перечень 46 ТОС БГО, его нельзя сразу превращать в карточки',
  'Сначала нужно зафиксировать источник, нормализовать названия, убрать дубли, сверить с текущими 24 карточками и отделить новые ТОС от переименований',
  'Скачать CSV',
  'Запрос реестра',
  'Сверка каталога',
  'Город/село',
  'Новая карточка',
  '46',
  'ожидаемый полный реестр',
  '24',
  'карточки сейчас',
  '22+',
  'минимум строк на сверку',
  'Основное правило',
  'Новая карточка создаётся только после того, как строка реестра прошла сверку',
  'это не дубль, не переименование существующей карточки, есть официальное название, территория и понятный источник',
  'Контакты и медиа добавляются отдельно после проверки разрешений',
  'Этапы приёма',
  'Что сделать до обновления каталога',
  '1. Получение',
  'Официальный файл или ответ с перечнем 46 ТОС',
  '2. Источник',
  'Дата ответа, отправитель, должность или ссылка',
  'Не обрабатывать как официальный реестр',
  '3. Нормализация',
  '4. Дедупликация',
  '5. Сверка',
  'existing, missing, renamed или needs_review',
  '6. Тип территории',
  'Оставить `unknown` до подтверждения',
  '7. Контакты',
  'Проверить через разрешения на публикацию',
  '8. Новые карточки',
  'Можно делать автоматически',
  'Подготовить черновики новых карточек со статусом `requires_verification`',
  'Нельзя делать автоматически',
  'Публиковать телефоны без разрешения',
  'Считать похожее название новой карточкой без ручной проверки',
  'Повышать статус до `verified` по одному факту наличия в реестре',
  'Добавлять фото и логотипы из сети без источника',
  'Удалять существующие карточки без подтверждения переименования или закрытия ТОС',
  'Следующий шаг после получения файла',
  'Сохранить исходный файл и источник без правок',
  'Заполнить `data/registry_intake_checklist.csv` по этапам',
  'Для контактов и медиа пройти `/publication-consent/`',
  'Рабочий порядок приёма официального реестра ТОС'
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

  checkContains(errors, html, 'registry-intake/index.html', '<html lang="ru"');
  checkContains(errors, html, 'registry-intake/index.html', '<title>Приём официального реестра ТОС БГО</title>');
  checkContains(errors, html, 'registry-intake/index.html', '<meta name="robots" content="noindex,nofollow"');
  checkContains(errors, html, 'registry-intake/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/registry-intake/"');
  checkContains(errors, html, 'registry-intake/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/registry-intake/"');
  checkContains(errors, html, 'registry-intake/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'registry-intake/index.html', '<main id="main">');
  checkContains(errors, html, 'registry-intake/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'registry-intake/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'registry-intake/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`registry-intake/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Registry intake content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Registry intake content OK');
}

main();
