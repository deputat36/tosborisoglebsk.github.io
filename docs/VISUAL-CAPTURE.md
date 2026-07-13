# Visual capture для портала ТОС БГО

Дата: 13 июля 2026 года.

## Назначение

Инструмент выполняет воспроизводимый браузерный захват 14 контрольных сценариев из `data/css_regression_matrix.csv` и сравнивает текущие кадры с утверждённым baseline.

Workflow:

- не изменяет CSS, HTML или данные сайта;
- не делает commit или push;
- создаёт временный GitHub Actions artifact;
- работает только с правом `contents: read`;
- блокирует технические ошибки и визуальные регрессии.

Исправления оформляются отдельным небольшим PR и повторно проверяются тем же набором сценариев.

## Workflow

Файл: `.github/workflows/visual-capture.yml`.

Права workflow ограничены:

```yaml
permissions:
  contents: read
```

Workflow:

1. проверяет JavaScript и полный project-mode audit;
2. проверяет read-only контракт и source-level регрессии;
3. сверяет сохранённый baseline с manifest и матрицей;
4. проверяет интеграцию pixel comparator и его пределы;
5. устанавливает Chromium и `pngjs`;
6. поднимает локальный статический сервер;
7. выполняет 14 сценариев матрицы;
8. запускает `scripts/compare_visual_baseline.js`;
9. сохраняет `comparison.json` и `comparison.md` в artifact;
10. загружает artifact на 30 дней и останавливает сервер.

## Что проверяет capture

Для каждого сценария фиксируются:

- маршрут;
- viewport;
- тема;
- действие пользователя;
- экранный или печатный режим;
- PNG и его SHA-256;
- ширина документа и наличие horizontal overflow;
- элементы за пределами viewport;
- внутренние контейнеры с `scrollWidth > clientWidth`;
- контейнеры, чья изоляция уменьшает ширину документа;
- состояние мобильного меню;
- фактическая тема документа;
- ошибки JavaScript;
- ошибки страницы;
- failed requests.

## Диагностический и строгий режимы

Первый запуск выполнялся с:

```text
VISUAL_CAPTURE_ENFORCE_QUALITY=false
```

Он подтвердил 14 из 14 кадров и выявил три overflow-сценария. После исправления порядка `label/value` в статистике, skip-link и мобильной шапки workflow переведён в строгий режим:

```text
VISUAL_CAPTURE_ENFORCE_QUALITY=true
```

Теперь блокируют workflow:

- runtime failures;
- horizontal overflow;
- несоответствие темы;
- неправильное состояние мобильного меню;
- console errors;
- page errors;
- failed requests.

## Утверждённый baseline

После строгого run и визуального просмотра сохранены:

- 14 PNG в `docs/visual-baseline/`;
- `docs/visual-baseline/manifest.json`;
- `docs/visual-baseline/README.md`;
- SHA-256 и размер каждого PNG;
- route, viewport, theme, interaction и браузерная диагностика каждого сценария.

Manifest сохраняет approval-статус `baseline_captured`: он описывает происхождение неизменяемых PNG и подтверждает visual review.

Файлы защищены `scripts/audit_visual_baseline_evidence.js`. Аудит блокирует изменения, если:

- отсутствует хотя бы один из 14 PNG;
- SHA-256 или размер не совпадает с manifest;
- manifest содержит runtime или quality failures;
- approval metadata отсутствует;
- статус и `evidence_ref` матрицы не согласованы с comparator;
- появляются лишние или дублирующиеся visual cases.

## Pixel comparator

`scripts/compare_visual_baseline.js` декодирует baseline и текущие PNG через `pngjs` и сравнивает:

- ширину и высоту изображения;
- route, viewport, theme, interaction и mode;
- RGBA каждого пикселя;
- количество изменённых пикселей;
- количество значимых изменённых пикселей;
- максимальную дельту цветового канала;
- SHA-256 и побайтовую идентичность.

Итог каждого case содержит:

- `pixel_identical` — RGBA полностью совпадает;
- `pixel_equivalent` — допускается только ограниченный шум сглаживания;
- `significant_changed_pixels` — пиксели с дельтой выше допуска;
- `changed_pixel_ratio`;
- `max_channel_delta`;
- `metadata_mismatches`.

Отчёт сохраняется в `.artifacts/visual-baseline/comparison.json` и `comparison.md`. Долговечный итог первого успешного сравнения сохранён в `docs/visual-baseline/COMPARISON-2026-07-13.md`.

## Допуск сглаживания

Рабочие значения:

```text
max_channel_delta = 16
max_low_delta_ratio = 0.005
```

Это означает:

- ни один принятый пиксель не может отличаться более чем на 16 уровней канала;
- слабые отличия могут занимать не более 0,5% изображения;
- хотя бы один пиксель выше порога делает case изменённым;
- изменение размеров или метаданных всегда блокирует workflow.

Код дополнительно запрещает расширять допуск выше:

```text
hard_max_channel_delta = 32
hard_max_low_delta_ratio = 0.01
```

Порог 0,5% предназначен только для нестабильного антиалиасинга шрифтов на разных GitHub runner. Он не допускает геометрические изменения, смещение блоков, новые элементы, изменение размеров или заметную смену цвета.

## Первый успешный comparator run

Run `29277336532` завершён успешно:

- cases compared: 14;
- pixel_identical: 14;
- pixel_equivalent: 14;
- antialias_equivalent: 0;
- bytes_identical: 14;
- changed cases: 0;
- missing current cases: 0;
- unexpected current cases: 0.

Допуск антиалиасинга в этом запуске не потребовался: все 14 PNG совпали пиксельно и побайтово.

## Статус матрицы

Все 14 строк `data/css_regression_matrix.csv` имеют статус `passed`.

Статус `passed` означает, что:

1. строгий capture завершён без технических ошибок;
2. сохранённый baseline прошёл SHA-аудит;
3. comparator нашёл соответствующий case;
4. размеры и метаданные совпали;
5. `pixel_equivalent = true`;
6. значимых пикселей нет;
7. changed, missing и unexpected cases отсутствуют.

Утверждённый baseline нельзя менять автоматически. Его обновление требует отдельного visual review и нового evidence-пакета.
