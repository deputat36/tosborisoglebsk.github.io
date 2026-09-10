const fs = require('fs');
const path = require('path');

const TOSES_PATH = path.join(process.cwd(), 'data', 'toses.json');
const SLUG = 'kalinka';
const SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebskom-poselke-kalinino-pochistili-3-kolodca/';
const CHECKED_AT = '2026-09-10';
const SOURCE_TYPE = 'public_media_publication';
const VERIFIED_SCOPE = ['location', 'founded'];

function readToses() {
  const value = JSON.parse(fs.readFileSync(TOSES_PATH, 'utf8'));
  if (!Array.isArray(value)) throw new Error('data/toses.json must contain an array');
  return value;
}

function hasStrongerEvidence(trust) {
  if (!trust || typeof trust !== 'object') return false;
  if (!trust.checked_at || !trust.source_ref) return false;
  if (trust.source_type === SOURCE_TYPE && trust.source_ref === SOURCE_URL) return false;
  const scope = Array.isArray(trust.verification_scope) ? trust.verification_scope : [];
  return scope.length > VERIFIED_SCOPE.length || scope.some((field) => !VERIFIED_SCOPE.includes(field));
}

function main() {
  const toses = readToses();
  const index = toses.findIndex((item) => item && item.slug === SLUG);
  if (index < 0) throw new Error(`TOS not found: ${SLUG}`);

  const current = toses[index];
  const next = {
    ...current,
    location: 'п. Калинино',
    founded: '2020'
  };

  if (!hasStrongerEvidence(current.trust)) {
    next.verification_status = current.verification_status === 'verified' ? 'verified' : 'partial';
    next.trust = {
      ...(current.trust || {}),
      source_type: SOURCE_TYPE,
      source_ref: SOURCE_URL,
      checked_at: CHECKED_AT,
      checked_by: 'portal-editor:public-source-review',
      recheck_after: '2027-09-10',
      verification_scope: VERIFIED_SCOPE,
      publication_consent_ref: current.trust?.publication_consent_ref || ''
    };
  }

  if (JSON.stringify(next) !== JSON.stringify(current)) next.updated_at = CHECKED_AT;
  toses[index] = next;
  fs.writeFileSync(TOSES_PATH, `${JSON.stringify(toses, null, 2)}\n`, 'utf8');

  console.log(
    hasStrongerEvidence(current.trust)
      ? 'Kalinka profile: stronger existing trust preserved; stable source-backed fields synchronized'
      : `Kalinka profile partially verified from public source: ${VERIFIED_SCOPE.join(', ')}`
  );
}

main();

module.exports = { main, SLUG, SOURCE_URL, VERIFIED_SCOPE, hasStrongerEvidence };
