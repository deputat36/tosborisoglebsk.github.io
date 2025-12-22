# Структура файлов данных

## `data/tos.data.js`
```js
{
  id: "unique-slug",      // латиницей, используется в ссылках
  name: "Название ТОС",
  place: "Населённый пункт",
  type: "Городской / Сельский (опционально)",
  boundaries: "Описание границ",
  founded: 2016,           // год
  chair: "ФИО председателя",
  contacts: "телефон, email, мессенджеры",
  social_links: "https://vk.com/... https://ok.ru/...", // через пробел
  residents: 120,          // число жителей
  description: "Коротко о ТОС",
  logo: "/assets/img/logo.png" | "",
  geo: null | "point"      // поле не используется, геоданные лежат отдельно
}
```

## `data/news.data.js`
```js
{
  slug: "short-slug",
  title: "Заголовок",
  date: "2025-12-20", // ISO-формат
  type: "news" | "announcement",
  excerpt: "Короткое описание",
  content_html: "<p>Полный текст</p>",
  source_name: "Название источника",
  source_url: "https://..." | ""
}
```

## `data/docs.data.js`
```js
{
  id: "charter-demo",
  title: "Название документа",
  date: "2024-01-15",
  description: "Что внутри",
  kind: "Шаблон" | "Отчёт" | "Положение" | ...,
  source: "Организация/автор",
  url: "/documents/demo/charter.html" // внутренняя или внешняя ссылка
}
```

## `data/tos.geo.js`
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
