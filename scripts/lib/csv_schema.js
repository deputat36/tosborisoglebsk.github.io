function validateHeaders(headers, expectedHeaders, fileLabel) {
  const errors = [];

  if (!headers) {
    errors.push(`${fileLabel}: missing header row`);
    return errors;
  }

  expectedHeaders.forEach((header, index) => {
    if (headers[index] !== header) {
      errors.push(`${fileLabel}: expected header ${header} at column ${index + 1}, got ${headers[index] || 'empty'}`);
    }
  });

  if (headers.length !== expectedHeaders.length) {
    errors.push(`${fileLabel}: expected ${expectedHeaders.length} columns, got ${headers.length}`);
  }

  return errors;
}

module.exports = { validateHeaders };
