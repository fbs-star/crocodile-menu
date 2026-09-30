// Turso (libSQL)-backed "database" for the Crocodile Bar & Grill admin site.
// Replaces the old local-JSON-file store: admin edits are now persisted in a
// real hosted database, so they survive Render redeploys.
//
// Preserves the same load() / save(data) / nextId(data, kind) shape used
// throughout server.js, so route handlers only needed to add `await`.
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

function emptyDb() {
  return {
    settings: {
      restaurantName: 'Crocodile Bar & Grill',
      parentProperty: 'Thavorn Beach Village',
      tagline: '',
      heroImage: '/images/hero-default.jpg',
      currencySymbol: '฿',
      logoText: 'CROCODILE',
      callStaffEnabled: false
    },
    categories: [],
    items: [],
    promotions: [],
    callRequests: [],
    nextIds: { category: 1, item: 1, promotion: 1, callRequest: 1 }
  };
}

// Creates the tables if they don't exist yet. Safe to call every time the
// server boots — idempotent, and only runs once at startup (not per request).
async function init() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        restaurant_name TEXT,
        parent_property TEXT,
        tagline TEXT,
        hero_image TEXT,
        currency_symbol TEXT,
        logo_text TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        group_name TEXT,
        name_en TEXT, name_th TEXT, name_ru TEXT, name_zh TEXT, name_ar TEXT,
        status TEXT,
        sort_order INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        category_id INTEGER,
        name_en TEXT, name_th TEXT, name_ru TEXT, name_zh TEXT, name_ar TEXT,
        desc_en TEXT, desc_th TEXT, desc_ru TEXT, desc_zh TEXT, desc_ar TEXT,
        price TEXT,
        tags TEXT,
        image_url TEXT,
        status TEXT,
        sort_order INTEGER,
        unit TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY,
        title_en TEXT, title_th TEXT, title_ru TEXT, title_zh TEXT, title_ar TEXT,
        subtitle_en TEXT, subtitle_th TEXT, subtitle_ru TEXT, subtitle_zh TEXT, subtitle_ar TEXT,
        price_text TEXT,
        image_url TEXT,
        status TEXT,
        sort_order INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS call_requests (
        id INTEGER PRIMARY KEY,
        status TEXT,
        created_at TEXT,
        resolved_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value INTEGER
      )`
    ],
    'write'
  );

  // The settings table already existed before the "Call Staff" feature was
  // added, so a brand-new column has to be migrated in with ALTER TABLE
  // rather than CREATE TABLE IF NOT EXISTS (which only applies to a table
  // that doesn't exist yet). This runs on every boot and is safe to repeat:
  // once the column is there, libSQL rejects the duplicate-column ALTER and
  // we just ignore that one specific error.
  try {
    await client.execute('ALTER TABLE settings ADD COLUMN call_staff_enabled INTEGER DEFAULT 0');
  } catch (e) {
    if (!/duplicate column/i.test(e.message || '')) throw e;
  }
}

function safeParseTags(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function load() {
  const base = emptyDb();

  const [settingsRs, catRs, itemRs, promoRs, callRs, metaRs] = await Promise.all([
    client.execute('SELECT * FROM settings WHERE id = 1'),
    client.execute('SELECT * FROM categories ORDER BY id'),
    client.execute('SELECT * FROM items ORDER BY id'),
    client.execute('SELECT * FROM promotions ORDER BY id'),
    client.execute('SELECT * FROM call_requests ORDER BY id'),
    client.execute('SELECT * FROM meta')
  ]);

  const settingsRow = settingsRs.rows[0];
  const settings = settingsRow
    ? {
        restaurantName: settingsRow.restaurant_name || base.settings.restaurantName,
        parentProperty: settingsRow.parent_property || '',
        tagline: settingsRow.tagline || '',
        heroImage: settingsRow.hero_image || base.settings.heroImage,
        currencySymbol: settingsRow.currency_symbol || base.settings.currencySymbol,
        logoText: settingsRow.logo_text || base.settings.logoText,
        callStaffEnabled: !!Number(settingsRow.call_staff_enabled || 0)
      }
    : base.settings;

  const categories = catRs.rows.map((r) => ({
    id: Number(r.id),
    group: r.group_name,
    name: {
      en: r.name_en || '',
      th: r.name_th || '',
      ru: r.name_ru || '',
      zh: r.name_zh || '',
      ar: r.name_ar || ''
    },
    status: r.status,
    sortOrder: Number(r.sort_order) || 0
  }));

  const items = itemRs.rows.map((r) => ({
    id: Number(r.id),
    categoryId: Number(r.category_id),
    name: {
      en: r.name_en || '',
      th: r.name_th || '',
      ru: r.name_ru || '',
      zh: r.name_zh || '',
      ar: r.name_ar || ''
    },
    desc: {
      en: r.desc_en || '',
      th: r.desc_th || '',
      ru: r.desc_ru || '',
      zh: r.desc_zh || '',
      ar: r.desc_ar || ''
    },
    price: r.price || '',
    tags: safeParseTags(r.tags),
    imageUrl: r.image_url || '',
    status: r.status,
    sortOrder: Number(r.sort_order) || 0,
    unit: r.unit || null
  }));

  const promotions = promoRs.rows.map((r) => ({
    id: Number(r.id),
    title: {
      en: r.title_en || '',
      th: r.title_th || '',
      ru: r.title_ru || '',
      zh: r.title_zh || '',
      ar: r.title_ar || ''
    },
    subtitle: {
      en: r.subtitle_en || '',
      th: r.subtitle_th || '',
      ru: r.subtitle_ru || '',
      zh: r.subtitle_zh || '',
      ar: r.subtitle_ar || ''
    },
    priceText: r.price_text || '',
    imageUrl: r.image_url || '',
    status: r.status,
    sortOrder: Number(r.sort_order) || 0
  }));

  const callRequests = callRs.rows.map((r) => ({
    id: Number(r.id),
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at || null
  }));

  const nextIds = { category: 1, item: 1, promotion: 1, callRequest: 1 };
  metaRs.rows.forEach((r) => {
    nextIds[r.key] = Number(r.value);
  });

  return { settings, categories, items, promotions, callRequests, nextIds };
}

// Persists the whole in-memory object back to Turso: delete-all-then-bulk-
// reinsert-with-explicit-IDs, run as a single batched transaction. This keeps
// the ~30 existing route handlers (which all mutate the in-memory object and
// then call save()) working unchanged.
async function save(data) {
  const statements = [];

  statements.push({ sql: 'DELETE FROM settings', args: [] });
  statements.push({ sql: 'DELETE FROM categories', args: [] });
  statements.push({ sql: 'DELETE FROM items', args: [] });
  statements.push({ sql: 'DELETE FROM promotions', args: [] });
  statements.push({ sql: 'DELETE FROM call_requests', args: [] });
  statements.push({ sql: 'DELETE FROM meta', args: [] });

  const s = data.settings || {};
  statements.push({
    sql: `INSERT INTO settings (id, restaurant_name, parent_property, tagline, hero_image, currency_symbol, logo_text, call_staff_enabled)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      s.restaurantName || '',
      s.parentProperty || '',
      s.tagline || '',
      s.heroImage || '',
      s.currencySymbol || '',
      s.logoText || '',
      s.callStaffEnabled ? 1 : 0
    ]
  });

  (data.categories || []).forEach((c) => {
    statements.push({
      sql: `INSERT INTO categories (id, group_name, name_en, name_th, name_ru, name_zh, name_ar, status, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        c.id,
        c.group,
        (c.name && c.name.en) || '',
        (c.name && c.name.th) || '',
        (c.name && c.name.ru) || '',
        (c.name && c.name.zh) || '',
        (c.name && c.name.ar) || '',
        c.status,
        c.sortOrder || 0
      ]
    });
  });

  (data.items || []).forEach((i) => {
    statements.push({
      sql: `INSERT INTO items (id, category_id, name_en, name_th, name_ru, name_zh, name_ar, desc_en, desc_th, desc_ru, desc_zh, desc_ar, price, tags, image_url, status, sort_order, unit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        i.id,
        i.categoryId,
        (i.name && i.name.en) || '',
        (i.name && i.name.th) || '',
        (i.name && i.name.ru) || '',
        (i.name && i.name.zh) || '',
        (i.name && i.name.ar) || '',
        (i.desc && i.desc.en) || '',
        (i.desc && i.desc.th) || '',
        (i.desc && i.desc.ru) || '',
        (i.desc && i.desc.zh) || '',
        (i.desc && i.desc.ar) || '',
        i.price || '',
        JSON.stringify(i.tags || []),
        i.imageUrl || '',
        i.status,
        i.sortOrder || 0,
        i.unit || null
      ]
    });
  });

  (data.promotions || []).forEach((p) => {
    statements.push({
      sql: `INSERT INTO promotions (id, title_en, title_th, title_ru, title_zh, title_ar, subtitle_en, subtitle_th, subtitle_ru, subtitle_zh, subtitle_ar, price_text, image_url, status, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id,
        (p.title && p.title.en) || '',
        (p.title && p.title.th) || '',
        (p.title && p.title.ru) || '',
        (p.title && p.title.zh) || '',
        (p.title && p.title.ar) || '',
        (p.subtitle && p.subtitle.en) || '',
        (p.subtitle && p.subtitle.th) || '',
        (p.subtitle && p.subtitle.ru) || '',
        (p.subtitle && p.subtitle.zh) || '',
        (p.subtitle && p.subtitle.ar) || '',
        p.priceText || '',
        p.imageUrl || '',
        p.status,
        p.sortOrder || 0
      ]
    });
  });

  (data.callRequests || []).forEach((c) => {
    statements.push({
      sql: `INSERT INTO call_requests (id, status, created_at, resolved_at)
            VALUES (?, ?, ?, ?)`,
      args: [c.id, c.status, c.createdAt || null, c.resolvedAt || null]
    });
  });

  const nextIds = data.nextIds || { category: 1, item: 1, promotion: 1, callRequest: 1 };
  Object.keys(nextIds).forEach((k) => {
    statements.push({ sql: 'INSERT INTO meta (key, value) VALUES (?, ?)', args: [k, nextIds[k]] });
  });

  await client.batch(statements, 'write');
}

function nextId(db, kind) {
  db.nextIds = db.nextIds || { category: 1, item: 1, promotion: 1, callRequest: 1 };
  const id = db.nextIds[kind] || 1;
  db.nextIds[kind] = id + 1;
  return id;
}

module.exports = { load, save, nextId, emptyDb, init };
