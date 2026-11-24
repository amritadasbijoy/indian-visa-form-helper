// Checked hotels and hospitals the owner publishes for everyone (Hotels / Hospitals tab → "Directory").
// Plain text fields only; the extension shows them and the user chooses what to save.
export const EMPTY_DIRECTORY = { hotels: [], hospitals: [], updatedAt: null };
const FIELDS = { hotels: ['name', 'address1', 'address2', 'state', 'district', 'phone', 'email', 'note'], hospitals: ['name', 'address1', 'address2', 'state', 'district', 'phone', 'email', 'doctor', 'note'] };

export function validateDirectory(d) {
  const errors = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['The directory must be a JSON object with "hotels" and "hospitals" lists.'];
  for (const [list, fields] of Object.entries(FIELDS)) {
    const items = d[list] ?? [];
    if (!Array.isArray(items)) { errors.push(`"${list}" must be a list.`); continue; }
    if (items.length > 500) errors.push(`"${list}": at most 500 entries.`);
    items.forEach((x, i) => {
      if (!x || typeof x !== 'object') return errors.push(`${list}[${i}] must be an object.`);
      if (!x.name) errors.push(`${list}[${i}]: name is required.`);
      for (const [k, v] of Object.entries(x)) {
        if (!fields.includes(k)) errors.push(`${list}[${i}]: unknown field "${k}".`);
        else if (typeof v !== 'string' || v.length > 200) errors.push(`${list}[${i}].${k} must be text up to 200 characters.`);
      }
    });
  }
  const extra = Object.keys(d).filter(k => !['hotels', 'hospitals', 'updatedAt'].includes(k));
  if (extra.length) errors.push(`Unknown keys: ${extra.join(', ')}.`);
  return errors;
}
