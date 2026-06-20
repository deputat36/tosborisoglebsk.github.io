# Структура файлов данных

Актуальная модель сайта использует JSON-файлы в папке `data/`. Старые файлы `data/tos.data.js`, `data/news.data.js` и `data/docs.data.js` оставлены только для совместимости старых служебных страниц и локального инструмента импорта. Для текущих публичных разделов их не нужно обновлять в первую очередь.

## Главные файлы

- `data/toses.json` — карточки ТОС и данные для каталога.
- `data/news.json` — новости и публикации.
- `data/projects.json` — банк проектов.
- `data/needs.json` — потребности территорий.
- `data/done.json` — истории результата.
- `data/events.json` — календарь событий.
- `data/documents.json` — документы и шаблоны.
- `data/tos_content_audit.json` — аудит заполненности и проверки карточек.

## `data/toses.json`

```json
{
  "slug": "unique-slug",
  "name": "Название ТОС",
  "title": "ТОС «Название»",
  "type": "Городской / Сельский",
  "location": "Населённый пункт",
  "boundaries": "Описание границ",
  "founded": "2016",
  "chairperson": "ФИО председателя",
  "contacts_raw": "исходная строка контактов",
  "phones": ["+7 ..."],
  "emails": ["mail@example.ru"],
  "chairperson_links": ["https://..."],
  "groups_raw": "исходная строка ссылок на группы",
  "social_links": ["https://vk.ru/..."],
  "population": "120",
  "description": "Коротко о ТОС",
  "logo": "",
  "updated_at": "2026-05-24"
}
```

## `data/news.json`

```json
{
  "id": "short-id",
  "date": "2026-05-23",
  "category": "Портал",
  "title": "Заголовок",
  "lead": "Короткое описание",
  "text": ["Абзац 1", "Абзац 2"],
  "source": "Название источника",
  "source_url": "https://..."
}
```

## `data/documents.json`

```json
{
  "title": "Название документа",
  "type": "Шаблон / Правовая база / ...",
  "status": "Можно использовать",
  "description": "Что внутри",
  "use_for": "Для чего использовать",
  "attention": "На что обратить внимание",
  "url": "docs/templates/file.txt",
  "date": "2026"
}
```

Для ссылок на конструктор используйте сценарный формат:

```text
update-tos/?type=card#message-builder
update-tos/?type=news#message-builder
update-tos/?type=photo#message-builder
update-tos/?type=event#message-builder
update-tos/?type=project#message-builder
update-tos/?type=need#message-builder
```

## `data/events.json`

```json
{
  "id": "event-id",
  "status": "published",
  "date": "2026-06-25",
  "time": "10:00",
  "type": "Обучение",
  "title": "Название события",
  "description": "Описание события",
  "place": "Место",
  "tos_slug": "",
  "source": "Источник",
  "source_url": "https://..."
}
```

## `data/tos.geo.js`

Геоданные пока остаются в формате JS:

```js
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "id": "prostornyy", "name": "Просторный", "place": "Борисоглебск" },
      "geometry": { "type": "Point", "coordinates": [42.061, 51.370] }
    }
  ]
}
```

### Примечания

- Координаты указываются в формате `[долгота, широта]`.
- Для полигонов используйте `Polygon` или `MultiPolygon` в соответствии со стандартом GeoJSON.
- Не переводите карточку в `verified` без подтверждения источника и даты проверки.
- Не добавляйте личные данные, если нет понимания, что их можно публиковать открыто.
