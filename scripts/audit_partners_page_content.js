const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'partners', 'index.html');

const requiredInternalLinks = [
  '/partners/action-routes/',
  '/needs/',
  '/projects/',
  '/done/',
  '/contacts/',
  '/partner-thanks/',
  '/faq/'
];

const requiredPhrases = [
  'Партнёрам ТОС БГО — как помочь территориям и проектам',
  'Помочь ТОСам можно конкретным делом',
  'ТОСам часто нужна не только финансовая помощь',
  'Смысл партнёрства',
  'Что подтвердить до передачи помощи',
  'Предложение ресурса ещё не означает заключённое партнёрство',
  'Проверить, что задача ещё нужна',
  'Определить, кто принимает ресурс',
  'Согласовать границы помощи',
  'Отдельно согласовать упоминание',
  'не означает официального партнёрства',
  'Портал не собирает деньги, номера карт и платёжные реквизиты',
  'Как начать',
  'Как партнёру помочь ТОСам',
  'Кто может стать партнёром',
  'Чем можно помочь',
  'Почему это полезно партнёру',
  'Как выглядит помощь',
  'Примеры простой помощи',
  'Куда смотреть перед предложением помощи',
  'Потребности и запросы ТОСов',
  'Шаблон предложения помощи',
  'Публичная благодарность',
  'Фотоотчёт результата'
];

const requiredPartnerSteps = [
  'Выбрать потребность',
  'Уточнить детали',
  'Передать помощь',
  'Показать результат'
];

const requiredTemplateFields = [
  'Организация / человек:',
  'Чем готовы помочь:',
  'Количество / объём:',
  'Для какого ТОСа или любой территории:',
  'Какую потребность подтверждает ответственный:',
  'Кто и где принимает помощь:',
  'Сроки:',
  'Нужна ли доставка или подготовка места:',
  'Нужна ли публичная благодарность: да / нет',
  'Как можно указать партнёра в публикации:',
  'Контакт для согласования:',
  'Комментарий:'
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
  const htmlLower = html.toLowerCase();
  const errors = [];

  checkContains(errors, html, 'partners/index.html', '<html lang="ru"');
  checkContains(errors, html, 'partners/index.html', '<title>Партнёрам ТОС БГО — как помочь территориям и проектам</title>');
  checkContains(errors, html, 'partners/index.html', 'https://tosborisoglebsk.ru/partners/');
  checkContains(errors, html, 'partners/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/partners/"');
  checkContains(errors, html, 'partners/index.html', '<main id="main">');
  checkContains(errors, html, 'partners/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'partners/index.html', 'href="https://vk.ru/tosbgo" target="_blank" rel="noopener"');
  checkContains(errors, html, 'partners/index.html', 'id="partner-check"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'partners/index.html', phrase);
  });

  requiredPartnerSteps.forEach((step) => {
    checkContains(errors, html, 'partners/index.html', step);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'partners/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'partners/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`partners/index.html: missing linked local page ${link}`);
    }
  });

  if (!html.includes('материалы') || !html.includes('транспорт') || !html.includes('волонтёры')) {
    errors.push('partners/index.html: missing core help formats');
  }

  if (html.includes('Актуальные потребности ТОСов')) {
    errors.push('partners/index.html: must not present all need records as automatically current');
  }

  if (!html.includes('Карточка в разделе потребностей может быть редакционной заготовкой или запросом сведений')) {
    errors.push('partners/index.html: partner must be warned that a need card may require verification');
  }

  if (!htmlLower.includes('название, логотип, ссылка, фотографии и текст благодарности публикуются только после явного согласования')) {
    errors.push('partners/index.html: publicity consent must be explicit');
  }

  if (!html.includes('не означает официального партнёрства, одобрения порталом, договора или обязательства оказать помощь')) {
    errors.push('partners/index.html: mentions must not imply endorsement or obligation');
  }

  if (errors.length) {
    throw new Error(`Partners page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Partners page content OK');
}

main();
