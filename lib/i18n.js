const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'ไอย' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'AR' }
];

const UI = {
  en: { food: 'Food Menu', drinks: 'Drinks Menu', wine: 'Wine Menu', promo: 'Promotion', back: 'Back', menu: 'Menu', from: 'From' },
  th: { food: 'เมนูอาหาร', drinks: 'เมนูเครื่องดื่ม', wine: 'เมนูไวน์', promo: 'โปรโมชน์', back: 'กลบ', menu: 'เมนู', from: 'เริ่มต้น' },
  ru: { food: 'Меню еды', drinks: 'Меню напитков', wine: 'Винная карта', promo: 'Акция', back: 'Назад', menu: 'Меню', from: 'От' },
  zh: { food: '食品菜单', drinks: '饮品菜单', wine: '酒单', promo: '促销', back: '返回', menu: '菜单', from: '起' },
  ar: { food: 'قائمة الطعام', drinks: 'قائمة المشروبات', wine: 'قائمة النبيذ', promo: 'عروض', back: 'رجوع', menu: 'القائمة', from: 'من' }
};

function t(obj, lang) {
  if (!obj) return '';
  return obj[lang] || obj.en || '';
}

function dirFor(lang) {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

function isValidLang(code) {
  return LANGS.some((l) => l.code === code);
}

module.exports = { LANGS, UI, t, dirFor, isValidLang };
