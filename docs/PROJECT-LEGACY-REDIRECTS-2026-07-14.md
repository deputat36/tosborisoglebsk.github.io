# Старые URL банка проектов

Дата: 14 июля 2026 года.

## Проблема

В каталоге `/projects/` сохранились 14 старых URL, идентификаторы которых больше не совпадают с текущими опубликованными записями `data/projects.json`.

Простое удаление создаст битые внешние ссылки. Сохранение старых полноценных страниц создаёт другую проблему: посетитель и поисковик могут принять устаревший проект за актуальную запись.

## Решение

Для 14 старых URL используется централизованная карта `scripts/lib/project_legacy_redirects.js`.

Каждая старая страница:

- содержит `noindex,follow`;
- выполняет локальный переход только внутри `/projects/`;
- имеет canonical на актуальную страницу;
- показывает понятную ссылку для ручного перехода;
- содержит отдельный marker legacy redirect;
- не использует marker действующего проекта из `data/projects.json`;
- не входит в sitemap.

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

## Проверки

`scripts/audit_projects_integrity.js` проверяет:

- текущие проекты и их страницы;
- отсутствие stale generated pages;
- наличие всех 14 redirects;
- `noindex,follow`, refresh, canonical и marker;
- существование target;
- отсутствие старых URL в sitemap;
- подключение self-test к package и project-mode.

## Порядок публикации

На pull request генератор переписывает страницы только во временном рабочем каталоге CI, а автоматический commit пропускается.

После слияния push-workflow после слияния выполнит генератор и сможет зафиксировать 14 redirect-страниц и удаление иных stale generated project pages автоматическим коммитом.

## Границы

Пакет не меняет `data/projects.json`, описания текущих проектов и публичную структуру банка проектов. Он не создаёт внешних redirects и не подтверждает фактическую реализацию какой-либо проектной идеи.
