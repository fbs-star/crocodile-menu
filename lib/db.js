// Tiny JSON-file "database". No native deps, so it always installs cleanly
// on Render's free tier. Good enough for a single-restaurant admin site.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function emptyDb() {
  return {
    settings: {
      restaurantName: 'Crocodile Bar & Grill',
      parentProperty: 'Thavorn Beach Village',
      tagline: '',
      heroImage: '/images/hero-default.jpg',
      currencySymbol: '฿',
      logoText: 'CROCODILE'
    },
    categories: [],
    items: [],
    promotions: [],
    nextIds: { category: 1, item: 1, promotion: 1 }
  };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyDb(), null, 2));
  }
}

function load() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return emptyDb();
  }
}

function save(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function nextId(db, kind) {
  db.nextIds = db.nextIds || { category: 1, item: 1, promotion: 1 };
  const id = db.nextIds[kind] || 1;
  db.nextIds[kind] = id + 1;
  return id;
}

module.exports = { load, save, nextId, emptyDb, DATA_FILE };
