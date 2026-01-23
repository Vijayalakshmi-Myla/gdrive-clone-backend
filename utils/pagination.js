export function buildOffsetPagination({ page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const offset = (page - 1) * safeLimit;
  return { limit: safeLimit, offset };
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ created_at: row.created_at, id: row.id })).toString('base64');
}
