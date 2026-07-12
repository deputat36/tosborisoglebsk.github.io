const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'toses.json');

const emptyTrust = () => ({
  source_type: '',
  source_ref: '',
  checked_at: '',
  checked_by: '',
  recheck_after: '',
  verification_scope: [],
  publication_consent_ref: ''
});

function normalizeTrust(value) {
  const trust = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    source_type: String(trust.source_type || ''),
    source_ref: String(trust.source_ref || ''),
    checked_at: String(trust.checked_at || ''),
    checked_by: String(trust.checked_by || ''),
    recheck_after: String(trust.recheck_after || ''),
    verification_scope: Array.isArray(trust.verification_scope)
      ? trust.verification_scope.map((item) => String(item).trim()).filter(Boolean)
      : [],
    publication_consent_ref: String(trust.publication_consent_ref || '')
  };
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing data/toses.json');
  }

  const toses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(toses)) {
    throw new Error('data/toses.json must contain an array');
  }

  let changed = 0;
  for (const tos of toses) {
    const hadTrust = Object.prototype.hasOwnProperty.call(tos, 'trust');
    const before = JSON.stringify(hadTrust ? tos.trust : emptyTrust());
    tos.trust = normalizeTrust(tos.trust);
    const after = JSON.stringify(tos.trust);
    if (!hadTrust || before !== after) changed += 1;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(toses, null, 2)}\n`, 'utf8');
  console.log(`TOS trust metadata migration: ${toses.length} records, ${changed} changed`);
}

main();
