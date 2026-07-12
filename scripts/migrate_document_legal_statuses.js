const fs = require('fs');
const path = require('path');

const documentsPath = path.join(process.cwd(), 'data', 'documents.json');

function classify(item) {
  const text = [item.title, item.type, item.status, item.description]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/утратил\s+силу|архив|историческ/.test(text)) {
    return 'archival';
  }

  if (/правовая база|изменения в устав|федеральн(ый|ого) закон|закон воронежской области|решение .*дум|муниципальн.*документ|региональный опыт/.test(text)) {
    return 'source_requires_official_check';
  }

  return 'draft_methodical';
}

function normalizeDisplayStatus(item) {
  if (item.legal_status === 'draft_methodical' && /^Можно (использовать|заполнить)/i.test(String(item.status || ''))) {
    return 'Методическая заготовка / адаптировать и проверить перед применением';
  }

  if (item.legal_status === 'source_requires_official_check') {
    const status = String(item.status || '');
    const hasStrictEvidence = Boolean(item.official_source_url && item.legal_checked_at && item.legal_checked_by);
    if (!hasStrictEvidence && /^Действующ/i.test(status)) {
      return 'Локальная копия правового документа / требуется официальная сверка';
    }
  }

  return item.status || '';
}

function main() {
  if (!fs.existsSync(documentsPath)) {
    throw new Error('Missing data/documents.json');
  }

  const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
  if (!Array.isArray(documents)) {
    throw new Error('data/documents.json must contain an array');
  }

  let changed = 0;
  for (const item of documents) {
    const before = JSON.stringify(item);

    item.legal_status = item.legal_status || classify(item);
    item.legal_checked_at = String(item.legal_checked_at || '');
    item.legal_checked_by = String(item.legal_checked_by || '');
    item.legal_recheck_after = String(item.legal_recheck_after || '');
    item.official_source_url = String(item.official_source_url || '');
    item.legal_decision_ref = String(item.legal_decision_ref || '');
    item.status = normalizeDisplayStatus(item);

    if (JSON.stringify(item) !== before) changed += 1;
  }

  fs.writeFileSync(documentsPath, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  console.log(`Document legal status migration: ${documents.length} records, ${changed} changed`);
}

main();
