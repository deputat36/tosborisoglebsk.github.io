const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'quarterly-report', 'index.html');

const requiredInternalLinks = [
  '/data/quarterly_report_template.csv',
  '/publication-queue/',
  '/freshness-check/',
  '/post-publish-check/',
  '/editorial-calendar/',
  '/verification-readiness/',
  '/registry-diff/',
  '/open-data/'
];

const requiredPhrases = [
  'Квартальный отчёт портала ТОС БГО',
  'Рабочий шаблон квартального публичного отчёта портала ТОС БГО по каталогу, верификации, реестру, содержанию, медиа и качеству публикаций',
  'Публичная отчётность',
  'Квартальный отчёт портала',
  'Шаблон собирает проверяемую сводку за квартал: полнота каталога, верификация карточек, сверка реестра, опубликованные материалы, разрешённые медиа и результаты контроля качества',
  'Скачать CSV',
  'Очередь публикаций',
  'Свежесть',
  'QA',
  'Правило отчёта',
  'Каждая цифра должна иметь дату расчёта и проверяемый источник',
  'JSON сайта',
  'официальный документ',
  'журнал доказательств',
  'очередь публикаций',
  'закрытый QA-чек-лист',
  'Пустое значение лучше неподтверждённой цифры',
  'Планы, заявки и рабочие заготовки нельзя показывать как завершённый результат',
  'Каталог',
  'Количество опубликованных и подтверждённых карточек, официальный размер реестра и разрыв каталога',
  'Содержание',
  'Только прошедшие очередь и QA новости, проекты, актуальные потребности и истории результата',
  'Медиа',
  'Только файлы с установленным автором или правообладателем и разрешением на публикацию',
  'Качество',
  'Закрытые проверки, известные пробелы, устаревающие разделы и конкретные действия следующего квартала',
  'Порядок подготовки',
  'Указать отчётный период',
  'Рассчитать показатели на одну дату и приложить источники',
  'Исключить строки без подтверждения или явно отметить их как ожидающие проверки',
  'Проверить разрешения для персональных данных, фото и проектных сведений',
  'Подготовить публичный текст только из строк со статусом <code>ready</code>',
  'После публикации пройти QA и зафиксировать ссылку на отчёт',
  'Связанные инструменты',
  'CSV-шаблон',
  'редакционный календарь',
  'готовность карточек',
  'сверка реестра',
  'открытые данные',
  'Рабочий шаблон квартального отчёта'
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

  checkContains(errors, html, 'quarterly-report/index.html', '<html lang="ru"');
  checkContains(errors, html, 'quarterly-report/index.html', '<title>Квартальный отчёт портала ТОС БГО</title>');
  checkContains(errors, html, 'quarterly-report/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'quarterly-report/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/quarterly-report/"');
  checkContains(errors, html, 'quarterly-report/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/quarterly-report/"');
  checkContains(errors, html, 'quarterly-report/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'quarterly-report/index.html', '<main id="main">');
  checkContains(errors, html, 'quarterly-report/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'quarterly-report/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'quarterly-report/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`quarterly-report/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Quarterly report content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Quarterly report content OK');
}

main();
