# Visual capture для портала ТОС БГО

Дата: 13 июля 2026 года.

## Назначение

Инструмент выполняет воспроизводимый браузерный захват 14 контрольных сценариев из `data/css_regression_matrix.csv`.

Обычный capture-workflow:

- не изменяет CSS, HTML или данные сайта;
- не делает commit или push;
- не объявляет снимки утверждённым baseline автоматически;
- создаёт временный GitHub Actions artifact для проверки актуальной ветки;
- работает только с правом `contents: read`.

Исправления, найденные с помощью capture, оформляются отдельным небольшим PR и повторно проверяются тем же набором сценариев.

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
4. устанавливает Chromium через Playwright;
5. поднимает локальный статический сервер;
6. выполняет 14 сценариев матрицы;
7. формирует PNG, `manifest.json`, `README.md` и серверный лог;
8. загружает текущий результат как Actions artifact на 30 дней;
9. останавливает локальный сервер.

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

## Первый диагностический запуск

Первый запуск на актуальной основной ветке выполнялся с:

```text
VISUAL_CAPTURE_ENFORCE_QUALITY=false
```

Он подтвердил 14 из 14 кадров и выявил три overflow-сценария:

- светлая главная;
- тёмная главная;
- мобильная карточка ТОС.

Точная диагностика позволила исправить порядок `label/value` в статистике, skip-link и мобильную шапку отдельным stacked PR.

## Строгий режим

После точечной коррекции workflow работает с:

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

Это технический quality-gate. Он не заменяет pixel comparator.

## Утверждённый captured baseline

После строгого run и визуального просмотра сохранены:

- 14 PNG в `docs/visual-baseline/`;
- `docs/visual-baseline/manifest.json`;
- `docs/visual-baseline/README.md`;
- SHA-256 и размер каждого PNG;
- route, viewport, theme, interaction и браузерная диагностика каждого сценария.

Все строки `data/css_regression_matrix.csv` имеют статус `baseline_captured` и ссылаются на соответствующий PNG.

`baseline_captured` означает:

- кадры получены в строгом режиме;
- 14/14 сценариев завершились;
- runtime failures и quality failures равны нулю;
- контактный лист и проблемные сценарии просмотрены;
- файлы защищены `scripts/audit_visual_baseline_evidence.js`.

Этот статус ещё не означает `passed`: автоматическое сравнение нового capture с утверждёнными PNG появится в отдельном pixel comparator пакете.

## Защита evidence

`audit_visual_baseline_evidence.js` блокирует изменения, если:

- отсутствует хотя бы один из 14 PNG;
- SHA-256 или размер не совпадает с manifest;
- manifest содержит runtime или quality failures;
- approval metadata отсутствует;
- матрица не имеет статуса `baseline_captured`;
- `evidence_ref` не совпадает с фактическим путём PNG;
- появляются лишние или дублирующиеся visual cases.

## Следующий этап

1. Добавить pixel comparator отдельным stacked PR.
2. Декодировать PNG и сравнивать размеры и RGBA-пиксели.
3. Разрешить только ограниченный шум сглаживания шрифта.
4. Блокировать геометрические и значимые визуальные изменения.
5. После успешного comparator перевести матрицу из `baseline_captured` в `passed`.
6. Не менять утверждённый baseline без отдельного review.
