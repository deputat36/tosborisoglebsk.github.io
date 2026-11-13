(function () {
  'use strict';
  const core = window.CollectionBrowserCore;
  const cards = [...document.querySelectorAll('[data-practice]')];
  const controls = document.querySelector('[data-practice-controls]');
  if (!core || !cards.length || !controls) return;
  const fields = {q:document.querySelector('#practice-search'),topic:document.querySelector('#practice-topic'),tos:document.querySelector('#practice-tos')};
  const names = Object.keys(fields);
  const initial = core.parseState(window.location.search, names);
  for (const name of ['topic','tos']) if (![...fields[name].options].some(option => option.value === initial[name])) initial[name] = '';
  core.applyControls(initial, fields);
  function apply(sync = true) {
    const state = core.readControls(fields), words = core.normalizeText(state.q).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const text = core.normalizeText(card.textContent);
      const matches = (!state.topic || card.dataset.topic === state.topic) && (!state.tos || card.dataset.toses.split(' ').includes(state.tos)) && words.every(word => text.includes(word));
      card.hidden = !matches;
      if (matches) count++;
    }
    document.querySelector('#practice-status').textContent = `Найдено ${count} из ${cards.length} практик.`;
    document.querySelector('[data-practice-empty]').hidden = count > 0;
    if (sync) {
      const url = new URL(window.location.href);
      for (const name of names) state[name] ? url.searchParams.set(name,state[name]) : url.searchParams.delete(name);
      window.history.replaceState(null,'',url.pathname + url.search + url.hash);
    }
  }
  function revealAnchor() {
    const target = cards.find(card => '#' + card.id === window.location.hash);
    if (!target) return;
    if (target.hidden) {core.resetControls(fields);apply();}
    const details = target.querySelector('details');
    if (details) details.open = true;
  }
  core.bindControls(fields, () => apply());
  document.querySelector('#practice-reset').addEventListener('click', () => {core.resetControls(fields);apply();fields.q.focus();});
  window.addEventListener('hashchange',revealAnchor);
  window.addEventListener('popstate', () => {core.applyControls(core.parseState(window.location.search,names),fields);apply(false);revealAnchor();});
  controls.hidden = false;
  apply(false);
  revealAnchor();
}());
