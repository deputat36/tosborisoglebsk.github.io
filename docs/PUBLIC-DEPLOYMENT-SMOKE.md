# Public deployment smoke

## Назначение

`Audit public deployment smoke` проверяет публичную доступность статического портала после успешного production generation.

Контур работает в режиме read-only и не заменяет ручную проверку Settings → Pages, выбранной source branch, папки публикации и deployment logs.

## Что проверяется

Обязательные custom domain цели:

- `https://tosborisoglebsk.ru/` ↔ `index.html`;
- `https://tosborisoglebsk.ru/data/site_health.json` ↔ `data/site_health.json`;
- `https://tosborisoglebsk.ru/actions-check/` ↔ `actions-check/index.html`;
- `https://tosborisoglebsk.ru/sitemap.xml` ↔ `sitemap.xml`.

Для каждой обязательной цели проверяются:

- успешный HTTP-ответ;
- ожидаемый content type;
- допустимый конечный hostname после redirect;
- точное совпадение опубликованных файлов с текущим файлом рабочей ветки по нормализованному SHA-256.

Дополнительно проверяется GitHub Pages URL `https://deputat36.github.io/tosborisoglebsk.github.io/`. Он является диагностическим alias и не блокирует custom domain при отдельной ошибке.

## Запуски

Production-сеть проверяется:

- вручную через `workflow_dispatch`;
- каждые шесть часов;
- после успешного `Generate TOS pages` для ветки `release-2025-12-22`.

### PR-проверка

При изменении smoke-кода, workflow или документации pull request запускает syntax-check, self-test и audit контракта на head-коммите. Сетевой запрос не выполняется, потому что содержимое PR ещё не опубликовано на production и сравнение его hash с действующим сайтом дало бы ложную ошибку.

Перед production-проверкой выполняются:

- JavaScript syntax-check;
- локальный self-test retry и stale-content сценариев;
- audit read-only контракта workflow.

При временном рассогласовании CDN выполняется до пяти попыток с паузой 20 секунд. Итоговый JSON загружается как Actions artifact только для production-запусков.

## Границы доверия

Зелёный smoke-run подтверждает, что:

- custom domain доступен из GitHub Actions;
- четыре ключевых файла совпадают с текущей рабочей веткой;
- TLS/redirect/HTTP-маршрут фактически отвечает;
- опубликованная версия не является очевидно устаревшей относительно проверяемого checkout.

Зелёный smoke-run не подтверждает:

- выбранную source branch в интерфейсе GitHub Pages;
- настройки custom domain и HTTPS enforcement в Settings → Pages;
- внутренний статус конкретного Pages deployment;
- содержание deployment logs;
- юридическую или фактологическую достоверность опубликованных данных.

Сам workflow не изменяет `data/actions_diagnostics.csv`, не переводит `actions-011` в `passed` и не закрывает issue №164 автоматически. Проверенный успешный запуск можно зафиксировать отдельной исторической строкой CSV без изменения статуса ручной проверки Settings → Pages.

## Зафиксированное evidence

Успешный run №2 / id `29416737813` от 15 июля 2026 года сохранён как `actions-012`:

- четыре обязательные цели прошли с первой попытки;
- blocking failures — 0;
- warnings — 0;
- GitHub Pages alias вернул HTTP 200 и перенаправил на custom domain.

`actions-011` остаётся `pending`, потому что source branch, HTTPS enforcement и deployment logs по-прежнему требуют ручного просмотра в интерфейсе GitHub.

## Файлы

- `scripts/lib/public_deployment_smoke.js` — цели, retry, SHA-сравнение и JSON-report;
- `scripts/public_deployment_smoke.js` — CLI;
- `scripts/test_public_deployment_smoke.js` — локальный self-test;
- `scripts/audit_public_deployment_smoke_contract.js` — защита read-only архитектуры и разделения PR/production;
- `.github/workflows/public-deployment-smoke.yml` — PR-валидация и сетевой production workflow;
- `.artifacts/public-deployment-smoke/report.json` — временный artifact, не коммитится.
