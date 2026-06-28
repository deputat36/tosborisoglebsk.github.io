const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'project', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/documents/templates/project-kit/',
  '/projects/',
  '/grants/',
  '/documents/templates/project-problem/',
  '/documents/templates/project-support/',
  '/documents/templates/project-passport/',
  '/documents/templates/project-budget/',
  '/documents/templates/project-schedule/',
  '/documents/templates/project-partner-letter/',
  '/documents/templates/project-checklist/',
  '/documents/templates/project-photo-report/',
  '/documents/templates/project-final-report/',
  '/needs/',
  '/contacts/'
];

const requiredPhrases = [
  'Проект ТОС — от проблемы до итогового отчёта',
  'Проект ТОС: от проблемы до отчёта',
  'Хороший проект начинается с одной понятной проблемы',
  'шаблоны являются рабочими заготовками',
  'Требования конкретного конкурса, программы, партнёра или муниципального органа проверяйте отдельно',
  'Этап 1. Доказать проблему',
  'Проект должен начинаться не с покупки, а с понятной потребности территории',
  'Карточка проблемы',
  'Поддержка жителей',
  'Этап 2. Спроектировать решение',
  'Паспорт проекта',
  'Смета',
  'Календарный план',
  'Этап 3. Найти ресурсы и проверить готовность',
  'Письмо партнёру',
  'Чек-лист готовности',
  'Этап 4. Реализовать и доказать результат',
  'Фотоотчёт',
  'Итоговый отчёт',
  'Рабочая цепочка',
  'Проблема → поддержка → паспорт → смета → план → партнёры → проверка → фотоотчёт → итог',
  'Главное правило',
  'одну доказуемую задачу с понятным результатом'
];

const requiredTemplateNames = [
  'project-kit',
  'project-problem',
  'project-support',
  'project-passport',
  'project-budget',
  'project-schedule',
  'project-partner-letter',
  'project-checklist',
  'project-photo-report',
  'project-final-report'
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

  checkContains(errors, html, 'chairperson/project/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/project/index.html', '<title>Проект ТОС — от проблемы до итогового отчёта</title>');
  checkContains(errors, html, 'chairperson/project/index.html', 'https://tosborisoglebsk.ru/chairperson/project/');
  checkContains(errors, html, 'chairperson/project/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/project/"');
  checkContains(errors, html, 'chairperson/project/index.html', '<meta property="og:type" content="article"');
  checkContains(errors, html, 'chairperson/project/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/project/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/project/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/project/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/project/index.html: missing linked local page ${link}`);
    }
  });

  requiredTemplateNames.forEach((templateName) => {
    if (!html.includes(`/documents/templates/${templateName}/`)) {
      errors.push(`chairperson/project/index.html: missing template link ${templateName}`);
    }
  });

  ['Проблема', 'Проект', 'Результат'].forEach((step) => {
    if (!html.includes(`>${step}<`)) {
      errors.push(`chairperson/project/index.html: missing working-chain step ${step}`);
    }
  });

  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((step) => {
    if (!html.includes(`<span class="tag">${step}</span>`)) {
      errors.push(`chairperson/project/index.html: missing numbered form ${step}`);
    }
  });

  if (!html.includes('Фото до, процесс, после, участники, партнёры, результат и публикации.')) {
    errors.push('chairperson/project/index.html: missing photo report guidance');
  }

  if (!html.includes('План и факт, бюджет, результат, выводы и дальнейшее содержание.')) {
    errors.push('chairperson/project/index.html: missing final report guidance');
  }

  if (errors.length) {
    throw new Error(`Chairperson project content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson project content OK');
}

main();