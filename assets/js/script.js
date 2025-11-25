// Общий скрипт для сайта ТОС Борисоглебского ГО

document.addEventListener('DOMContentLoaded', function () {
  initCatalog();
  initMaps();
  initSearch();
});

// Инициализация каталога ТОС
function initCatalog() {
  const catalogContainer = document.getElementById('catalog-list');
  if (!catalogContainer) return;

  fetch('data/tos_data.json')
    .then(resp => resp.json())
    .then(data => {
      window.__tosData = data;
      renderTosList(data);
      const countEl = document.getElementById('tos-count');
      if (countEl) countEl.textContent = data.length;
    })
    .catch(err => {
      console.error('Ошибка загрузки данных ТОС:', err);
      catalogContainer.innerHTML = '<p>Не удалось загрузить данные каталога. Проверьте файл data/tos_data.json.</p>';
    });
}

function renderTosList(list) {
  const catalogContainer = document.getElementById('catalog-list');
  if (!catalogContainer) return;
  catalogContainer.innerHTML = '';

  list.forEach(tos => {
    const card = document.createElement('div');
    card.className = 'card';

    const logoHtml = tos.logo
      ? '<img src="' + tos.logo + '" alt="Логотип ' + tos.name + '" class="tos-logo">'
      : '<img src="assets/images/logo_placeholder.png" alt="Логотип ТОС" class="tos-logo">';

    card.innerHTML = ''
      + '<h3>' + tos.name + '</h3>'
      + '<p><strong>Населённый пункт:</strong> ' + tos.locality + '</p>'
      + '<p><strong>Председатель:</strong> ' + tos.chairman + '</p>'
      + logoHtml
      + '<p><strong>Контакты:</strong> ' + tos.contacts + '</p>'
      + (tos.description ? '<p>' + tos.description + '</p>' : '');

    catalogContainer.appendChild(card);
  });
}

// Поиск по названию ТОС
function initSearch() {
  const searchInput = document.getElementById('tos-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const data = window.__tosData || [];
    const filtered = data.filter(tos => tos.name.toLowerCase().includes(query));
    renderTosList(filtered);
    const countEl = document.getElementById('tos-count');
    if (countEl) countEl.textContent = filtered.length + ' / ' + data.length;
  });
}

// Инициализация карт (главная и каталог)
function initMaps() {
  // Карта на главной (обзорная)
  const overviewEl = document.getElementById('map-overview');
  if (overviewEl && window.L) {
    const mapOverview = L.map('map-overview').setView([51.367, 42.083], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapOverview);

    fetch('data/tos_map.geojson')
      .then(res => res.json())
      .then(geoData => {
        L.geoJSON(geoData, {
          style: function () {
            return { color: '#0056b3', weight: 2, fillOpacity: 0.15 };
          }
        }).addTo(mapOverview);
      })
      .catch(err => console.warn('Не удалось загрузить tos_map.geojson для главной карты:', err));
  }

  // Карта в каталоге
  const catalogMapEl = document.getElementById('map');
  if (catalogMapEl && window.L) {
    const map = L.map('map').setView([51.367, 42.083], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    fetch('data/tos_map.geojson')
      .then(res => res.json())
      .then(geoData => {
        L.geoJSON(geoData, {
          style: function () {
            return { color: '#00796b', weight: 2, fillOpacity: 0.15 };
          }
        }).addTo(map);
      })
      .catch(err => console.warn('Не удалось загрузить tos_map.geojson для карты каталога:', err));
  }
}
