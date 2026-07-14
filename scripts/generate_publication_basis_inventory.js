const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'data', 'toses.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'data', 'publication_basis_inventory.json');

const PERSONAL_SCOPE_FIELDS = [
  ['chairperson', (tos) => Boolean(text(tos.chairperson))],
  ['phones', (tos) => array(tos.phones).length > 0],
  ['emails', (tos) => array(tos.emails).length > 0],
  ['chairperson_links', (tos) => array(tos.chairperson_links).length > 0],
  ['social_links', (tos) => array(tos.social_links).some(isPersonalProfileLink)],
  ['logo', (tos) => Boolean(text(tos.logo))],
  ['photos', (tos) => mediaCount(tos) > 0]
];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value.filter((item) => text(item)) : [];
}

function normalizeUrl(value) {
  return text(value).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
}

function isPersonalProfileLink(value) {
  const url = normalizeUrl(value);
  return [
    /^(?:m\.)?vk\.(?:com|ru)\/id\d+(?:[/?#]|$)/,
    /^(?:m\.)?ok\.ru\/profile\/\d+(?:[/?#]|$)/,
    /^(?:m\.)?odnoklassniki\.ru\/profile\/\d+(?:[/?#]|$)/
  ].some((pattern) => pattern.test(url));
}

function isCommunityLink(value) {
  const url = normalizeUrl(value);
  return [
    /^(?:m\.)?vk\.(?:com|ru)\/(?:club|public)\d+(?:[/?#]|$)/,
    /^(?:m\.)?ok\.ru\/group\/\d+(?:[/?#]|$)/,
    /^(?:m\.)?odnoklassniki\.ru\/group\/\d+(?:[/?#]|$)/
  ].some((pattern) => pattern.test(url));
}

function mediaCount(tos) {
  return ['photos', 'images', 'gallery', 'media']
    .map((field) => array(tos[field]).length)
    .reduce((sum, count) => sum + count, 0);
}

function personalFields(tos) {
  return PERSONAL_SCOPE_FIELDS
    .filter(([, predicate]) => predicate(tos))
    .map(([field]) => field);
}

function missingScopes(tos, fields) {
  const scope = new Set(array(tos.trust && tos.trust.verification_scope));
  return fields.filter((field) => !scope.has(field));
}

function linkSummary(tos) {
  const links = [...array(tos.chairperson_links), ...array(tos.social_links)];
  const unique = [...new Set(links)];
  return {
    personal_profile_count: unique.filter(isPersonalProfileLink).length,
    community_count: unique.filter(isCommunityLink).length,
    other_public_link_count: unique.filter((link) => !isPersonalProfileLink(link) && !isCommunityLink(link)).length
  };
}

function basisStatus({ fields, hasSource, hasConsent, missingScope }) {
  if (!fields.length) return 'no_personal_publication';
  if (hasSource && hasConsent && missingScope.length === 0) return 'basis_documented';
  if (hasSource && !hasConsent) return 'source_only_consent_missing';
  return 'basis_review_required';
}

function recordFor(tos) {
  const trust = tos.trust && typeof tos.trust === 'object' ? tos.trust : {};
  const fields = personalFields(tos);
  const missingScope = missingScopes(tos, fields);
  const hasSource = Boolean(text(trust.source_ref));
  const hasConsent = Boolean(text(trust.publication_consent_ref));
  const links = linkSummary(tos);
  const verificationStatus = text(tos.verification_status) || 'needs_review';

  return {
    slug: text(tos.slug),
    title: text(tos.title) || text(tos.name),
    verification_status: verificationStatus,
    personal_fields: fields,
    personal_field_count: fields.length,
    phone_count: array(tos.phones).length,
    email_count: array(tos.emails).length,
    personal_profile_count: links.personal_profile_count,
    community_count: links.community_count,
    other_public_link_count: links.other_public_link_count,
    media_count: mediaCount(tos) + (text(tos.logo) ? 1 : 0),
    has_source_ref: hasSource,
    has_publication_consent_ref: hasConsent,
    missing_verification_scope: missingScope,
    basis_status: basisStatus({ fields, hasSource, hasConsent, missingScope })
  };
}

function metrics(records) {
  const count = (predicate) => records.filter(predicate).length;
  const sum = (field) => records.reduce((total, record) => total + Number(record[field] || 0), 0);
  return {
    cards_total: records.length,
    cards_with_personal_publication: count((record) => record.personal_field_count > 0),
    cards_with_phone: count((record) => record.phone_count > 0),
    cards_with_email: count((record) => record.email_count > 0),
    cards_with_personal_profile: count((record) => record.personal_profile_count > 0),
    cards_with_community_channel: count((record) => record.community_count > 0),
    cards_with_media: count((record) => record.media_count > 0),
    cards_with_source_ref: count((record) => record.has_source_ref),
    cards_with_publication_consent_ref: count((record) => record.has_publication_consent_ref),
    basis_documented: count((record) => record.basis_status === 'basis_documented'),
    basis_review_required: count((record) => record.basis_status === 'basis_review_required'),
    source_only_consent_missing: count((record) => record.basis_status === 'source_only_consent_missing'),
    no_personal_publication: count((record) => record.basis_status === 'no_personal_publication'),
    personal_fields_total: sum('personal_field_count'),
    phones_total: sum('phone_count'),
    emails_total: sum('email_count'),
    personal_profiles_total: sum('personal_profile_count'),
    community_channels_total: sum('community_count')
  };
}

function buildInventory(toses) {
  const records = (Array.isArray(toses) ? toses : [])
    .filter((tos) => tos && text(tos.slug) && tos.status !== 'draft')
    .map(recordFor)
    .sort((a, b) => a.slug.localeCompare(b.slug, 'ru'));

  return {
    schema_version: 1,
    source_file: 'data/toses.json',
    privacy_rule: 'inventory_only_no_legal_conclusion',
    values_redacted: true,
    metrics: metrics(records),
    records
  };
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) throw new Error('Missing data/toses.json');
  const toses = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const inventory = buildInventory(toses);
  const outputPath = process.env.PUBLICATION_BASIS_OUTPUT
    ? path.resolve(ROOT, process.env.PUBLICATION_BASIS_OUTPUT)
    : DEFAULT_OUTPUT_PATH;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  console.log(`Publication basis inventory generated: ${inventory.metrics.cards_total} cards, ${inventory.metrics.basis_review_required} require basis review`);
}

if (require.main === module) main();

module.exports = {
  buildInventory,
  isCommunityLink,
  isPersonalProfileLink,
  recordFor
};
