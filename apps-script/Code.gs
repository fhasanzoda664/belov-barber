/**
 * Белов · Барбер — серверная часть на Google Apps Script.
 * Скрипт привязан к Google Таблице (Расширения → Apps Script).
 *
 * Секреты хранятся в «Свойствах скрипта» (Настройки проекта → Script Properties), а не в коде:
 *   BOT_TOKEN     — токен бота от @BotFather
 *   ADMIN_ID      — Telegram ID Белова (число)
 *   MINI_APP_URL  — адрес приложения на GitHub Pages (для кнопки «Открыть админку»)
 */

const TZ = 'Asia/Dushanbe';
const CURRENCY = 'смн';
const DAYS_AHEAD = 30;
const SH = { B: 'Записи', S: 'Услуги', E: 'Добавки', C: 'Настройки' };
const B_COLS = ['id','date','time','dur','serviceId','serviceName','extras','total','name','phone','comment','tgId','tgUsername','status','createdAt','reminded'];
const S_COLS = ['id','cat','name','desc','price','dur','icon','hidden'];
const E_COLS = ['id','name','price','dur','hidden'];
const DEF_SETTINGS = { workStart: '09:00', workEnd: '20:00', breakStart: '13:00', breakEnd: '14:00', daysOff: [0], closedDates: [], step: 30, leadMin: 30 };
const WDF = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

/* ==================== вход ==================== */
function doGet() { return out({ ok: true, data: 'Belov barber API' }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const user = verifyInitData(req.initData);
    if (!user) return out({ ok: false, error: 'Откройте приложение через Telegram' });
    const isAdmin = String(user.id) === String(prop('ADMIN_ID'));
    const a = ACTIONS[req.action];
    if (!a) return out({ ok: false, error: 'Неизвестное действие' });
    if (a.admin && !isAdmin) return out({ ok: false, error: 'Нет доступа' });
    return out({ ok: true, data: a.run(req.payload || {}, user, isAdmin) });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }

/* Проверка подписи Telegram (initData), чтобы никто не мог подделать пользователя */
function verifyInitData(initData) {
  if (!initData) return null;
  const token = prop('BOT_TOKEN'); if (!token) throw new Error('На сервере не задан BOT_TOKEN');
  const map = {};
  initData.split('&').forEach(p => {
    const i = p.indexOf('='); if (i < 0) return;
    map[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
  });
  const hash = map.hash; if (!hash) return null; delete map.hash;
  const dcs = Object.keys(map).sort().map(k => k + '=' + map[k]).join('\n');
  const secret = Utilities.computeHmacSha256Signature(Utilities.newBlob(token).getBytes(), Utilities.newBlob('WebAppData').getBytes());
  const sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(dcs).getBytes(), secret);
  const hex = sig.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  if (hex !== hash) return null;
  if (Date.now() / 1000 - Number(map.auth_date) > 86400) return null;
  return JSON.parse(map.user || 'null');
}

/* ==================== действия ==================== */
const ACTIONS = {
  getPublic: { run: (p, u, isAdmin) => ({
    services: getServices().filter(s => !s.hidden),
    extras: getExtras().filter(e => !e.hidden),
    settings: getSettings(),
    busy: busyList(),
    isAdmin
  }) },

  book: { run: (p, u) => {
    const lock = LockService.getScriptLock(); lock.waitLock(15000);
    try {
      const s = getServices().find(x => x.id === p.serviceId && !x.hidden);
      if (!s) throw new Error('Услуга не найдена');
      let price = s.price, dur = s.dur; const exn = [];
      const extras = getExtras();
      (p.extras || []).forEach(id => { const e = extras.find(x => x.id === id && !x.hidden); if (e) { price += e.price; dur += e.dur; exn.push(e.name); } });
      const name = String(p.name || '').trim().slice(0, 60), phone = String(p.phone || '').trim().slice(0, 30);
      if (name.length < 2) throw new Error('Введите имя');
      if (phone.replace(/\D/g, '').length < 9) throw new Error('Введите номер телефона');
      const now = nowLocal();
      const maxDay = keyPlus(now.key, DAYS_AHEAD);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || p.date < now.key || p.date > maxDay) throw new Error('Неверная дата');
      const slot = computeSlots(p.date, dur, getSettings(), busyList(), now).slots.find(x => x.time === p.time);
      if (!slot || !slot.free) throw new Error('Это время уже занято, выберите другое');
      const b = { id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), date: p.date, time: p.time, dur, serviceId: s.id, serviceName: s.name,
        extras: exn.join(', '), total: price, name, phone, comment: String(p.comment || '').slice(0, 300), tgId: u.id, tgUsername: u.username || '',
        status: 'new', createdAt: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), reminded: '' };
      sheet(SH.B, B_COLS).appendRow(B_COLS.map(c => String(b[c] == null ? '' : b[c])));
      notifyAdminNew(b);
      return b;
    } finally { lock.releaseLock(); }
  } },

  myBookings: { run: (p, u) => {
    const t = nowLocal().key;
    return getBookings().filter(b => String(b.tgId) === String(u.id) && b.date >= t && b.status !== 'cancelled').map(pub);
  } },

  cancelMine: { run: (p, u) => {
    const b = getBookings().find(x => x.id === p.id && String(x.tgId) === String(u.id));
    if (!b) throw new Error('Запись не найдена');
    if (b.status !== 'new' && b.status !== 'confirmed') throw new Error('Эту запись уже нельзя отменить');
    setCell(b._row, 'status', 'cancelled');
    tgSend(prop('ADMIN_ID'), '❌ <b>Клиент отменил запись</b>\n' + bookingText(b));
    return true;
  } },

  adminData: { admin: true, run: () => {
    const from = keyPlus(nowLocal().key, -60);
    return { bookings: getBookings().filter(b => b.date >= from).map(strip), services: getServices(), extras: getExtras(), settings: getSettings() };
  } },

  setStatus: { admin: true, run: (p) => {
    const ok = ['new','confirmed','done','noshow','cancelled'];
    if (ok.indexOf(p.status) < 0) throw new Error('Неверный статус');
    const b = getBookings().find(x => x.id === p.id); if (!b) throw new Error('Запись не найдена');
    setCell(b._row, 'status', p.status);
    if (p.status === 'confirmed' && b.status === 'new') tgSend(b.tgId, '✅ <b>Мастер подтвердил вашу запись</b>\n' + bookingText(b, true));
    if (p.status === 'cancelled') tgSend(b.tgId, '❌ <b>К сожалению, запись отменена мастером</b>\n' + bookingText(b, true) + '\n\nВыберите другое время в приложении.');
    return true;
  } },

  saveServices: { admin: true, run: (p) => {
    writeTable(SH.S, S_COLS, (p.services || []).map(s => Object.assign({}, s, { hidden: s.hidden ? '1' : '' })));
    writeTable(SH.E, E_COLS, (p.extras || []).map(e => Object.assign({}, e, { hidden: e.hidden ? '1' : '' })));
    return true;
  } },

  saveSettings: { admin: true, run: (p) => {
    const s = p.settings || {};
    const rows = [['key','value'],
      ['workStart', s.workStart], ['workEnd', s.workEnd], ['breakStart', s.breakStart || ''], ['breakEnd', s.breakEnd || ''],
      ['daysOff', (s.daysOff || []).join(',')], ['closedDates', (s.closedDates || []).join(',')],
      ['step', s.step || 30], ['leadMin', s.leadMin == null ? 30 : s.leadMin]];
    const sh = sheet(SH.C, ['key','value']); sh.clearContents();
    sh.getRange(1, 1, rows.length, 2).setValues(rows.map(r => r.map(String)));
    return true;
  } }
};

/* ==================== данные ==================== */
function sheet(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange('A:Z').setNumberFormat('@'); // всё как текст, чтобы Таблица не превращала «09:00» в дату
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function norm(v) {
  if (v instanceof Date) return v.getFullYear() < 1901 ? Utilities.formatDate(v, TZ, 'HH:mm') : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}
function readTable(name, cols) {
  const v = sheet(name, cols).getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === '' || v[i][0] === null) continue;
    const o = { _row: i + 1 }; cols.forEach((c, j) => { o[c] = norm(v[i][j]); }); out.push(o);
  }
  return out;
}
function writeTable(name, cols, rows) {
  const sh = sheet(name, cols); sh.clearContents();
  const data = [cols].concat(rows.map(r => cols.map(c => String(r[c] == null ? '' : r[c]))));
  sh.getRange(1, 1, data.length, cols.length).setValues(data);
}
function setCell(row, col, val) { sheet(SH.B, B_COLS).getRange(row, B_COLS.indexOf(col) + 1).setValue(String(val)); }
const isTrue = v => v === '1' || String(v).toLowerCase() === 'true' || v === 'да';
function getServices() { return readTable(SH.S, S_COLS).map(s => ({ id: s.id, cat: s.cat || 'Другое', name: s.name, desc: s.desc, price: Number(s.price) || 0, dur: Number(s.dur) || 30, icon: s.icon || 'scissors', hidden: isTrue(s.hidden) })); }
function getExtras() { return readTable(SH.E, E_COLS).map(e => ({ id: e.id, name: e.name, price: Number(e.price) || 0, dur: Number(e.dur) || 0, hidden: isTrue(e.hidden) })); }
function getBookings() { return readTable(SH.B, B_COLS).map(b => Object.assign(b, { dur: Number(b.dur) || 0, total: Number(b.total) || 0 })); }
function getSettings() {
  const s = JSON.parse(JSON.stringify(DEF_SETTINGS));
  sheet(SH.C, ['key','value']).getDataRange().getValues().slice(1).forEach(r => {
    const k = String(r[0]), v = norm(r[1]); if (!k) return;
    if (k === 'daysOff') s.daysOff = v.split(',').filter(x => x !== '').map(Number);
    else if (k === 'closedDates') s.closedDates = v.split(',').map(x => x.trim()).filter(Boolean);
    else if (k === 'step' || k === 'leadMin') s[k] = Number(v);
    else s[k] = v;
  });
  return s;
}
function busyList() {
  const t = nowLocal().key;
  return getBookings().filter(b => b.status !== 'cancelled' && b.date >= t).map(b => ({ date: b.date, time: b.time, dur: b.dur }));
}
function pub(b) { return { id: b.id, date: b.date, time: b.time, dur: b.dur, serviceName: b.serviceName, extras: b.extras, total: b.total, status: b.status }; }
function strip(b) { const o = Object.assign({}, b); delete o._row; return o; }

/* ==================== время ==================== */
function nowLocal() {
  const d = new Date();
  return { key: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), min: Number(Utilities.formatDate(d, TZ, 'H')) * 60 + Number(Utilities.formatDate(d, TZ, 'm')) };
}
function keyPlus(key, n) { const p = key.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); }
function weekday(key) { const p = key.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
function toMin(t) { const p = String(t).split(':').map(Number); return p[0] * 60 + p[1]; }
function fromMin(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
function fmtDate(key) { const p = key.split('-').map(Number); return p[2] + ' ' + MON[p[1] - 1] + ', ' + WDF[weekday(key)]; }

// Та же логика, что в app.js
function computeSlots(dk, dur, st, busy, now) {
  if ((st.daysOff || []).indexOf(weekday(dk)) >= 0 || (st.closedDates || []).indexOf(dk) >= 0) return { off: true, slots: [] };
  const s = toMin(st.workStart), e = toMin(st.workEnd);
  const bs = st.breakStart ? toMin(st.breakStart) : null, be = st.breakEnd ? toMin(st.breakEnd) : null;
  const step = Number(st.step) || 30;
  const nowM = now.min + (Number(st.leadMin) || 0);
  const taken = busy.filter(b => b.date === dk).map(b => [toMin(b.time), toMin(b.time) + Number(b.dur)]);
  const slots = [];
  for (let t = s; t + dur <= e; t += step) {
    if (bs != null && be != null && t < be && t + dur > bs) continue;
    if (dk === now.key && t < nowM) continue;
    slots.push({ time: fromMin(t), free: !taken.some(r => t < r[1] && t + dur > r[0]) });
  }
  return { off: false, slots: slots };
}

/* ==================== Telegram ==================== */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function bookingText(b, forClient) {
  let t = '📅 ' + fmtDate(b.date) + ' · <b>' + b.time + '</b>\n✂️ ' + esc(b.serviceName) + (b.extras ? ' + ' + esc(b.extras) : '') +
    '\n💰 ' + b.total + ' ' + CURRENCY + ' · ⏱ ' + b.dur + ' мин';
  if (!forClient) {
    t += '\n👤 ' + esc(b.name) + ' · ' + esc(b.phone);
    if (b.tgUsername) t += ' · @' + esc(b.tgUsername);
    if (b.comment) t += '\n💬 ' + esc(b.comment);
  }
  return t;
}
function notifyAdminNew(b) {
  const url = prop('MINI_APP_URL');
  const markup = url ? { inline_keyboard: [[{ text: 'Открыть админку', web_app: { url: url.replace(/\/?$/, '/') + '?admin=1' } }]] } : null;
  tgSend(prop('ADMIN_ID'), '🆕 <b>Новая запись</b>\n' + bookingText(b), markup);
}
function tgSend(chatId, text, markup) {
  const token = prop('BOT_TOKEN'); if (!token || !chatId) return false;
  const body = { chat_id: String(chatId), text: text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (markup) body.reply_markup = markup;
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage',
    { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  return r.getResponseCode() === 200;
}

/* ==================== автоматические сообщения ==================== */
// Каждый вечер в 20:00 — Белову список записей на завтра
function dailyDigest() {
  const tm = keyPlus(nowLocal().key, 1);
  const list = getBookings().filter(b => b.date === tm && (b.status === 'new' || b.status === 'confirmed')).sort((a, b) => a.time.localeCompare(b.time));
  const head = '🗓 <b>Завтра, ' + fmtDate(tm) + '</b>\n';
  if (!list.length) { tgSend(prop('ADMIN_ID'), head + 'Записей нет.'); return; }
  const sum = list.reduce((a, b) => a + b.total, 0);
  tgSend(prop('ADMIN_ID'), head + list.map(b => '<b>' + b.time + '</b> — ' + esc(b.name) + ', ' + esc(b.serviceName) + (b.status === 'new' ? ' (не подтв.)' : '')).join('\n') +
    '\n\nВсего: ' + list.length + ' · ' + sum + ' ' + CURRENCY);
}
// Каждые 30 минут — напоминание клиентам примерно за 2 часа
function remindClients() {
  const now = nowLocal();
  getBookings().forEach(b => {
    if (b.date !== now.key || b.reminded || (b.status !== 'new' && b.status !== 'confirmed')) return;
    const diff = toMin(b.time) - now.min;
    if (diff > 60 && diff <= 150) {
      tgSend(b.tgId, '⏰ <b>Напоминание</b>\nСегодня в <b>' + b.time + '</b> вы записаны: ' + esc(b.serviceName) + '.\nЕсли не получается прийти — отмените запись в приложении.');
      setCell(b._row, 'reminded', '1');
    }
  });
}

/* ==================== первичная настройка (запустить один раз вручную) ==================== */
function setup() {
  if (!readTable(SH.S, S_COLS).length) writeTable(SH.S, S_COLS, [
    { id: 's1', cat: 'Стрижки', name: 'Мужская стрижка', desc: 'Консультация, ножницы и машинка, мытьё и укладка', price: 50, dur: 45, icon: 'scissors' },
    { id: 's2', cat: 'Стрижки', name: 'Фейд', desc: 'Плавный переход от кожи, чёткий контур', price: 60, dur: 50, icon: 'fade' },
    { id: 's3', cat: 'Стрижки', name: 'Стрижка машинкой', desc: 'Одна или две насадки, быстро и аккуратно', price: 30, dur: 30, icon: 'clipper' },
    { id: 's4', cat: 'Стрижки', name: 'Удлинённая стрижка', desc: 'Работа с длиной, текстура, укладка', price: 70, dur: 60, icon: 'scissors' },
    { id: 's5', cat: 'Борода', name: 'Оформление бороды', desc: 'Форма, контур, уход маслом', price: 35, dur: 30, icon: 'beard' },
    { id: 's6', cat: 'Борода', name: 'Королевское бритьё', desc: 'Опасная бритва, горячее полотенце, бальзам', price: 50, dur: 40, icon: 'razor' },
    { id: 's7', cat: 'Комплекс', name: 'Стрижка + борода', desc: 'Полный образ за один визит', price: 75, dur: 75, icon: 'combo' },
    { id: 's8', cat: 'Комплекс', name: 'Отец + сын', desc: 'Две стрижки подряд: для папы и сына', price: 80, dur: 80, icon: 'family' },
    { id: 's9', cat: 'Детям', name: 'Детская стрижка', desc: 'До 12 лет. Терпеливо и без слёз', price: 35, dur: 30, icon: 'kid' }
  ]);
  if (!readTable(SH.E, E_COLS).length) writeTable(SH.E, E_COLS, [
    { id: 'e1', name: 'Мытьё головы', price: 10, dur: 10 }, { id: 'e2', name: 'Укладка', price: 15, dur: 10 },
    { id: 'e3', name: 'Камуфляж седины', price: 40, dur: 20 }, { id: 'e4', name: 'Горячее полотенце', price: 10, dur: 5 }
  ]);
  ACTIONS.saveSettings.run({ settings: getSettings() });
  sheet(SH.B, B_COLS);
  // триггеры
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(20).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('remindClients').timeBased().everyMinutes(30).create();
  Logger.log('Готово. Листы созданы, триггеры установлены.');
}
// Проверка: отправляет тестовое сообщение Белову
function testMessage() { Logger.log(tgSend(prop('ADMIN_ID'), '✅ Связь с ботом работает.') ? 'Отправлено' : 'Ошибка: проверьте BOT_TOKEN и ADMIN_ID, и что Белов нажал /start в боте'); }
