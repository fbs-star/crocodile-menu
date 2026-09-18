const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { parse: parseCsv } = require('csv-parse/sync');

const db = require('./lib/db');
const { LANGS, UI, t, dirFor, isValidLang } = require('./lib/i18n');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'crocodile2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'crocodile-bar-grill-dev-secret';
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 10);
      cb(null, `img_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

// ---- language middleware (public pages only) ----
app.use((req, res, next) => {
  let lang = req.query.lang;
  if (lang && isValidLang(lang)) {
    res.cookie('lang', lang, { maxAge: 1000 * 60 * 60 * 24 * 365 });
  } else {
    lang = req.cookies.lang && isValidLang(req.cookies.lang) ? req.cookies.lang : 'en';
  }
  req.lang = lang;
  res.locals.lang = lang;
  res.locals.LANGS = LANGS;
  res.locals.ui = UI[lang] || UI.en;
  res.locals.t = (obj) => t(obj, lang);
  res.locals.dir = dirFor(lang);
  next();
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

function sortedCats(allCats, group) {
  return allCats
    .filter((c) => c.group === group)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function itemsFor(allItems, categoryId) {
  return allItems
    .filter((i) => i.categoryId === categoryId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

// =========================== PUBLIC SITE ===========================

app.get('/', (req, res) => {
  const data = db.load();
  res.render('public/home', { settings: data.settings });
});

app.get('/menu/:group', (req, res) => {
  const group = req.params.group === 'drinks' ? 'drinks' : 'food';
  const data = db.load();
  const cats = sortedCats(data.categories, group).filter((c) => c.status === 'published');
  const selectedId = req.query.cat ? Number(req.query.cat) : cats.length ? cats[0].id : null;
  const selectedCat = cats.find((c) => c.id === selectedId) || null;
  const items = selectedCat
    ? itemsFor(data.items, selectedCat.id).filter((i) => i.status === 'published')
    : [];
  res.render('public/menu', {
    settings: data.settings,
    group,
    cats,
    selectedCat,
    items
  });
});

app.get('/promotions', (req, res) => {
  const data = db.load();
  const promos = (data.promotions || [])
    .filter((p) => p.status === 'published')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.render('public/promotions', { settings: data.settings, promos });
});

// =========================== ADMIN: AUTH ===========================

app.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin/categories');
  }
  res.render('admin/login', { error: 'Incorrect username or password.' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin', requireAdmin, (req, res) => res.redirect('/admin/categories'));

// =========================== ADMIN: CATEGORIES ===========================

app.get('/admin/categories', requireAdmin, (req, res) => {
  const data = db.load();
  const cats = [...data.categories].sort((a, b) => {
    if (a.group !== b.group) return a.group === 'food' ? -1 : 1;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
  const withCounts = cats.map((c) => ({
    ...c,
    itemCount: data.items.filter((i) => i.categoryId === c.id).length
  }));
  res.render('admin/categories/list', { cats: withCounts, active: 'categories' });
});

app.get('/admin/categories/new', requireAdmin, (req, res) => {
  res.render('admin/categories/form', { cat: null, active: 'categories' });
});

app.post('/admin/categories/new', requireAdmin, (req, res) => {
  const data = db.load();
  const id = db.nextId(data, 'category');
  const group = req.body.group === 'drinks' ? 'drinks' : 'food';
  const maxOrder = Math.max(0, ...data.categories.filter((c) => c.group === group).map((c) => c.sortOrder || 0));
  data.categories.push({
    id,
    group,
    name: {
      en: req.body.name_en || '',
      th: req.body.name_th || '',
      ru: req.body.name_ru || '',
      zh: req.body.name_zh || '',
      ar: req.body.name_ar || ''
    },
    status: req.body.status === 'published' ? 'published' : 'hidden',
    sortOrder: maxOrder + 1
  });
  db.save(data);
  res.redirect('/admin/categories');
});

app.get('/admin/categories/:id/edit', requireAdmin, (req, res) => {
  const data = db.load();
  const cat = data.categories.find((c) => c.id === Number(req.params.id));
  if (!cat) return res.redirect('/admin/categories');
  res.render('admin/categories/form', { cat, active: 'categories' });
});

app.post('/admin/categories/:id/edit', requireAdmin, (req, res) => {
  const data = db.load();
  const cat = data.categories.find((c) => c.id === Number(req.params.id));
  if (cat) {
    cat.group = req.body.group === 'drinks' ? 'drinks' : 'food';
    cat.name = {
      en: req.body.name_en || '',
      th: req.body.name_th || '',
      ru: req.body.name_ru || '',
      zh: req.body.name_zh || '',
      ar: req.body.name_ar || ''
    };
    cat.status = req.body.status === 'published' ? 'published' : 'hidden';
    db.save(data);
  }
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/delete', requireAdmin, (req, res) => {
  const data = db.load();
  const id = Number(req.params.id);
  data.categories = data.categories.filter((c) => c.id !== id);
  data.items = data.items.filter((i) => i.categoryId !== id);
  db.save(data);
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/toggle', requireAdmin, (req, res) => {
  const data = db.load();
  const cat = data.categories.find((c) => c.id === Number(req.params.id));
  if (cat) {
    cat.status = cat.status === 'published' ? 'hidden' : 'published';
    db.save(data);
  }
  res.redirect('/admin/categories');
});

app.post('/admin/categories/:id/move', requireAdmin, (req, res) => {
  const data = db.load();
  const id = Number(req.params.id);
  const cat = data.categories.find((c) => c.id === id);
  if (cat) {
    const siblings = sortedCats(data.categories, cat.group);
    const idx = siblings.findIndex((c) => c.id === id);
    const dir = req.body.dir === 'up' ? -1 : 1;
    const swapWith = siblings[idx + dir];
    if (swapWith) {
      const tmp = cat.sortOrder;
      cat.sortOrder = swapWith.sortOrder;
      swapWith.sortOrder = tmp;
      db.save(data);
    }
  }
  res.redirect('/admin/categories');
});

// =========================== ADMIN: MENU ITEMS ===========================

app.get('/admin/items', requireAdmin, (req, res) => {
  const data = db.load();
  const catFilter = req.query.category ? Number(req.query.category) : null;
  const items = data.items
    .filter((i) => !catFilter || i.categoryId === catFilter)
    .map((i) => ({ ...i, cat: data.categories.find((c) => c.id === i.categoryId) }));
  res.render('admin/items/list', {
    items,
    categories: data.categories,
    catFilter,
    active: 'items'
  });
});

app.get('/admin/items/new', requireAdmin, (req, res) => {
  const data = db.load();
  res.render('admin/items/form', { item: null, categories: data.categories, active: 'items' });
});

function readItemBody(req) {
  return {
    categoryId: Number(req.body.categoryId),
    name: {
      en: req.body.name_en || '',
      th: req.body.name_th || '',
      ru: req.body.name_ru || '',
      zh: req.body.name_zh || '',
      ar: req.body.name_ar || ''
    },
    desc: {
      en: req.body.desc_en || '',
      th: req.body.desc_th || '',
      ru: req.body.desc_ru || '',
      zh: req.body.desc_zh || '',
      ar: req.body.desc_ar || ''
    },
    price: req.body.price || '',
    tags: (req.body.tags || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    status: req.body.status === 'published' ? 'published' : 'hidden'
  };
}

app.post('/admin/items/new', requireAdmin, upload.single('imageFile'), (req, res) => {
  const data = db.load();
  const id = db.nextId(data, 'item');
  const body = readItemBody(req);
  const maxOrder = Math.max(0, ...data.items.filter((i) => i.categoryId === body.categoryId).map((i) => i.sortOrder || 0));
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || '';
  data.items.push({ id, ...body, imageUrl, sortOrder: maxOrder + 1 });
  db.save(data);
  res.redirect('/admin/items');
});

app.get('/admin/items/:id/edit', requireAdmin, (req, res) => {
  const data = db.load();
  const item = data.items.find((i) => i.id === Number(req.params.id));
  if (!item) return res.redirect('/admin/items');
  res.render('admin/items/form', { item, categories: data.categories, active: 'items' });
});

app.post('/admin/items/:id/edit', requireAdmin, upload.single('imageFile'), (req, res) => {
  const data = db.load();
  const item = data.items.find((i) => i.id === Number(req.params.id));
  if (item) {
    const body = readItemBody(req);
    Object.assign(item, body);
    if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;
    else if (req.body.imageUrl) item.imageUrl = req.body.imageUrl;
    db.save(data);
  }
  res.redirect('/admin/items');
});

app.post('/admin/items/:id/delete', requireAdmin, (req, res) => {
  const data = db.load();
  data.items = data.items.filter((i) => i.id !== Number(req.params.id));
  db.save(data);
  res.redirect('/admin/items');
});

app.post('/admin/items/:id/toggle', requireAdmin, (req, res) => {
  const data = db.load();
  const item = data.items.find((i) => i.id === Number(req.params.id));
  if (item) {
    item.status = item.status === 'published' ? 'hidden' : 'published';
    db.save(data);
  }
  res.redirect('/admin/items');
});

// =========================== ADMIN: PROMOTIONS ===========================

app.get('/admin/promotions', requireAdmin, (req, res) => {
  const data = db.load();
  const promos = [...data.promotions].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.render('admin/promotions/list', { promos, active: 'promotions' });
});

app.get('/admin/promotions/new', requireAdmin, (req, res) => {
  res.render('admin/promotions/form', { promo: null, active: 'promotions' });
});

function readPromoBody(req) {
  return {
    title: {
      en: req.body.title_en || '',
      th: req.body.title_th || '',
      ru: req.body.title_ru || '',
      zh: req.body.title_zh || '',
      ar: req.body.title_ar || ''
    },
    subtitle: {
      en: req.body.subtitle_en || '',
      th: req.body.subtitle_th || '',
      ru: req.body.subtitle_ru || '',
      zh: req.body.subtitle_zh || '',
      ar: req.body.subtitle_ar || ''
    },
    priceText: req.body.priceText || '',
    status: req.body.status === 'published' ? 'published' : 'hidden'
  };
}

app.post('/admin/promotions/new', requireAdmin, upload.single('imageFile'), (req, res) => {
  const data = db.load();
  const id = db.nextId(data, 'promotion');
  const body = readPromoBody(req);
  const maxOrder = Math.max(0, ...data.promotions.map((p) => p.sortOrder || 0));
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || '';
  data.promotions.push({ id, ...body, imageUrl, sortOrder: maxOrder + 1 });
  db.save(data);
  res.redirect('/admin/promotions');
});

app.get('/admin/promotions/:id/edit', requireAdmin, (req, res) => {
  const data = db.load();
  const promo = data.promotions.find((p) => p.id === Number(req.params.id));
  if (!promo) return res.redirect('/admin/promotions');
  res.render('admin/promotions/form', { promo, active: 'promotions' });
});

app.post('/admin/promotions/:id/edit', requireAdmin, upload.single('imageFile'), (req, res) => {
  const data = db.load();
  const promo = data.promotions.find((p) => p.id === Number(req.params.id));
  if (promo) {
    Object.assign(promo, readPromoBody(req));
    if (req.file) promo.imageUrl = `/uploads/${req.file.filename}`;
    else if (req.body.imageUrl) promo.imageUrl = req.body.imageUrl;
    db.save(data);
  }
  res.redirect('/admin/promotions');
});

app.post('/admin/promotions/:id/delete', requireAdmin, (req, res) => {
  const data = db.load();
  data.promotions = data.promotions.filter((p) => p.id !== Number(req.params.id));
  db.save(data);
  res.redirect('/admin/promotions');
});

app.post('/admin/promotions/:id/toggle', requireAdmin, (req, res) => {
  const data = db.load();
  const promo = data.promotions.find((p) => p.id === Number(req.params.id));
  if (promo) {
    promo.status = promo.status === 'published' ? 'hidden' : 'published';
    db.save(data);
  }
  res.redirect('/admin/promotions');
});

// =========================== ADMIN: HOME SCREEN ===========================

app.get('/admin/home', requireAdmin, (req, res) => {
  const data = db.load();
  res.render('admin/home', { settings: data.settings, active: 'home', saved: req.query.saved });
});

app.post('/admin/home', requireAdmin, upload.single('heroImageFile'), (req, res) => {
  const data = db.load();
  data.settings.restaurantName = req.body.restaurantName || data.settings.restaurantName;
  data.settings.parentProperty = req.body.parentProperty || '';
  data.settings.tagline = req.body.tagline || '';
  data.settings.currencySymbol = req.body.currencySymbol || data.settings.currencySymbol;
  data.settings.logoText = req.body.logoText || data.settings.logoText;
  if (req.file) data.settings.heroImage = `/uploads/${req.file.filename}`;
  else if (req.body.heroImageUrl) data.settings.heroImage = req.body.heroImageUrl;
  db.save(data);
  res.redirect('/admin/home?saved=1');
});

// =========================== ADMIN: IMPORT MENU (CSV) ===========================
// Expected columns: group,category_en,category_th,category_ru,category_zh,category_ar,
//                   item_en,item_th,item_ru,item_zh,item_ar,desc_en,desc_th,desc_ru,desc_zh,desc_ar,price,tags

app.get('/admin/import', requireAdmin, (req, res) => {
  res.render('admin/import', { active: 'import', result: null, error: null });
});

app.post('/admin/import', requireAdmin, upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.render('admin/import', { active: 'import', result: null, error: 'Please choose a CSV file.' });
  }
  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    const rows = parseCsv(content, { columns: true, skip_empty_lines: true, trim: true });
    const data = db.load();
    let createdCats = 0;
    let createdItems = 0;

    function findOrCreateCategory(group, names) {
      let cat = data.categories.find(
        (c) => c.group === group && (c.name.en || '').toLowerCase() === (names.en || '').toLowerCase() && names.en
      );
      if (!cat) {
        const id = db.nextId(data, 'category');
        const maxOrder = Math.max(0, ...data.categories.filter((c) => c.group === group).map((c) => c.sortOrder || 0));
        cat = { id, group, name: names, status: 'published', sortOrder: maxOrder + 1 };
        data.categories.push(cat);
        createdCats += 1;
      }
      return cat;
    }

    rows.forEach((row) => {
      const group = (row.group || 'food').toLowerCase() === 'drinks' ? 'drinks' : 'food';
      const catNames = {
        en: row.category_en || '',
        th: row.category_th || '',
        ru: row.category_ru || '',
        zh: row.category_zh || '',
        ar: row.category_ar || ''
      };
      if (!catNames.en) return;
      const cat = findOrCreateCategory(group, catNames);
      if (!row.item_en) return;
      const id = db.nextId(data, 'item');
      const maxOrder = Math.max(0, ...data.items.filter((i) => i.categoryId === cat.id).map((i) => i.sortOrder || 0));
      data.items.push({
        id,
        categoryId: cat.id,
        name: { en: row.item_en || '', th: row.item_th || '', ru: row.item_ru || '', zh: row.item_zh || '', ar: row.item_ar || '' },
        desc: { en: row.desc_en || '', th: row.desc_th || '', ru: row.desc_ru || '', zh: row.desc_zh || '', ar: row.desc_ar || '' },
        price: row.price || '',
        tags: (row.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
        imageUrl: '',
        status: 'published',
        sortOrder: maxOrder + 1
      });
      createdItems += 1;
    });

    db.save(data);
    fs.unlink(req.file.path, () => {});
    res.render('admin/import', {
      active: 'import',
      result: { rows: rows.length, createdCats, createdItems },
      error: null
    });
  } catch (e) {
    res.render('admin/import', { active: 'import', result: null, error: 'Could not read that CSV: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Crocodile Bar & Grill menu site running on port ${PORT}`);
});
