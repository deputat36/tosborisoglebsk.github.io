const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function cleanPlace(value) {
  return String(value || 'Территория уточняется').trim();
}

function placeTitle(value) {
  return cleanPlace(value)
    .replace(/^г\.\s*/i, '')
    .replace(/^с\.\s*/i, '')
    .replace(/^п\.\s*/i, '')
    .trim();
}

function slugifyPlace(value) {
  return String(value || 'place')
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => CYR[letter] || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'place';
}

function placeSlug(location) {
  return slugifyPlace(placeTitle(location));
}

function placeRoute(location) {
  return `/places/${placeSlug(location)}/`;
}

module.exports = {
  cleanPlace,
  placeTitle,
  slugifyPlace,
  placeSlug,
  placeRoute
};
