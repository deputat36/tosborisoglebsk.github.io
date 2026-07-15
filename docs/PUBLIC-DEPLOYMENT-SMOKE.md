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

Workflow запускается:

- вручную через `workflow_dispatch`;
- каждые шесть часов;
- после успешного `Generate TOS pages` для ветки `release-2025-12-22`.

Перед сетевой проверкой выполняются:

- JavaScript syntax-check;
- локальный self-test retry и stale-content сценариев;
- audit read-only контракта workflow.

При временном рассогласовании CDN выполняется до пяти попыток с паузой 20 секунд. Итоговый JSON загружается как Actions artifact.

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

Поэтому workflow не изменяет `data/actions_diagnostics.csv`, не переводит `actions-011` в `passed` и не закрывает issue №164 автоматически.

## Файлы

- `scripts/lib/public_deployment_smoke.js` — цели, retry, SHA-сравнение и JSON-report;
- `scripts/public_deployment_smoke.js` — CLI;
- `scripts/test_public_deployment_smoke.js` — локальный self-test;
- `scripts/audit_public_deployment_smoke_contract.js` — защита read-only архитектуры;
- `.github/workflows/public-deployment-smoke.yml` — сетевой workflow;
- `.artifacts/public-deployment-smoke/report.json` — временный artifact, не коммитится.
