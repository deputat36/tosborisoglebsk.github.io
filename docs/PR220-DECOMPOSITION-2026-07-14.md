# Безопасная декомпозиция закрытого PR №220

Дата проверки: 14 июля 2026 года.

## Решение

Прямое слияние PR №220 запрещено.

Прямой cherry-pick отдельных файлов или коммитов PR №220 также запрещён. Любая ещё полезная идея должна быть повторно проверена относительно актуального `release-2025-12-22` и оформлена отдельным небольшим PR от текущего main.

PR №220 закрыт без слияния. Его ветка расходится с актуальным main:

- 88 коммитов впереди;
- 14 коммитов позади;
- 99 изменённых путей;
- merge base: `667a1508d7ad0f03fae1dba3afcee4aa2df47f7e`;
- старый head: `99b6117ccf44ea92118b9d1797051b36ddccff2c`.

Эти показатели означают, что старый diff нельзя считать последовательным дополнением к текущему порталу.

## Машиночитаемые файлы

- `data/pr220_changed_paths.json` — снимок 99 путей и метаданных расхождения;
- `data/pr220_decomposition_inventory.csv` — решение по каждому пути;
- `scripts/generate_pr220_decomposition_inventory.js` — детерминированная классификация;
- `scripts/audit_pr220_decomposition.js` — блокирующая проверка полноты и запрета прямого переноса.

CSV был один раз создан ограниченным bootstrap-workflow, который мог коммитить только `data/pr220_decomposition_inventory.csv`. После сохранения проверенного файла bootstrap полностью удалён. Итоговый `.github/workflows/pr220-decomposition-audit.yml` использует только `contents: read`, не изменяет репозиторий и сравнивает сохранённый CSV с результатом повторной генерации.

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
| `css_source_superseded` | 3 | Использовать PR №255 |
| `independently_adopted_user_journey` | 3 | Сохранять актуальную реализацию main |
| `obsolete_vk_import` | 2 | Оставить удалённым |

Всего: 99 изменённых путей.

## Уже заменено независимыми пакетами

### CSS

PR №255 создан от актуального main и заменяет старую CSS-часть PR №220:

- whitespace-only форматирование;
- 14 логических разделов;
- канонический SHA-256 fingerprint;
- 14 из 14 visual-сценариев `pixel_equivalent`;
- значимых изменённых пикселей: 0.

Старые `assets/css/styles.css`, CSS inventory и документацию из PR №220 переносить нельзя.

### Локальный редактор `/admin/`

PR №256 создан от актуального main и заменяет старую admin-поверхность:

- честная модель публичного клиентского редактора без серверной авторизации;
- CSP и read-only CI;
- удаление пяти legacy-файлов;
- нулевые внешние network/write/secret сигналы;
- детерминированный inventory.

Старые входные HTML и legacy-модули PR №220 переносить нельзя.

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

Это не готовый пакет. Каждая возможность должна пройти повторную проверку модели безопасности, storage-границ, синтаксиса и пользовательской необходимости.

## Кандидаты малого размера

Отдельно проверить восемь путей:

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
2. Рассматривать PR №255 и PR №256 независимо от PR №220.
3. После решения по PR №256 сформировать отдельный аудит девяти admin-кандидатов.
4. Проверять восемь малых кандидатов по одному.
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
