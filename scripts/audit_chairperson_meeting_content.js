const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'meeting', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/chairperson/documents/',
  '/contacts/',
  '/documents/templates/meeting-agenda/',
  '/documents/templates/meeting-registration/',
  '/documents/templates/meeting-protocol/',
  '/docs/templates/kratkiy-itog-sobraniya-tos.txt'
];

const requiredPhrases = [
  'Собрание ТОС — чек-лист и документы председателя',
  'Как провести собрание ТОС без путаницы',
  'Подготовьте вопросы, зарегистрируйте участников, зафиксируйте решения',
  'шаблоны рекомендательные',
  'Порядок уведомления, правомочность, голосование и состав приложений',
  'Готовый пакет документов',
  'Повестка',
  'Лист участников',
  'Протокол',
  'Краткий итог для жителей',
  'Подготовка',
  'Проведение',
  'Оформление',
  'Что должно быть в протоколе',
  'Общие сведения',
  'Рассмотрение вопросов',
  'Исполнение',
  'После собрания:',
  'без регистрационных листов, подписей и других закрытых сведений участников'
];

const requiredChecklistItems = [
  'Определить цель и вопросы повестки.',
  'Подготовить проекты решений и приложения.',
  'Уведомить жителей установленным способом.',
  'Подготовить место и лист регистрации.',
  'Выбрать председательствующего и секретаря.',
  'Зафиксировать присутствующих.',
  'Обсудить каждый вопрос отдельно.',
  'Записать голосование, ответственных и сроки.',
  'Подписать протокол и приложения.',
  'Сохранить регистрационные листы и материалы.',
  'Сообщить жителям краткий итог.',
  'Передать решения в дальнейшую работу.'
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

  checkContains(errors, html, 'chairperson/meeting/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/meeting/index.html', '<title>Собрание ТОС — чек-лист и документы председателя</title>');
  checkContains(errors, html, 'chairperson/meeting/index.html', 'https://tosborisoglebsk.ru/chairperson/meeting/');
  checkContains(errors, html, 'chairperson/meeting/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/meeting/"');
  checkContains(errors, html, 'chairperson/meeting/index.html', '<meta property="og:type" content="article"');
  checkContains(errors, html, 'chairperson/meeting/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/meeting/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'chairperson/meeting/index.html', 'id="meeting-documents"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/meeting/index.html', phrase);
  });

  requiredChecklistItems.forEach((item) => {
    checkContains(errors, html, 'chairperson/meeting/index.html', item);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/meeting/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/meeting/index.html: missing linked local page ${link}`);
    }
  });

  ['До собрания', 'Регистрация', 'Решения', 'После собрания'].forEach((step) => {
    if (!html.includes(`>${step}<`)) {
      errors.push(`chairperson/meeting/index.html: missing document package step ${step}`);
    }
  });

  if (!html.includes('Дата, место, форма проведения')) {
    errors.push('chairperson/meeting/index.html: missing protocol basics guidance');
  }

  if (!html.includes('Ответственные, сроки, следующий шаг')) {
    errors.push('chairperson/meeting/index.html: missing protocol execution guidance');
  }

  if (errors.length) {
    throw new Error(`Chairperson meeting content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson meeting content OK');
}

main();