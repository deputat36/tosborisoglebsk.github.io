const { parseCsv } = require('./lib/csv');

function assertEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
  }
}

assertEqual(
  parseCsv('a,b,c\n1,2,3\n'),
  [
    ['a', 'b', 'c'],
    ['1', '2', '3']
  ],
  'simple csv failed'
);

assertEqual(
  parseCsv('name,text\nitem,"one, two"\n'),
  [
    ['name', 'text'],
    ['item', 'one, two']
  ],
  'quoted comma failed'
);

assertEqual(
  parseCsv('name,text\nitem,"line one\nline two"\n'),
  [
    ['name', 'text'],
    ['item', 'line one\nline two']
  ],
  'quoted newline failed'
);

assertEqual(
  parseCsv('name,text\nitem,"quote ""inside"""\n'),
  [
    ['name', 'text'],
    ['item', 'quote "inside"']
  ],
  'escaped quote failed'
);

console.log('CSV parser tests OK');
