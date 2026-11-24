// Field map: small data file the extension downloads so a renamed field or page on the visa site can be fixed
// without a store review. Data only (renames), never code. The same rules are checked in the extension.
//   ids:         { "oldId": "newId" }                 renames used on every page
//   pageIds:     { "BasicDetails": { "oldId": "newId" } } renames for one page
//   pageAliases: { "NewPagePath": "KnownPageKey" }      a page that moved to a new URL path
const NAME = /^[A-Za-z0-9_.:-]{1,80}$/;

export function validateFieldMap(m) {
  const errors = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['The field map must be a JSON object.'];
  const pairs = (obj, where) => {
    if (obj === undefined) return;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return errors.push(`${where} must be an object.`);
    for (const [k, v] of Object.entries(obj)) {
      if (!NAME.test(k) || typeof v !== 'string' || !NAME.test(v)) errors.push(`${where}: "${k}" → "${v}" is not a valid name.`);
    }
  };
  pairs(m.ids, 'ids');
  pairs(m.pageAliases, 'pageAliases');
  if (m.pageIds !== undefined) {
    if (!m.pageIds || typeof m.pageIds !== 'object' || Array.isArray(m.pageIds)) errors.push('pageIds must be an object.');
    else for (const [page, map] of Object.entries(m.pageIds)) {
      if (!NAME.test(page)) errors.push(`pageIds: "${page}" is not a valid page name.`);
      pairs(map, `pageIds.${page}`);
    }
  }
  const extra = Object.keys(m).filter(k => !['version', 'updatedAt', 'note', 'ids', 'pageIds', 'pageAliases'].includes(k));
  if (extra.length) errors.push(`Unknown keys: ${extra.join(', ')}.`);
  return errors;
}

export const EMPTY_MAP = { version: 0, updatedAt: null, note: '', ids: {}, pageIds: {}, pageAliases: {} };
