// Общий скрипт для сайта ТОС Борисоглебского ГО

document.addEventListener('DOMContentLoaded', function () {
  initCatalog();
  initMaps();
  initSearch();
});

// Транслитерация названия ТОС в slug
const translitMap = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
  'я': 'ya'
};

function slugifyName(name) {
  const normalized = (name || '').toLowerCase();
  const transliterated = normalized
    .split('')
    .map((ch) => {
      if (translitMap[ch]) return translitMap[ch];
      if (/[a-z0-9]/.test(ch)) return ch;
      if (ch === ' ' || ch === '-' || ch === '—') return '_';
      return '_';
    })
    .join('');
  const cleaned = transliterated.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.startsWith('tos_') ? cleaned : `tos_${cleaned}`;
}

// Инициализация каталога ТОС
function initCatalog() {
  const catalogContainer = document.getElementById('catalog-list');
  if (!catalogContainer) return;

  fetch('data/tos_data.json')
    .then(resp => resp.json())
    .then(data => {
      const normalized = data.map((tos) => ({ ...tos, slug: slugifyName(tos.name) }));
      window.__tosData = normalized;
      renderTosList(normalized);
      const countEl = document.getElementById('tos-count');
      if (countEl) countEl.textContent = normalized.length;
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

  const grouped = {
    city: list.filter((tos) => tos.category === 'city'),
    village: list.filter((tos) => tos.category === 'village')
  };

  const renderSection = (title, items) => {
    const section = document.createElement('div');
    section.className = 'catalog-group';

    const heading = document.createElement('h2');
    heading.textContent = title;
    section.appendChild(heading);

    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'catalog-list';

    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Нет ТОСов в этой категории.';
      cardsWrapper.appendChild(empty);
    } else {
      items.forEach(tos => cardsWrapper.appendChild(createTosCard(tos)));
    }

    section.appendChild(cardsWrapper);
    catalogContainer.appendChild(section);
  };

  renderSection('Городские ТОСы', grouped.city);
  renderSection('Сельские ТОСы', grouped.village);
}

function createTosCard(tos) {
  const card = document.createElement('div');
  card.className = 'card';

  const logoHtml = tos.logo
    ? `<img src="${tos.logo}" alt="Логотип ${tos.name}" class="tos-logo">`
    : '<img src="assets/images/logo_placeholder.png" alt="Логотип ТОС" class="tos-logo">';

  const locality = tos.locality ? `<p><strong>Населённый пункт:</strong> ${tos.locality}</p>` : '';
  const chairman = tos.chairman ? `<p><strong>Председатель:</strong> ${tos.chairman}</p>` : '';
  const contacts = tos.contacts ? `<p><strong>Контакты:</strong> ${tos.contacts}</p>` : '';
  const description = tos.description ? `<p>${tos.description}</p>` : '';
  const detailsLink = `<a class="btn" href="toses/${tos.slug}.html">Подробнее</a>`;

  card.innerHTML = ''
    + `<h3>${tos.name}</h3>`
    + locality
    + chairman
    + logoHtml
    + contacts
    + description
    + detailsLink;

  return card;
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
    if (countEl) countEl.textContent = `${filtered.length} / ${data.length}`;
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
