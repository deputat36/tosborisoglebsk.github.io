# Безопасная декомпозиция закрытого PR №220

Дата проверки: 14 июля 2026 года.

## Решение

Прямое слияние PR №220 запрещено.

Прямой cherry-pick отдельных файлов или коммитов PR №220 также запрещён. Любая ещё полезная идея должна быть повторно проверена относительно актуального `release-2025-12-22` и оформлена отдельным небольшим PR от текущего main.

PR №220 закрыт без слияния. На момент инвентаризации его ветка расходилась с main:

- 88 коммитов впереди;
- 14 коммитов позади;
- 99 изменённых путей;
- merge base: `667a1508d7ad0f03fae1dba3afcee4aa2df47f7e`;
- старый head: `99b6117ccf44ea92118b9d1797051b36ddccff2c`.

Эти показатели являются историческим снимком закрытого PR и не должны переписываться при каждом новом коммите main.

## Машиночитаемые файлы

- `data/pr220_changed_paths.json` — снимок 99 путей и метаданных расхождения;
- `data/pr220_decomposition_inventory.csv` — решение по каждому пути;
- `scripts/generate_pr220_decomposition_inventory.js` — детерминированная классификация;
- `scripts/audit_pr220_decomposition.js` — блокирующая проверка полноты и запрета прямого переноса.

CSV создаётся только генератором. Итоговый `.github/workflows/pr220-decomposition-audit.yml` использует `contents: read`, повторно генерирует CSV в runner, сравнивает его с сохранённой версией и не изменяет репозиторий.

## Итоги классификации

| Категория | Количество | Решение |
|---|---:|---|
| `independently_adopted_visual` | 24 | Сохранять актуальную реализацию main |
| `generated_or_derived_output` | 21 | Только повторная генерация текущими скриптами |
| `protected_shared_core` | 12 | Не cherry-pick; только новый малый PR |
| `admin_feature_candidate` | 9 | Отдельная проверка после PR №256 |
| `small_candidate_requires_recheck` | 8 | Проверить по одному и при необходимости вынести в отдельный PR |
| `admin_surface_superseded` | 7 | Использовать PR №256 |
| `stale_status_or_documentation` | 6 | Переписывать только по текущему состоянию |
| `independently_adopted_generator_cleanup` | 4 | Сохранять актуальную реализацию main |
| `css_source_superseded` | 3 | Использовать результат PR №255 |
| `independently_adopted_user_journey` | 3 | Сохранять актуальную реализацию main |
| `obsolete_vk_import` | 2 | Оставить удалённым |

Всего: 99 изменённых путей.

## Уже заменено независимыми пакетами

### CSS

PR №255 объединён с актуальным main и заменяет старую CSS-часть PR №220:

- whitespace-only форматирование;
- 14 логических разделов;
- канонический SHA-256 fingerprint;
- отдельный visual baseline;
- полный project-mode и основной CI.

Старые `assets/css/styles.css`, CSS inventory и документацию из PR №220 переносить нельзя.

### Малые кандидаты

PR №258 независимо проверил малые редакционные изменения. Приняты только безопасные noindex, llms и regression-guard изменения; статические Actions-метрики и конфликтующая readiness-логика не переносились.

### Локальный редактор `/admin/`

PR №256 остаётся отдельным пакетом безопасной модели публичного клиентского редактора без серверной авторизации. Старые входные HTML и legacy-модули PR №220 переносить нельзя.

Девять дополнительных admin-кандидатов рассматриваются отдельно и только после базовой модели PR №256.

## Защищённое ядро

Следующие типы файлов считаются конфликтующими с текущим main:

- основной `generate-tos-pages.yml`;
- `package.json`;
- оба project-mode runner;
- SEO, links и site-health audits;
- генераторы материалов и проектов;
- общие helper-модули маршрутов.

Для них допустим только новый PR от текущего main с точечным diff и полным CI. Перенос старого файла целиком запрещён.

## Производные файлы

Нельзя переносить из старой ветки:

- `sitemap.xml`;
- `page_index.json`;
- `site_health.json`;
- accessibility и diagnostics reports;
- generated project pages;
- другие отчёты и CSV, создаваемые скриптами.

Они должны быть повторно созданы актуальными генераторами после изменения исходных данных или кода.

## Кандидат: дополнительные admin-возможности

После решения по PR №256 отдельно проверить девять путей:

1. `.github/workflows/admin-schema.yml`;
2. `admin/admin-dashboard.js`;
3. `admin/admin-done-dataset.js`;
4. `admin/admin-export-tools.js`;
5. `admin/admin-history.js`;
6. `data/admin_capability_inventory.csv`;
7. `docs/ADMIN-AUDIT-2026-07-13.md`;
8. `scripts/audit_admin_capabilities.js`;
9. `scripts/audit_admin_dataset_schema.js`.

Статус `admin_feature_candidate` не означает готовность к переносу. Каждая возможность должна пройти повторную проверку модели безопасности, storage-границ, синтаксиса и пользовательской необходимости.

## Кандидаты малого размера

Отдельно были выделены восемь путей:

1. `assets/js/home-stats.js`;
2. `data-requests/priority-tos/index.html`;
3. `data-requests/tos-registry-request/index.html`;
4. `llms.txt`;
5. `scripts/audit_actions_check_content.js`;
6. `scripts/audit_homepage_content.js`;
7. `scripts/audit_priority_tos_readiness.js`;
8. `scripts/audit_route_governance.js`.

Статус `small_candidate_requires_recheck` не означает, что файл нужно переносить. Сначала требуется сравнить цель изменения с текущим main и проверить, не реализована ли она другим способом.

## Порядок дальнейшей работы

1. Использовать `release-2025-12-22` как единственный источник истины.
2. Сохранять уже объединённый результат PR №255, а не старую CSS-реализацию.
3. Рассматривать PR №256 независимо от PR №220.
4. Проверять оставшиеся идеи только малыми PR от текущего main.
5. Не создавать PR из производных файлов или старых отчётов.
6. Не восстанавливать старый VK-import.
7. Любой новый пакет запускать через полный project-mode и профильные проверки.

## Критерий завершения декомпозиции

- все 99 путей присутствуют в CSV ровно один раз;
- у каждого пути есть категория, риск, решение и причина;
- `direct_cherry_pick_allowed` везде равно `false`;
- protected core имеет риск `critical` и решение `do_not_cherry_pick`;
- CSS ссылается на PR №255;
- admin-пути ссылаются на PR №256;
- суммы категорий совпадают с машиночитаемым снимком;
- audit и полный CI проходят.
