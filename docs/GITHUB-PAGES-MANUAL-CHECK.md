# Ручная проверка GitHub Pages

Обновлено: 15 июля 2026 года.

## Назначение

Этот пакет помогает закрыть issue #164 без подмены ручной проверки автоматическим smoke-тестом.

`Audit public deployment smoke` уже подтверждает доступность custom domain и совпадение четырёх ключевых файлов с checkout. Он не видит настройки `Settings → Pages`, выбранный source branch, папку публикации, HTTPS enforcement и внутренний статус конкретного Pages deployment.

## Файл-шаблон

Используйте `data/github_pages_manual_check_template.csv` как локальный рабочий лист.

Шаблон намеренно содержит:

- пустые `observed_value` и `evidence_ref`;
- статус `not_checked` во всех строках;
- только ожидаемые значения и места проверки.

Незаполненный шаблон не является evidence и не переводит `actions-011` в `passed`.

## Порядок проверки

1. Открыть репозиторий `deputat36/tosborisoglebsk.github.io`.
2. Перейти в `Settings → Pages`.
3. Зафиксировать фактический способ публикации: source branch и папку либо GitHub Actions.
4. Проверить custom domain `tosborisoglebsk.ru`.
5. Проверить, что HTTPS enforcement включён.
6. Открыть последний Pages deployment и убедиться, что он завершён со статусом success.
7. Открыть опубликованный URL из интерфейса Pages или deployment.
8. Заполнить локальную копию CSV: `observed_value`, `status`, `evidence_ref`.
9. Не загружать в публичный репозиторий приватные скриншоты, токены, закрытые URL или сведения об аккаунте.

## Допустимое evidence

Подходит одно или несколько безопасных оснований:

- публичный URL Pages deployment;
- публичный URL workflow run;
- опубликованный URL сайта;
- обезличенная ссылка на закрытое evidence, если сам материал хранится вне публичного GitHub.

Само наличие доступного сайта не подтверждает выбранный source branch или HTTPS enforcement в интерфейсе GitHub.

## Как зафиксировать результат в проекте

После реальной проверки добавить отдельную историческую строку в `data/actions_diagnostics.csv`. Не редактировать `actions-012`: это evidence автоматического public smoke.

Шаблон новой строки:

```csv
actions-013,manual-check,"GitHub Pages deployment","[source branch; publish folder; custom domain; HTTPS; deployment status; URL]","[safe evidence ref]",passed,"Повторять ручную проверку после изменения Pages settings или способа публикации",YYYY-MM-DD
```

Использовать статус `passed` можно только если все обязательные пункты проверены. При неполной проверке использовать `pending` или `warning` и явно указать, чего не хватает.

## Критерий закрытия issue #164

- фактический source branch или способ публикации зафиксирован;
- папка публикации или GitHub Actions подтверждены;
- custom domain подтверждён;
- HTTPS enforcement проверен;
- последний deployment имеет успешный статус;
- опубликованный URL открыт из интерфейса Pages;
- в `data/actions_diagnostics.csv` добавлена честная строка с датой и безопасным evidence;
- issue #164 обновлена и закрыта только после фактической проверки.

## Границы

- инструкция не меняет настройки GitHub Pages;
- шаблон не является доказательством до заполнения после реальной проверки;
- автоматический smoke не закрывает issue #164;
- закрытые скриншоты и данные аккаунта не хранятся в публичном репозитории.
