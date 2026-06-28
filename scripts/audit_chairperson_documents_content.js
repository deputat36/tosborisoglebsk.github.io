const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'documents', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/documents/',
  '/chairperson/meeting/',
  '/chairperson/project/'
];

const requiredPhrases = [
  'Архив документов ТОС — что хранить председателю',
  'Архив документов ТОС',
  'Что хранить в архиве ТОС',
  'Архив нужен не для бюрократии',
  'Учредительные и основные документы',
  'Устав или положение о ТОС',
  'Решение о создании и границах',
  'Сведения о председателе и органах ТОС',
  'Актуальные контакты и дата проверки',
  'Собрания и конференции',
  'Объявления о проведении',
  'Повестки и проекты решений',
  'Протоколы и списки участников',
  'Итоги голосования и приложения',
  'Проектные материалы',
  'Фото до начала работ',
  'Описание проблемы и цели',
  'Сметы и коммерческие предложения',
  'Письма поддержки и вклад жителей',
  'Фотоотчёты и публикации',
  'Фото процесса и результата',
  'Ссылки на новости',
  'Благодарности партнёрам',
  'Истории результата для портала',
  'Обращения и ответы',
  'Копии обращений',
  'Входящие ответы',
  'Даты отправки и получения',
  'Следующие шаги и ответственные',
  'Персональные данные',
  'Не храните и не публикуйте лишние персональные данные без необходимости',
  'Простая структура папок',
  'Чтобы любой активист быстро нашёл нужный материал',
  'после любого события сразу сохраняйте 3 вещи: короткий текст, 3–10 фото и список участников/партнёров'
];

const requiredFolderNames = [
  'Документы ТОС',
  'Собрания',
  'Проекты',
  'Новости',
  'Обращения',
  'Партнёры'
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

  checkContains(errors, html, 'chairperson/documents/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/documents/index.html', '<title>Архив документов ТОС — что хранить председателю</title>');
  checkContains(errors, html, 'chairperson/documents/index.html', 'https://tosborisoglebsk.ru/chairperson/documents/');
  checkContains(errors, html, 'chairperson/documents/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/documents/"');
  checkContains(errors, html, 'chairperson/documents/index.html', '<meta property="og:type" content="article"');
  checkContains(errors, html, 'chairperson/documents/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/documents/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/documents/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/documents/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/documents/index.html: missing linked local page ${link}`);
    }
  });

  ['База', 'Решения', 'Проекты', 'Публичность', 'Связь', 'Безопасность'].forEach((tag) => {
    if (!html.includes(`>${tag}</span>`)) {
      errors.push(`chairperson/documents/index.html: missing archive card tag ${tag}`);
    }
  });

  ['01', '02', '03', '04', '05', '06'].forEach((step) => {
    if (!html.includes(`<span class="tag">${step}</span>`)) {
      errors.push(`chairperson/documents/index.html: missing folder step ${step}`);
    }
  });

  requiredFolderNames.forEach((folderName) => {
    checkContains(errors, html, 'chairperson/documents/index.html', folderName);
  });

  if (!html.includes('Доступ к спискам, телефонам, паспортным данным и адресам должен быть ограничен.')) {
    errors.push('chairperson/documents/index.html: missing personal data access limitation');
  }

  if (errors.length) {
    throw new Error(`Chairperson documents content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson documents content OK');
}

main();