(() => {
  'use strict';
  const root = document.querySelector('#zhkh-navigator');
  if (!root) return;
  const housing = root.querySelector('#zhkh-housing');
  const issue = root.querySelector('#zhkh-issue');
  const cards = [...root.querySelectorAll('[data-zhkh-case]')];
  const status = root.querySelector('[data-zhkh-status]');
  function applies(card) {
    return housing.value === 'all' || card.dataset.housing.split(' ').includes(housing.value);
  }
  function update() {
    for (const option of issue.options) {
      if (option.value === 'all') continue;
      option.disabled = !cards.some(card => card.dataset.zhkhCase === option.value && applies(card));
    }
    if (issue.selectedOptions[0]?.disabled) issue.value = 'all';
    let visible = 0;
    for (const card of cards) {
      card.hidden = !applies(card) || (issue.value !== 'all' && card.dataset.zhkhCase !== issue.value);
      if (!card.hidden) visible += 1;
      if (issue.value !== 'all' && !card.hidden) card.querySelector('details').open = true;
      if (card.hidden) card.querySelector('details').open = false;
    }
    root.querySelector('[data-zhkh-house-note]').hidden = housing.value !== 'house';
    status.textContent = `Показано маршрутов: ${visible}. ${issue.value === 'all' ? 'Откройте нужную карточку.' : 'Первые шаги раскрыты ниже.'}`;
  }
  housing.addEventListener('change', update);
  issue.addEventListener('change', update);
  root.querySelector('[data-zhkh-reset]').addEventListener('click', () => {
    housing.value = 'all'; issue.value = 'all';
    cards.forEach(card => { card.querySelector('details').open = false; });
    update(); housing.focus();
  });
  root.querySelector('[data-zhkh-controls]').hidden = false;
  update();
})();
