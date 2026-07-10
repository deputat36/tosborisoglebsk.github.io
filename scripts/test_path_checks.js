const { extractRepoPathTokens, repoPathExists } = require('./lib/path_checks');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tokens = extractRepoPathTokens('docs/STATUS.md и data/user_decision_queue.csv, обычный текст');
assert(tokens.includes('docs/STATUS.md'), 'docs path not extracted');
assert(tokens.includes('data/user_decision_queue.csv'), 'data path not extracted');
assert(!tokens.includes('обычный текст'), 'plain text must not be extracted');

const commandTokens = extractRepoPathTokens('package.json: check:js, validate:data, audit:links, audit:seo');
assert(!commandTokens.includes('audit:links'), 'npm script audit:links must not be treated as a repository path');
assert(!commandTokens.includes('audit:seo'), 'npm script audit:seo must not be treated as a repository path');

assert(repoPathExists('docs/STATUS.md'), 'existing docs file not found');
assert(repoPathExists('data/user_decision_queue.csv'), 'existing data file not found');
assert(repoPathExists('/site-health/'), 'existing section with index.html not found');
assert(!repoPathExists('data/__missing_file__.csv'), 'missing file reported as existing');

console.log('Path checks tests OK');
