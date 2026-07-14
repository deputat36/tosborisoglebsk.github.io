# Диагностика GitHub Actions и публикации

Дата снимка: 14 июля 2026 года.

## Назначение

Служебная страница `/actions-check/` не является live-status. Она фиксирует проверенные факты на определённую дату и разделяет три уровня evidence:

1. PR-CI для merge-ref pull request;
2. push-run ветки `release-2025-12-22`;
3. фактический GitHub Pages deployment и внешнюю доступность домена.

Успех предыдущего уровня не считается автоматическим доказательством следующего.

## Подтверждённый PR-CI

На дату снимка через GitHub Actions API и job steps подтверждены:

| PR | Run number | Run ID | Результат |
|---|---:|---:|---|
| #241 | 1293 | 29306238698 | success |
| #242 | 1295 | 29306614320 | success |
| #243 | 1298 | 29307180271 | success |

В каждом run прошли генераторы, публичные проверки и полный project-mode. Эти результаты подтверждают состояние конкретных pull request, но не доказывают merge, push-run основной ветки или Pages deployment.

## Основной workflow

`.github/workflows/generate-tos-pages.yml` содержит:

- `workflow_dispatch`;
- `pull_request` для рабочей ветки;
- `push` для рабочей ветки.

Триггер `schedule` в основном workflow отсутствует. Запланированные задачи, если они нужны, должны оставаться отдельными специализированными workflow.

## Технический baseline

Числа на странице `/actions-check/` берутся из `data/site_health.json`, а не поддерживаются как независимая ручная статистика.

На дату снимка JSON содержит:

- generated_at: `2026-07-13T19:17:48.746Z`;
- HTML: 371;
- public: 331;
- noindex: 40;
- SEO warnings: 0;
- broken internal links: 0.

## Неподтверждённые уровни

До фактического слияния отдельных PR остаются `pending`:

- push-run default branch;
- автоматический generated commit;
- GitHub Pages deployment;
- внешняя проверка HTTPS, www и ключевых маршрутов.

Историческая проверка домена хранится в `data/domain_access_check.csv`. Последняя дата в ней — 23 июня 2026 года, поэтому она не считается текущей проверкой на 14 июля 2026 года.

## Источники

- `actions-check/index.html` — человекочитаемый снимок;
- `data/actions_diagnostics.csv` — структурированные результаты;
- `data/domain_access_check.csv` — отдельная история внешней доступности;
- `data/site_health.json` — технические показатели;
- `.github/workflows/generate-tos-pages.yml` — фактические триггеры;
- GitHub Actions run и job endpoints — conclusion конкретных PR-runs.

## Автоматическая защита

`scripts/audit_actions_check_content.js` проверяет:

- структуру CSV и набор обязательных строк;
- три подтверждённых PR-run ID;
- статусы production, Pages и domain;
- соответствие чисел `site_health.json` HTML и CSV;
- фактические триггеры workflow и отсутствие `schedule`;
- корректное разделение PR-CI и production deployment;
- отсутствие устаревших утверждений о пустом `workflow_runs`;
- подключение аудита к package и project-mode.

## Правило обновления

Строка получает `passed` только при наличии конкретного evidence: run ID, conclusion, файл отчёта или проверенный deployment. Отсутствие доступа к evidence не превращается ни в `passed`, ни в `failed`; используется `pending` или `warning` с точным следующим действием.
