const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'conflicts', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/contacts/',
  '/chairperson/meeting/',
  '/legal/',
  '/chairperson/project/',
  '/needs/',
  '/update-tos/'
];

const requiredPhrases = [
  'Конфликты в ТОС — как председателю вести диалог спокойно',
  'Конфликты в ТОС — памятка председателю',
  'Как председателю ТОС работать с конфликтами',
  'Председатель не обязан решать всё лично',
  'перевести спор из эмоций в факты, обращение, собрание, проект или понятный следующий шаг',
  'Сложные ситуации',
  'Главное правило',
  'не спорить от имени всех жителей и не обещать решений, которые зависят от администрации, служб, бюджета или собственников',
  'Фиксируйте факты и переводите ситуацию в официальный или рабочий порядок',
  'Выслушать и отделить факты',
  'Запишите адрес, дату, участников, суть проблемы, что уже делали, к кому обращались и какой результат нужен',
  'Проверить место и доказательства',
  'Сделайте фото, уточните границы, собственника, зону ответственности и наличие похожих обращений',
  'Определить формат решения',
  'Иногда нужен разговор соседей, иногда собрание, обращение, проект, помощь партнёров или передача вопроса в профильную службу',
  'Сформулировать следующий шаг',
  'Кто отвечает, что делает, до какой даты и где будет опубликован или сохранён результат',
  'Что лучше не делать',
  'Эти ошибки быстро разрушают доверие',
  'Обещать сроки без подтверждения',
  'Публиковать эмоциональные обвинения',
  'Раскрывать лишние персональные данные',
  'Не публикуйте телефоны, адреса, документы и личные сведения жителей без необходимости и согласия',
  'Формула спокойного ответа',
  'Спасибо, вопрос зафиксировали',
  'Нам нужно уточнить: адрес, дату, фото и что уже предпринималось',
  'После проверки предложим следующий шаг: обсуждение, обращение, проект или передача вопроса ответственным службам',
  'Итог сообщим в чате / на странице ТОС',
  'Конфликт можно превратить в проект',
  'Если спор повторяется, затрагивает многих жителей и связан с территорией',
  'фото, адрес, поддержка жителей, смета, партнёры и ожидаемый результат',
  'Оформить проект',
  'Добавить потребность',
  'Передать данные'
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

  checkContains(errors, html, 'chairperson/conflicts/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/conflicts/index.html', '<title>Конфликты в ТОС — как председателю вести диалог спокойно</title>');
  checkContains(errors, html, 'chairperson/conflicts/index.html', 'https://tosborisoglebsk.ru/chairperson/conflicts/');
  checkContains(errors, html, 'chairperson/conflicts/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/conflicts/"');
  checkContains(errors, html, 'chairperson/conflicts/index.html', '<meta property="og:type" content="article"');
  checkContains(errors, html, 'chairperson/conflicts/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/conflicts/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/conflicts/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/conflicts/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/conflicts/index.html: missing linked local page ${link}`);
    }
  });

  ['1', '2', '3', '4'].forEach((step) => {
    if (!html.includes(`<span class="tag">${step}</span>`)) {
      errors.push(`chairperson/conflicts/index.html: missing conflict step ${step}`);
    }
  });

  const warningCount = (html.match(/<span class="tag warn">Не надо<\/span>/g) || []).length;
  if (warningCount < 3) {
    errors.push('chairperson/conflicts/index.html: expected at least 3 warning cards');
  }

  ['обсуждение', 'обращение', 'проект', 'передача вопроса ответственным службам'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`chairperson/conflicts/index.html: missing response route ${route}`);
    }
  });

  if (errors.length) {
    throw new Error(`Chairperson conflicts content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson conflicts content OK');
}

main();