const { inferContentOrigin } = require('./content_origin');
const {
  buildCollectionContextLinks,
  collectionContextAllowedHref,
  collectionContextSectionId
} = require('./collection_context_navigation');

function decodeHtmlHref(value) {
  return String(value || '').replace(/&amp;/g, '&');
}

function routePath(href) {
  return String(href || '').split(/[?#]/)[0];
}

function extractLinks(sectionHtml) {
  const links = [];
  const pattern = /<a href="([^"]+)">([^<]+)<\/a>/g;
  let match;
  while ((match = pattern.exec(sectionHtml))) {
    links.push({ href: decodeHtmlHref(match[1]), label: match[2] });
  }
  return links;
}

function auditCollectionContext({ collection, item, tos, html, line, errors, repoPathExists }) {
  const sectionId = collectionContextSectionId(collection);
  const sectionPattern = new RegExp(`<section[^>]*id="${sectionId}"[^>]*>[\\s\\S]*?<\\/section>`);
  const sectionMatch = html.match(sectionPattern);

  if (!sectionMatch) {
    errors.push(`${line}: missing context navigation section #${sectionId}`);
    return;
  }

  const sectionHtml = sectionMatch[0];
  if (!sectionHtml.includes(`aria-labelledby="${sectionId}-title"`)) {
    errors.push(`${line}: context navigation must reference its heading`);
  }
  if (!sectionHtml.includes(`<h2 id="${sectionId}-title">Что делать дальше</h2>`)) {
    errors.push(`${line}: context navigation heading is missing`);
  }

  const links = extractLinks(sectionHtml);
  if (links.length < 3 || links.length > 5) {
    errors.push(`${line}: context navigation must contain 3-5 links, found ${links.length}`);
  }

  const hrefs = links.map((link) => link.href);
  if (new Set(hrefs).size !== hrefs.length) {
    errors.push(`${line}: context navigation contains duplicate links`);
  }

  links.forEach((link) => {
    if (!collectionContextAllowedHref(collection, link.href)) {
      errors.push(`${line}: context navigation contains disallowed route ${link.href}`);
      return;
    }
    const pathname = routePath(link.href);
    if (typeof repoPathExists === 'function' && !repoPathExists(pathname)) {
      errors.push(`${line}: context navigation route is missing ${pathname}`);
    }
  });

  const origin = inferContentOrigin(item, collection);
  const expectedLinks = buildCollectionContextLinks(collection, item, tos, origin);
  expectedLinks.forEach((expected) => {
    const actual = links.find((link) => link.href === expected.href);
    if (!actual) {
      errors.push(`${line}: expected context route is missing ${expected.href}`);
    } else if (actual.label !== expected.label) {
      errors.push(`${line}: unexpected label for ${expected.href}`);
    }
  });

  if (origin !== 'verified' && !hrefs.includes('/verification-guide/')) {
    errors.push(`${line}: non-verified material must link to /verification-guide/`);
  }

  if (tos?.slug && !hrefs.includes(`/tos/${tos.slug}/`)) {
    errors.push(`${line}: linked TOS must appear in context navigation`);
  }

  const updateLink = expectedLinks.find((link) => link.href.startsWith('/update-tos/'));
  if (!updateLink || !hrefs.includes(updateLink.href)) {
    errors.push(`${line}: context navigation must include the collection update route`);
  }
}

module.exports = { auditCollectionContext };
