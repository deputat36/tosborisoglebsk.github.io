const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'tos_audit.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasGoodDescription(tos) {
  const text = String(tos.description || '').trim();
  return text && text !== 'Описание пока уточняется.' && text.length >= 120;
}

function scoreTos(tos) {
  const checks = [
    Boolean(tos.slug),
    Boolean(tos.name),
    Boolean(tos.type),
    Boolean(tos.location),
    Boolean(tos.boundaries),
    Boolean(tos.founded),
    Boolean(tos.chairperson),
    Boolean((tos.phones || []).length),
    Boolean((tos.emails || []).length),
    Boolean((tos.social_links || []).length),
    Boolean(tos.population),
    Boolean(tos.logo),
    hasGoodDescription(tos),
    Boolean(tos.updated_at)
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

function issuesFor(tos) {
  const issues = [];
  if (!tos.slug) issues.push('нет slug');
  if (!tos.name) issues.push('нет названия');
  if (!tos.type) issues.push('нет типа');
  if (!tos.location) issues.push('нет населённого пункта');
  if (!tos.boundaries) issues.push('нет границ');
  if (!tos.founded) issues.push('нет года создания');
  if (!tos.chairperson) issues.push('нет председателя');
  if (!(tos.phones || []).length) issues.push('нет телефона');
  if (!(tos.emails || []).length) issues.push('нет email');
  if (!(tos.social_links || []).length) issues.push('нет соцсетей');
  if (!tos.population) issues.push('нет численности');
  if (!tos.logo) issues.push('нет логотипа');
  if (!hasGoodDescription(tos)) issues.push('слабое или пустое описание');
  if (!tos.updated_at) issues.push('нет даты обновления');
  if (!tos.trust?.checked_at) issues.push('нет даты фактической проверки');
  return issues;
}

function verificationStatus(tos, score) {
  const explicit = tos.verification_status || tos.verification?.status || '';
  const trust = tos.trust || {};
  const checkedAt = trust.checked_at || tos.verified_at || tos.verification?.date || '';
  const sourceRef = trust.source_ref || tos.verification_source || tos.verification?.source || '';
  const scope = Array.isArray(trust.verification_scope) ? trust.verification_scope : [];

  if (explicit) return explicit;
  if (checkedAt && sourceRef && scope.length) return score >= 80 ? 'partial' : 'needs_review';
  return 'needs_review';
}

function verificationLabel(status) {
  return ({
    verified: 'Сведения подтверждены',
    partial: 'Проверено частично',
    needs_review: 'Требует проверки',
    stale: 'Проверка устарела',
    unknown: 'Данные уточняются'
  })[status] || 'Данные уточняются';
}

function main() {
  const toses = readJson(TOSES_PATH);
  const seen = new Map();
  const duplicates = [];

  for (const tos of toses) {
    if (!tos.slug) continue;
    if (seen.has(tos.slug)) duplicates.push(tos.slug);
    seen.set(tos.slug, true);
  }

  const items = toses.map((tos) => {
    const score = scoreTos(tos);
    const issues = issuesFor(tos);
    const verification_status = verificationStatus(tos, score);
    return {
      slug: tos.slug || '',
      name: tos.name || '',
      location: tos.location || '',
      chairperson: tos.chairperson || '',
      updated_at: tos.updated_at || '',
      checked_at: tos.trust?.checked_at || '',
      recheck_after: tos.trust?.recheck_after || '',
      verification_scope: Array.isArray(tos.trust?.verification_scope) ? tos.trust.verification_scope : [],
      score,
      level: score >= 80 ? 'good' : score >= 55 ? 'medium' : 'low',
      verification_status,
      verification_label: verificationLabel(verification_status),
      issues
    };
  }).sort((a, b) => a.score - b.score || String(a.name).localeCompare(String(b.name), 'ru'));

  const summary = {
    generated_at: new Date().toISOString(),
    total: items.length,
    good: items.filter((item) => item.level === 'good').length,
    medium: items.filter((item) => item.level === 'medium').length,
    low: items.filter((item) => item.level === 'low').length,
    verified: items.filter((item) => item.verification_status === 'verified').length,
    partial: items.filter((item) => item.verification_status === 'partial').length,
    needs_review: items.filter((item) => item.verification_status === 'needs_review').length,
    unknown: items.filter((item) => item.verification_status === 'unknown').length,
    checked_with_evidence: items.filter((item) => item.checked_at && item.verification_scope.length).length,
    without_phone: items.filter((item) => item.issues.includes('нет телефона')).length,
    without_email: items.filter((item) => item.issues.includes('нет email')).length,
    without_social: items.filter((item) => item.issues.includes('нет соцсетей')).length,
    without_logo: items.filter((item) => item.issues.includes('нет логотипа')).length,
    weak_description: items.filter((item) => item.issues.includes('слабое или пустое описание')).length,
    duplicate_slugs: duplicates
  };

  const result = { summary, items };
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');

  console.log(`TOS audit: ${summary.total} records`);
  console.log(`Good: ${summary.good}, medium: ${summary.medium}, low: ${summary.low}`);
  console.log(`Verified: ${summary.verified}, partial: ${summary.partial}, needs review: ${summary.needs_review}, unknown: ${summary.unknown}`);
  console.log(`Evidence-backed checks: ${summary.checked_with_evidence}`);
  if (duplicates.length) {
    console.error(`Duplicate slugs: ${duplicates.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
