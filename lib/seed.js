// Runs on every deploy build (npm run seed) but is intentionally a no-op
// if data/db.json already exists, so admin edits survive redeploys.
//
// Seeds the real Crocodile Bar & Grill menu from lib/menu-seed-data.json —
// generated from the restaurant's own menu spreadsheet (MyMenu_Lunch_Crocodile),
// not invented. All categories and items are published from the start.
const fs = require('fs');
const path = require('path');
const { DATA_FILE, emptyDb, save } = require('./db');

if (fs.existsSync(DATA_FILE)) {
  console.log('[seed] data/db.json already exists — leaving it untouched.');
} else {
  const db = emptyDb();
  const seedDataPath = path.join(__dirname, 'menu-seed-data.json');
  const menuSeed = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

  db.categories = menuSeed.categories;
  db.items = menuSeed.items;
  db.nextIds = menuSeed.nextIds;

  save(db);
  console.log(
    `[seed] created data/db.json with ${menuSeed.categories.length} categories and ${menuSeed.items.length} items from the restaurant's menu spreadsheet.`
  );
}
