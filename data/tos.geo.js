window.DATA = window.DATA || {};
// Добавьте сюда GeoJSON FeatureCollection. Пример feature.properties:
// { name: "Уютный", place: "г. Борисоглебск", id: "uyutnyy" }
window.DATA.tosGeo = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "prostornyy",
        "name": "Просторный",
        "place": "Борисоглебск"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [42.061, 51.37]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "gubari",
        "name": "Губари",
        "place": "с. Губари"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [42.118, 51.474]
      }
    }
  ]
};
