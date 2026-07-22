# Автоматическая фиксация visual baseline

Обновлено: 22 июля 2026 года.

## Текущее состояние

В репозитории хранится утверждённый baseline в `docs/visual-baseline/`. Матрица `data/css_regression_matrix.csv` содержит 16 контрольных сценариев:

- 14 базовых снимков страниц, тем, мобильного меню и печати;
- сфокусированный мобильный снимок каталога ТОС;
- сфокусированный мобильный снимок справочника территорий.

Workflow `.github/workflows/visual-baseline.yml` работает с правами `contents: read`, не коммитит результаты и сохраняет новый capture как GitHub Actions artifact на 30 дней.

## Назначение

Visual baseline нужен, чтобы автоматически замечать:

- изменение геометрии страниц;
- горизонтальное переполнение;
- исчезновение или смещение элементов управления;
- ошибки мобильной и тёмной темы;
- поломку динамически загружаемых карточек;
- отличия от утверждённых PNG.

Снимок подтверждает внешний вид интерфейса, но не подтверждает факты, контакты, границы или официальный статус ТОС.

## Два уровня строгости

### Измерительный режим

Переменная `VISUAL_CAPTURE_STRICT_QUALITY=false` используется для проверки полноты capture и диагностических данных.

В измерительном режиме блокируются:

- runtime failures;
- отсутствие PNG или manifest;
- несовпадение SHA-256 или размера PNG;
- console errors и page errors;
- failed requests;
- отсутствие сфокусированной секции или динамических карточек.

Quality findings записываются в manifest и лог. Artifact можно использовать для анализа, но нельзя автоматически считать утверждённым baseline.

### Строгий режим

Переменная `VISUAL_CAPTURE_STRICT_QUALITY=true` используется в pull request при наличии утверждённого baseline.

Дополнительно блокируются:

- horizontal overflow;
- любые technical violations;
- изменение размеров изображения;
- значимые пиксельные отличия;
- отсутствие или изменение контрольного сценария;
- неверная фокусировка динамического раздела.

## Режимы запуска

### Pull request

При изменении контрольных HTML, CSS, JavaScript, матрицы или visual tooling workflow:

1. поднимает локальную статическую версию сайта;
2. применяет идемпотентные patch-модули;
3. снимает все 16 сценариев;
4. проверяет manifest в измерительном режиме;
5. повторяет аудит в строгом режиме;
6. сравнивает capture с утверждённым baseline;
7. загружает PNG, manifest и comparison как GitHub Actions artifact.

### Ручной запуск

Параметр `compare_approved`:

- `false` — снять кандидаты и сформировать artifact;
- `true` — дополнительно выполнить строгий аудит и сравнение с утверждённым baseline.

Если `compare_approved=true`, но manifest отсутствует, workflow завершается ошибкой.

## Поддерживаемые действия

- `none` — открыть страницу и снять верхний экран;
- `toggle-theme` — переключить тему пользовательской кнопкой;
- `open-menu` — открыть мобильное меню и проверить `aria-expanded`;
- `print-preview` — применить print media;
- `focus-catalog` — дождаться `#tos-list .card` и прокрутить к `#catalog`;
- `focus-places` — дождаться `#places-grid .card` и прокрутить к `#places-browser`.

Для focus-сценариев manifest хранит:

- selector сфокусированной секции;
- selector ожидаемых динамических карточек;
- фактическое количество загруженных карточек;
- видимость и размеры секции;
- позицию прокрутки `scrollY`.

Сфокусированный случай не проходит аудит, если карточки не загрузились или снимок остался в верхней части страницы.

## Что фиксируется в capture manifest

- commit SHA и workflow run;
- маршрут и фактический URL;
- viewport;
- тема, действие и режим;
- SHA-256 и размер PNG;
- состояние фокусировки;
- горизонтальное переполнение;
- состояние мобильного меню;
- console errors и page errors;
- failed requests;
- элементы с внешним и внутренним overflow;
- technical violations каждого случая.

Capture считается чистым только когда:

- сняты все 16 сценариев;
- runtime и quality failures отсутствуют;
- horizontal overflow отсутствует;
- динамические карточки загружены;
- console errors, page errors и failed requests отсутствуют;
- SHA-256 и размер каждого PNG совпадают с manifest.

## Comparator

`scripts/compare_visual_baseline.js` сравнивает размеры и декодированные RGBA-пиксели текущих и утверждённых PNG.

Он формирует:

- `comparison.json`;
- `comparison.md`;
- `pixel_identical`;
- `pixel_equivalent`;
- `changed_pixels`;
- `significant_changed_pixels`;
- `max_channel_delta`;
- `changed_pixel_ratio`;
- SHA-256 обоих PNG.

Размеры и значимые пиксели всегда блокируют сравнение. Низкоамплитудный шум браузерного рендера допускается только в узких пределах, покрытых self-test.

## Правило обновления baseline

Artifact capture не является утверждённым baseline.

Для добавления или изменения PNG необходимо:

1. скачать artifact конкретного workflow run;
2. визуально проверить новые PNG;
3. проверить manifest и отсутствие закрытых данных;
4. убедиться, что capture сделан на актуальной ветке;
5. устранить quality findings;
6. создать отдельный коммит с PNG и обновлённым manifest;
7. провести отдельный визуальный review;
8. повторно запустить strict audit и comparator.

Статус `baseline_captured` означает, что эталон зафиксирован и проверяется автоматически. Статус `passed` используется для устойчивых ранее утверждённых сценариев.

## Локальный запуск

```bash
npm install --no-save --package-lock=false playwright@1.55.0 pngjs@7.0.0
npx playwright install chromium
python3 -m http.server 4173 --bind 127.0.0.1
node scripts/patch_tos_detail_responsive_styles.js
node scripts/capture_visual_baseline.js
VISUAL_CAPTURE_STRICT_QUALITY=false node scripts/audit_visual_capture_manifest.js
VISUAL_CAPTURE_STRICT_QUALITY=true node scripts/audit_visual_capture_manifest.js
node scripts/compare_visual_baseline.js
```

Результат появляется в `.artifacts/visual-baseline`.

## Ограничения

- Print media фиксирует CSS-представление, но не системный диалог печати браузера.
- Внешние ресурсы не должны маскировать failed requests.
- Намеренное изменение дизайна требует отдельного visual review и осознанного обновления PNG.
- Сфокусированные снимки дополняют, но не заменяют верхнеуровневые снимки страниц.
