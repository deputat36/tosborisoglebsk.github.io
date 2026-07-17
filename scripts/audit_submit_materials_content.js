const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'submit-materials', 'index.html');

const requiredLinks = [
  '/update-tos/',
  '/privacy/',
  '/contacts/',
  '/sources/',
  '/collection-board/',
  '/workbench/'
];

const requiredMaterialTypes = [
  'Новость',
  'Фотоотчёт',
  'Проект',
  'Потребность',
  'Исправление карточки',
  'Логотип и фото'
];

const requiredSections = [
  'Что приложить к материалу',
  'Готовый шаблон сообщения',
  'Что происходит после отправки',
  'Что не стоит отправлять'
];

const requiredTemplateFields = [
  'ТОС:',
  'Тип материала:',
  'Что произошло или что нужно изменить:',
  'Дата и место:',
  'Кто участвовал:',
  'Какой результат:',
  'Кого указать источником:',
  'Какой объём открытой публикации я предполагаю',
  'Что нельзя публиковать, но можно использовать для проверки:',
  'Фото или файлы прикрепляю.'
];

const requiredAfterSteps = [
  'Материал разбирается по типу',
  'Источник и редакционная отметка отправителя фиксируются',
  'Отметка не считается утверждённым разрешением',
  'Черновик можно подготовить',
  'После публикации карточка или материал проверяются повторно'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, html, needle) {
  if (!html.includes(needle)) errors.push(`missing ${needle}`);
}

function main() {
  const html = read(htmlPath);
  const errors = [];

  checkContains(errors, html, '<html lang="ru"');
  checkContains(errors, html, '<title>Как прислать материал на портал ТОС БГО</title>');
  checkContains(errors, html, 'https://tosborisoglebsk.ru/submit-materials/');
  checkContains(errors, html, '<main id="main">');
  checkContains(errors, html, '/assets/js/site.js');
  checkContains(errors, html, 'https://vk.ru/tosbgo');
  checkContains(errors, html, 'Редакционная граница');
  checkContains(errors, html, 'не является юридически проверенным разрешением');
  checkContains(errors, html, 'не подтверждает права на чужие фотографии');
  checkContains(errors, html, '<h3>Редакционная отметка</h3>');
  checkContains(errors, html, 'не доказывает авторство');

  requiredMaterialTypes.forEach((item) => checkContains(errors, html, item));
  requiredSections.forEach((item) => checkContains(errors, html, item));
  requiredTemplateFields.forEach((item) => checkContains(errors, html, item));
  requiredAfterSteps.forEach((item) => checkContains(errors, html, item));

  requiredLinks.forEach((link) => {
    checkContains(errors, html, `href="${link}`);
    if (!repoPathExists(link)) errors.push(`missing linked page ${link}`);
  });

  if (errors.length) {
    throw new Error(`Submit materials content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Submit materials content OK');
}

main();
