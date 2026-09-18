// Runs on every deploy build (npm run seed) but is intentionally a no-op
// if data/db.json already exists, so admin edits survive redeploys.
const fs = require('fs');
const { DATA_FILE, emptyDb, save } = require('./db');

if (fs.existsSync(DATA_FILE)) {
  console.log('[seed] data/db.json already exists — leaving it untouched.');
} else {
  const db = emptyDb();

  // Structural category shells only — no invented dishes, prices, or
  // descriptions. Real content gets added later through the admin panel
  // or CSV import, once it exists.
  const foodCats = ['Starters', 'Salads', 'Flame Grill', 'Burgers & Sandwiches', 'Sides', 'Desserts'];
  const drinkCats = ['Beers', 'Cocktails', 'Mocktails', 'Soft Drinks', 'Spirits'];

  let order = 1;
  foodCats.forEach((name) => {
    db.categories.push({
      id: order,
      group: 'food',
      name: { en: name, th: '', ru: '', zh: '', ar: '' },
      status: 'hidden', // hidden until the admin fills it in with real items
      sortOrder: order
    });
    order += 1;
  });
  let dOrder = 1;
  drinkCats.forEach((name) => {
    db.categories.push({
      id: order,
      group: 'drinks',
      name: { en: name, th: '', ru: '', zh: '', ar: '' },
      status: 'hidden',
      sortOrder: dOrder
    });
    order += 1;
    dOrder += 1;
  });
  db.nextIds.category = order;

  save(db);
  console.log('[seed] created data/db.json with empty structural categories (no invented menu content).');
}
