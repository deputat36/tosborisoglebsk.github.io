const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'communication-kit', 'index.html');

const requiredInternalLinks = [
  '/tos/',
  '/data-requests/',
  '/collection-board/',
  '/data-quality/',
  '/update-tos/?type=card#message-builder',
  '/chairperson/verify-card/',
  '/workbench/',
  '/update-tos/?type=news#message-builder',
  '/update-tos/?type=photo#message-builder',
  '/update-tos/?type=project#message-builder',
  '/update-tos/?type=need#message-builder',
  '/update-tos/?type=event#message-builder'
];

const requiredPhrases = [
  'Коммуникационный набор ТОС БГО — запуск портала, посты и сообщения',
  'Коммуникационный набор ТОС БГО',
  'Готовые тексты для ВК, личных сообщений, рабочих чатов и обращений к председателям',
  'Как пользоваться:',
  'Не публикуйте закрытые данные, личные переписки, паспортные данные и контакты, которые человек не разрешал размещать открыто',
  'Что сделать после отправки',
  'Отметить отправленное обращение и ожидание ответа на доске сбора',
  'разобрать его в рабочей панели',
  'Передать в карточку только подтверждённые открытые сведения',
  'После публикации проверить карточку и статус сведений',
  'Закреплённый пост для ВК-сообщества',
  'Открыт портал ТОС Борисоглебского городского округа',
  'Просим председателей и активистов проверить карточки своих ТОСов',
  'Короткий анонс для ВК',
  'Пост для ВК: нужны сведения по 4 ТОСам',
  'ТОС «Ивановка»',
  'ТОС «Подстёпки»',
  'ТОС «Губари»',
  'ТОС «Танцырей»',
  'Пост для ВК: проверьте карточку своего ТОС',
  'Пост для ВК: нужны логотипы и фото',
  'Сообщение председателю',
  'Сообщение председателю конкретного ТОС',
  'Короткое сообщение для чата',
  'Ссылки на нужные сценарии',
  'Уточнить карточку',
  'Прислать новость',
  'Прислать фотоотчёт',
  'Предложить проект',
  'Сообщить потребность',
  'Добавить событие',
  'Что собрать по каждому ТОС',
  'Контакты',
  'Визуальные материалы',
  'Содержание'
];

const requiredExternalUrls = [
  'https://tosborisoglebsk.ru/',
  'https://tosborisoglebsk.ru/tos/',
  'https://tosborisoglebsk.ru/chairperson/verify-card/',
  'https://tosborisoglebsk.ru/update-tos/?type=card#message-builder',
  'https://tosborisoglebsk.ru/update-tos/?type=news#message-builder',
  'https://tosborisoglebsk.ru/update-tos/?type=photo#message-builder',
  'https://vk.ru/tosbgo'
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

  checkContains(errors, html, 'communication-kit/index.html', '<html lang="ru"');
  checkContains(errors, html, 'communication-kit/index.html', '<title>Коммуникационный набор ТОС БГО — запуск портала, посты и сообщения</title>');
  checkContains(errors, html, 'communication-kit/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/communication-kit/"');
  checkContains(errors, html, 'communication-kit/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/communication-kit/"');
  checkContains(errors, html, 'communication-kit/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'communication-kit/index.html', '<main id="main">');
  checkContains(errors, html, 'communication-kit/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'communication-kit/index.html', phrase);
  });

  requiredExternalUrls.forEach((url) => {
    checkContains(errors, html, 'communication-kit/index.html', url);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'communication-kit/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`communication-kit/index.html: missing linked local page ${localPath}`);
    }
  });

  ['type=card', 'type=news', 'type=photo', 'type=project', 'type=need', 'type=event'].forEach((scenario) => {
    if (!html.includes(scenario)) {
      errors.push(`communication-kit/index.html: missing message-builder scenario ${scenario}`);
    }
  });

  ['SLUG-ТОС', 'не публиковать', 'только открытые данные', 'подтверждённые открытые сведения'].forEach((privacyPhrase) => {
    if (!html.includes(privacyPhrase)) {
      errors.push(`communication-kit/index.html: missing publication safety phrase ${privacyPhrase}`);
    }
  });

  if (errors.length) {
    throw new Error(`Communication kit content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Communication kit content OK');
}

main();