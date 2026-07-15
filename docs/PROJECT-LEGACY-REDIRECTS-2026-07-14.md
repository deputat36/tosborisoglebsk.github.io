# Старые URL банка проектов

Дата: 14 июля 2026 года.

## Проблема

В каталоге `/projects/` сохранились 14 старых URL, идентификаторы которых больше не совпадают с текущими опубликованными записями `data/projects.json`.

Простое удаление создаст битые внешние ссылки. Сохранение старых полноценных страниц создаёт другую проблему: посетитель и поисковик могут принять устаревший проект за актуальную запись.

## Решение

Для 14 старых URL используется централизованная карта `scripts/lib/project_legacy_redirects.js`.

Все старые страницы:

- содержат `noindex,follow`;
- выполняют локальный переход только внутри `/projects/`;
- имеют canonical на актуальную страницу;
- показывают понятную ссылку для ручного перехода;
- содержат отдельный marker legacy redirect;
- не используют marker действующего проекта из `data/projects.json`;
- не входят в sitemap.

## Карта переходов

| Старый URL | Актуальный маршрут |
|---|---|
| `/projects/archive-memory/` | `/projects/history-route-memory/` |
| `/projects/eco-place/` | `/projects/eco-platform/` |
| `/projects/green-route/` | `/projects/` |
| `/projects/green-yard/` | `/projects/green-yard-flowerbeds/` |
| `/projects/history-route/` | `/projects/history-route-memory/` |
| `/projects/lighting/` | `/projects/lighting-safe-way/` |
| `/projects/memorial/` | `/projects/memorial-renovation/` |
| `/projects/notice-board/` | `/projects/information-stand-tos/` |
| `/projects/playground/` | `/projects/child-sport-playground/` |
| `/projects/public-space/` | `/projects/center-of-attraction/` |
| `/projects/safe-path/` | `/projects/safe-path-or-sidewalk/` |
| `/projects/village-stage/` | `/projects/rural-cultural-space/` |
| `/projects/volunteer-day/` | `/projects/` |
| `/projects/yard-navigation/` | `/projects/information-stand-tos/` |

## Защита текущих проектов

Self-test блокирует пакет, если:

- число документированных старых URL отличается от 14;
- старый ID совпадает с текущим опубликованным проектом;
- target не относится к `/projects/`;
- target указывает на отсутствующий или draft-проект;
- renderer не создаёт noindex, refresh, canonical, видимую ссылку и marker.

## Безопасная очистка

`scripts/generate_project_pages.js` может удалить только каталог, в котором `index.html` содержит точный marker действующей автогенерируемой страницы проекта.

Ручные каталоги и страницы без marker не удаляются без marker. Известные старые URL после очистки заново записываются как redirects из централизованной карты.

## Два режима проверки

Обычный project-mode использует integration-режим. Он проверяет данные проектов, карту 14 URL, targets, renderer, self-test, генератор и подключение к CI, но не требует, чтобы redirect-файлы уже были записаны в необработанный checkout.

После генерации project pages основной pipeline запускает строгую проверку:

```text
PROJECT_LEGACY_REDIRECTS_STRICT=true node scripts/audit_projects_integrity.js
```

Strict-режим дополнительно требует:

- фактическое наличие всех 14 redirects;
- отсутствие stale generated project pages;
- правильные noindex, refresh, canonical и marker;
- существование targets;
- отсутствие legacy URL в sitemap.

Strict-проверка подключена напрямую к основному workflow сразу после генерации
проектных страниц. Временный workflow с правом записи и отдельный скрипт,
изменяющий shared core во время CI, для публикации не используются.

## Порядок публикации

На pull request генератор переписывает страницы только во временном рабочем каталоге CI, а автоматический commit пропускается.

После слияния push-workflow выполнит генератор. Только push-workflow после слияния сможет зафиксировать 14 redirect-страниц и удаление иных stale generated project pages автоматическим коммитом.

## Границы

Пакет не меняет `data/projects.json`, описания текущих проектов и публичную структуру банка проектов. Он не создаёт внешних redirects и не подтверждает фактическую реализацию какой-либо проектной идеи.
