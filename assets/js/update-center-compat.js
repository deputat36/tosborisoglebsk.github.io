(() => {
  'use strict';

  const legacy = {
    '#template-card': 'card',
    '#template-news': 'news',
    '#template-photo': 'photo',
    '#template-event': 'event',
    '#template-project': 'project',
    '#template-need': 'need'
  };
  const type = legacy[location.hash];
  if (!type || new URLSearchParams(location.search).has('type')) return;

  function activate() {
    const button = document.querySelector(`.scenario-card[data-scenario="${type}"]`);
    if (!button) return false;
    button.click();
    history.replaceState(null, '', `${location.pathname}?type=${encodeURIComponent(type)}`);
    document.querySelector('#message-builder')?.scrollIntoView({ block: 'start' });
    return true;
  }

  if (!activate()) document.addEventListener('DOMContentLoaded', activate, { once: true });
})();
