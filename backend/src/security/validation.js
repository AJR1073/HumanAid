const text = (max, required = false) => ({ type: 'string', max, required });
const integer = (max = 2147483647, required = false) => ({ type: 'number', min: 1, max, integer: true, required });
const choice = (values, required = false) => ({ type: 'enum', values, required });
const bool = { type: 'boolean' };
const email = { ...text(254), format: 'email' };
const url = { ...text(2048), format: 'url' };
const uid = text(128);
const latitude = { type: 'number', min: -90, max: 90 };
const longitude = { type: 'number', min: -180, max: 180 };

function readValue(value, rule) {
  if (value === undefined || value === null || value === '') {
    if (rule.required || (rule.nonempty && value !== undefined)) throw new Error('required');
    return value === undefined ? undefined : null;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') throw new Error('string');
    value = value.trim();
    if (((rule.required || rule.nonempty) && !value) || value.length > rule.max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('string');
    if (rule.format === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('email');
    if (rule.format === 'state' && !/^[A-Za-z]{2}$/.test(value)) throw new Error('state');
    if (rule.format === 'zip' && !/^\d{5}(?:-\d{4})?$/.test(value)) throw new Error('zip');
    if (rule.format === 'url' && value) {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('url');
    }
    return value;
  }
  if (rule.type === 'number') {
    if ((typeof value !== 'string' && typeof value !== 'number') || !/^-?(?:\d+|\d*\.\d+)$/.test(String(value))) throw new Error('number');
    const number = Number(value);
    if (!Number.isFinite(number) || number < rule.min || number > rule.max || (rule.integer && !Number.isInteger(number))) throw new Error('number');
    return number;
  }
  if (rule.type === 'boolean') {
    if (![true, false, 'true', 'false'].includes(value)) throw new Error('boolean');
    return value === true || value === 'true';
  }
  if (rule.type === 'enum') {
    if (!rule.values.includes(value)) throw new Error('enum');
    return value;
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length > rule.max) throw new Error('array');
    return value.map((entry) => readValue(entry, rule.item));
  }
  if (rule.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 20 || JSON.stringify(value).length > 4096) throw new Error('object');
    if (['__proto__', 'constructor', 'prototype'].some((key) => Object.hasOwn(value, key))) throw new Error('object');
    return value;
  }
  throw new Error('rule');
}

function validate(schema, source = 'body', { allowUnknown = false } = {}) {
  return (req, res, next) => {
    const values = req[source];
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return res.status(400).json({ error: 'A JSON object is required' });
    }
    if (!allowUnknown && Object.keys(values).some((key) => !Object.hasOwn(schema, key))) {
      return res.status(400).json({ error: 'Unexpected request field' });
    }
    for (const [key, rule] of Object.entries(schema)) {
      try {
        const value = readValue(values[key], rule);
        if (source === 'query' && value === null) delete values[key];
        else if (value !== undefined) values[key] = value;
      } catch {
        return res.status(400).json({ error: `Invalid or missing ${key}` });
      }
    }
    return next();
  };
}

function requireCoordinatePair(req, res, next) {
  const hasLat = req.query.lat !== undefined && req.query.lat !== null;
  const hasLon = req.query.lon !== undefined && req.query.lon !== null;
  if (hasLat !== hasLon) return res.status(400).json({ error: 'Latitude and longitude must be provided together' });
  return next();
}

function validateId(req, res, next, value) {
  try { readValue(value, integer(2147483647, true)); return next(); }
  catch { return res.status(400).json({ error: 'Invalid resource identifier' }); }
}

const schemas = {
  resources: {
    city: text(150), state: { ...text(2), format: 'state' }, category: text(100), zip: text(10),
    lat: latitude, lon: longitude, radius: { type: 'number', min: 1, max: 500 },
    limit: integer(1000), ids: { ...text(11000), nonempty: true }, mode: choice(['need_help', 'want_help', 'both'])
  },
  search: { mode: choice(['need_help', 'want_help', 'both']), q: text(200, true), lat: latitude, lon: longitude, radius: { type: 'number', min: 1, max: 500 }, limit: integer(100) },
  categories: { mode: choice(['need_help', 'want_help', 'both']), include_empty: choice(['true', 'false']), all_levels: choice(['true', 'false']) },
  adminResources: { page: integer(100000), limit: integer(1000), search: text(200), missing_zip: choice(['true', 'false']), category: integer() },
  scan: { url: { ...url, required: true } },
  submission: {
    name: text(500, true), description: text(10000), address: text(500, true), city: text(150, true),
    state: { ...text(2, true), format: 'state' }, zipCode: { ...text(10, true), format: 'zip' },
    phone: text(50), website: url, email, hours: text(2000), primaryCategoryId: integer(2147483647, true),
    categoryId: integer(), tags: { type: 'array', max: 30, item: text(100, true) },
    foodDistOnsite: bool, foodDistType: choice(['boxes', 'meal', 'both']), notes: text(5000),
    submittedBy: email, submittedByName: text(255), submittedByUid: uid
  },
  favorite: { uid, resourceId: integer(2147483647, true) },
  sync: { uid, email, displayName: text(255), photoURL: url },
  review: { action: choice(['approve', 'reject'], true), reviewedBy: text(254) },
  resource: {
    name: text(500, true), address: text(500), city: text(150), state: { ...text(2), format: 'state' }, zip_code: { ...text(10), format: 'zip' },
    phone: text(50), website: url, email, hours: text(2000), primary_category_id: integer(), is_active: bool,
    eligibility_requirements: text(5000), appointment_required: bool, walk_ins_accepted: bool,
    food_dist_type: choice(['boxes', 'meal', 'both']), food_dist_onsite: bool, service_area: text(2000),
    languages_spoken: text(2000), description: text(10000), latitude, longitude
  },
  adminEmail: { email: { ...email, required: true } },
  report: { issue_type: choice(['incorrect_info', 'closed', 'duplicate', 'wrong_category', 'other'], true), description: text(5000), contact_email: email },
  resolution: { status: choice(['resolved', 'dismissed'], true), resolution_notes: text(5000) },
  analytics: { user_id: uid, resource_id: integer(), action_type: choice(['view_resource', 'view_admin_dashboard', 'search', 'page_view'], true), details: { type: 'object' } }
};

module.exports = { validate, validateId, requireCoordinatePair, readValue, schemas, integer };
