// Runs on every deploy build (npm run seed) but is intentionally a no-op if
// the Turso database already has categories in it, so admin edits made
// through the admin panel survive redeploys.
//
// Seeds the real Crocodile Bar & Grill menu from lib/menu-seed-data.json —
// generated from the restaurant's own menu spreadsheet (MyMenu_Lunch_Crocodile),
// not invented. All categories and items are published from the start.
// This only matters for a brand-new/empty Turso database (e.g. a fresh
// deployment); the live production database was migrated and seeded once,
// by hand, directly against Turso, and already has data in it.
const fs = require('fs');
const path = require('path');
const { emptyDb, load, save, init } = require('./db');

async function run() {
  await init();
  const data = await load();

  if (data.categories.length > 0) {
    console.log('[seed] Turso already has categories — leaving it untouched.');
    return;
  }

  const db = emptyDb();
  const seedDataPath = path.join(__dirname, 'menu-seed-data.json');
  const menuSeed = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

  db.categories = menuSeed.categories;
  db.items = menuSeed.items;
  db.nextIds = menuSeed.nextIds;

  await save(db);
  console.log(
    `[seed] seeded Turso with ${menuSeed.categories.length} categories and ${menuSeed.items.length} items from the restaurant's menu spreadsheet.`
  );
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
