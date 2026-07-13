# Автоматическая фиксация visual baseline

Обновлено: 13 июля 2026 года.

## Текущий этап

В основной ветке пока нет утверждённых PNG и `docs/visual-baseline/manifest.json`. Все 14 строк `data/css_regression_matrix.csv` сохраняют статус `baseline_required`.

Первый пакет внедряет только безопасный контур съёмки и проверки кандидатов:

- не меняет CSS;
- не добавляет утверждённые PNG;
- не переводит сценарии в `passed`;
- не коммитит результаты workflow;
- сохраняет снимки только как GitHub Actions artifact на 30 дней.

## Назначение

Workflow `.github/workflows/visual-baseline.yml` воспроизводимо снимает все случаи из `data/css_regression_matrix.csv` на локально поднятой версии сайта.

Контур нужен для подготовки visual evidence на актуальной ветке `release-2025-12-22`. Он работает с правами `contents: read` и не может записывать изменения в репозиторий.

## Два уровня строгости

### Измерительный режим

Пока утверждённого baseline нет, workflow должен показать фактическое состояние сайта, а не заблокировать внедрение самого инструмента.

В измерительном режиме:

- обязательно снимаются все 14 сценариев;
- runtime failures блокируют workflow;
- отсутствие PNG или manifest блокирует workflow;
- несовпадение SHA-256 или размера PNG блокирует workflow;
- console errors, page errors и failed requests блокируют workflow;
- horizontal overflow и другие quality findings записываются в manifest и лог, но сами по себе не блокируют tooling-PR;
- artifact сохраняется для отдельного анализа и исправления найденных проблем.

Capture-скрипт может завершиться кодом ошибки после записи manifest из-за quality findings. Шаг workflow имеет `continue-on-error: true`, но следующий аудит manifest проверяет, что это именно измерительное замечание, а не потеря снимков или runtime-дефект.

### Строгий режим

Строгий режим автоматически включается, когда в репозитории появляется утверждённый `docs/visual-baseline/manifest.json` и выполняется pull request либо запрошено ручное сравнение.

В строгом режиме дополнительно блокируются:

- quality failures;
- horizontal overflow;
- любые technical violations;
- значимые пиксельные отличия от утверждённого baseline;
- отсутствие или изменение контрольного сценария.

Переключение реализовано переменной `VISUAL_CAPTURE_STRICT_QUALITY`:

- `false` — измерительный режим;
- `true` — строгий режим.

## Режимы запуска

### Pull request

При изменении контрольных HTML, CSS, JavaScript, матрицы или visual tooling workflow:

1. поднимает локальный сайт;
2. снимает 14 сценариев;
3. проверяет runtime, console errors, page errors, failed requests и horizontal overflow;
4. загружает `.artifacts/visual-baseline` как artifact;
5. сравнивает снимки только тогда, когда в репозитории уже существует утверждённый `docs/visual-baseline/manifest.json`.

Пока утверждённого baseline нет, pull request выполняет capture и технический аудит, но не выдаёт ложный статус `passed`.

### Ручной запуск

Параметр `compare_approved`:

- `false` — только снять кандидаты и сформировать artifact;
- `true` — дополнительно выполнить строгий аудит и сравнить с утверждённым baseline.

Если выбран `compare_approved=true`, но manifest отсутствует, workflow завершается ошибкой вместо пропуска проверки.

## Что делает workflow

1. Проверяет текущую ветку репозитория.
2. Устанавливает Chromium через Playwright и PNG-декодер `pngjs`.
3. Поднимает локальный статический сервер на `127.0.0.1:4173`.
4. Для каждого случая задаёт точный viewport, тему и действие.
5. Делает PNG-снимок.
6. Записывает `manifest.json` с SHA-256, размером файла, маршрутом, режимом и диагностикой страницы.
7. Запускает `scripts/audit_visual_capture_manifest.js` в измерительном режиме.
8. При наличии утверждённого baseline повторяет аудит в строгом режиме.
9. При наличии утверждённого baseline запускает `scripts/compare_visual_baseline.js`.
10. Загружает capture, manifest, логи и comparison как GitHub Actions artifact.

## Поддерживаемые действия

- `none` — страница без дополнительного действия;
- `toggle-theme` — переключение темы через пользовательскую кнопку;
- `open-menu` — открытие мобильного меню с проверкой состояния навигации;
- `print-preview` — применение print media перед снимком.

## Что фиксируется в capture manifest

- commit SHA и workflow run;
- маршрут и фактический URL;
- viewport;
- тема, действие и режим;
- SHA-256 и размер PNG;
- наличие горизонтального переполнения;
- состояние мобильного меню;
- JavaScript, console и page errors;
- failed requests;
- элементы с внешним и внутренним overflow;
- технические нарушения каждого случая.

Capture считается полностью чистым только когда:

- сняты все 14 сценариев;
- runtime failures отсутствуют;
- quality failures отсутствуют;
- horizontal overflow отсутствует;
- console errors и page errors отсутствуют;
- failed requests отсутствуют;
- SHA-256 и размер каждого PNG совпадают с manifest.

Нечистый по quality capture может использоваться для диагностики, но не может быть утверждён как baseline.

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

Ограниченная толерантность сглаживания:

- максимальная дельта канала — 16;
- доля слабых отличий — не более 0,5%;
- скрипт запрещает расширять пороги выше 32 и 1%.

Изменение размеров, геометрии или значимой области изображения блокирует сравнение.

## Правило утверждения baseline

Artifact capture не является утверждённым baseline.

Для перехода из `baseline_required` необходимо:

1. скачать artifact конкретного workflow run;
2. визуально проверить все 14 PNG;
3. проверить manifest и отсутствие закрытых данных;
4. убедиться, что capture сделан на актуальном main;
5. устранить все quality findings;
6. создать отдельный pull request только с утверждёнными PNG, manifest и обновлением `evidence_ref`;
7. провести отдельный визуальный review;
8. после слияния запустить compare на неизменённой ветке;
9. только после успешного сравнения рассматривать статус `passed`.

## Локальный запуск

```bash
npm install --no-save --package-lock=false playwright@1.55.0 pngjs@7.0.0
npx playwright install chromium
python3 -m http.server 4173 --bind 127.0.0.1
node scripts/capture_visual_baseline.js
VISUAL_CAPTURE_STRICT_QUALITY=false node scripts/audit_visual_capture_manifest.js
```

Строгий аудит и сравнение после появления утверждённого baseline:

```bash
VISUAL_CAPTURE_STRICT_QUALITY=true node scripts/audit_visual_capture_manifest.js
node scripts/compare_visual_baseline.js
```

Результат появляется в `.artifacts/visual-baseline`.

## Ограничения

- Скриншот не подтверждает корректность фактов и контактов.
- Print media фиксирует CSS-представление, но не системный диалог печати браузера.
- Внешние ресурсы не должны маскировать failed requests.
- Измерительный режим не означает, что найденное переполнение допустимо для baseline.
- Намеренное изменение дизайна требует отдельного visual review и осознанного обновления PNG.
- Draft PR #220 не является источником утверждённого baseline для актуального main.
