const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'TH' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'AR' }
];

const UI = {
  en: { food: 'Food Menu', drinks: 'Drinks Menu', wine: 'Wine Menu', promo: 'Promotion', back: 'Back', menu: 'Menu', from: 'From', callStaff: 'Call Staff', callStaffSent: 'Staff notified', allergyNotice: 'Please inform our service team before placing your order\nif a person in your party has a food allergy or any dietary requirements.' },
  th: { food: 'เมนูอาหาร', drinks: 'เมนูเครื่องดื่ม', wine: 'เมนูไวน์', promo: 'โปรโมชน์', back: 'กลบ', menu: 'เมนู', from: 'เริ่มต้น', callStaff: 'เรียกพนักงาน', callStaffSent: 'แจ้งพนักงานแล้ว', allergyNotice: 'กรุณาแจ้งพนักงานบริการก่อนสั่งอาหาร\nหากมีผู้ร่วมโต๊ะแพ้อาหารหรือมีข้อกำหนดด้านอาหารเป็นพิเศษ' },
  ru: { food: 'Меню еды', drinks: 'Меню напитков', wine: 'Винная карта', promo: 'Акция', back: 'Назад', menu: 'Меню', from: 'От', callStaff: 'Позвать официанта', callStaffSent: 'Официант уведомлён', allergyNotice: 'Пожалуйста, сообщите нашему персоналу перед заказом,\nесли у кого-то из вашей компании пищевая аллергия или особые диетические потребности.' },
  zh: { food: '食品菜单', drinks: '饮品菜单', wine: '酒单', promo: '促销', back: '返回', menu: '菜单', from: '起', callStaff: '呼叫服务员', callStaffSent: '已通知服务员', allergyNotice: '如您的同伴有食物过敏或特殊饮食需求，\n请在点餐前告知我们的服务人员。' },
  ar: { food: 'قائمة الطعام', drinks: 'قائمة المشروبات', wine: 'قائمة النبيذ', promo: 'عروض', back: 'رجوع', menu: 'القائمة', from: 'من', callStaff: 'استدعاء الموظف', callStaffSent: 'تم إبلاغ الموظف', allergyNotice: 'يرجى إبلاغ فريق الخدمة قبل تقديم الطلب\nإذا كان أحد أفراد مجموعتكم يعاني من حساسية غذائية أو له متطلبات غذائية خاصة.' }
};

const UNIT_LABELS = {
  bottle: { en: 'Bottle', th: 'ขวด', ru: 'Бутылка', zh: '瓶', ar: 'زجاجة' },
  glass: { en: 'Glass', th: 'แก้ว', ru: 'Бокал', zh: '杯', ar: 'كأس' }
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

module.exports = { LANGS, UI, UNIT_LABELS, t, dirFor, isValidLang };
