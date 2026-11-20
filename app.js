(() => {
'use strict';
const CFG = window.APP_CONFIG;
const tg = window.Telegram && window.Telegram.WebApp;
const inTG = !!(tg && tg.initData);
const DEMO = !CFG.API_URL;
const B = CFG.barber;

/* =================== утилиты =================== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const fromMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => dkey(new Date());
const money = n => Number(n).toLocaleString('ru-RU') + ' ' + CFG.currency;
const WD = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const WDF = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const fmtDate = k => { const d = parseKey(k); return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + WDF[d.getDay()]; };
const relDay = k => { const t = todayKey(); if (k === t) return 'Сегодня'; if (k === dkey(addDays(new Date(), 1))) return 'Завтра'; if (k === dkey(addDays(new Date(), -1))) return 'Вчера'; return fmtDate(k); };
const durText = m => m >= 60 ? Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : '') : m + ' мин';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));

function haptic(type) {
  if (!inTG || !tg.HapticFeedback) return;
  try {
    if (type === 'select') tg.HapticFeedback.selectionChanged();
    else if (type === 'success' || type === 'error' || type === 'warning') tg.HapticFeedback.notificationOccurred(type);
    else tg.HapticFeedback.impactOccurred(type || 'light');
  } catch (e) {}
}
function toast(msg, kind) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (kind || '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 2600);
}
function ask(msg) {
  return new Promise(r => {
    if (inTG && tg.showConfirm) tg.showConfirm(msg, ok => r(!!ok)); else r(window.confirm(msg));
  });
}
function openLink(url) { if (inTG) tg.openLink(url); else window.open(url, '_blank'); }
function openTg(url) { if (inTG) tg.openTelegramLink(url); else window.open(url, '_blank'); }

const cloudOK = () => inTG && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9');
const store = {
  get(k) {
    return new Promise(r => {
      if (cloudOK()) tg.CloudStorage.getItem(k, (e, v) => r(e ? null : v));
      else { try { r(localStorage.getItem('bb_' + k)); } catch (e) { r(null); } }
    });
  },
  set(k, v) {
    if (cloudOK()) tg.CloudStorage.setItem(k, v, () => {});
    else { try { localStorage.setItem('bb_' + k, v); } catch (e) {} }
  }
};

/* =================== иконки =================== */
const P = {
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  clipper: '<rect x="7" y="7" width="10" height="15" rx="3"/><path d="M8 7V3h8v4M7 3h10M10 12h4"/>',
  fade: '<path d="M4 20h16M4 15h16M6 10h12M9 5h6"/>',
  beard: '<path d="M5 8c0 7 3 12 7 12s7-5 7-12"/><path d="M9 13c1 .7 2 1 3 1s2-.3 3-1M8 9h.01M16 9h.01"/>',
  razor: '<path d="M3 21l7-7M10 14l9.5-9.5a2.1 2.1 0 0 0-3-3L7 11z"/>',
  combo: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  family: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  kid: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'
};
const ic = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24">${P[n] || P.scissors}</svg>`;
const starFill = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';

/* =================== расчёт свободного времени =================== */
// Та же логика есть в apps-script/Code.gs, чтобы сервер проверял запись.
function computeSlots(dk, dur, st, busy, now) {
  now = now || new Date();
  const d = parseKey(dk);
  if ((st.daysOff || []).indexOf(d.getDay()) >= 0 || (st.closedDates || []).indexOf(dk) >= 0) return { off: true, slots: [] };
  const s = toMin(st.workStart), e = toMin(st.workEnd);
  const bs = st.breakStart ? toMin(st.breakStart) : null, be = st.breakEnd ? toMin(st.breakEnd) : null;
  const step = Number(st.step) || 30;
  const isToday = dk === dkey(now);
  const nowM = now.getHours() * 60 + now.getMinutes() + (Number(st.leadMin) || 0);
  const taken = busy.filter(b => b.date === dk).map(b => [toMin(b.time), toMin(b.time) + Number(b.dur)]);
  const slots = [];
  for (let t = s; t + dur <= e; t += step) {
    if (bs != null && be != null && t < be && t + dur > bs) continue;
    if (isToday && t < nowM) continue;
    slots.push({ time: fromMin(t), free: !taken.some(([a, b]) => t < b && t + dur > a) });
  }
  return { off: false, slots };
}

/* =================== ДЕМО-сервер (работает без интернета) =================== */
const DEMO_USER = { id: 1001, first_name: 'Гость' };
const DEF = {
  services: [
    { id: 's1', cat: 'Стрижки', name: 'Мужская стрижка', desc: 'Консультация, ножницы и машинка, мытьё и укладка', price: 50, dur: 45, icon: 'scissors' },
    { id: 's2', cat: 'Стрижки', name: 'Фейд', desc: 'Плавный переход от кожи, чёткий контур', price: 60, dur: 50, icon: 'fade' },
    { id: 's3', cat: 'Стрижки', name: 'Стрижка машинкой', desc: 'Одна или две насадки, быстро и аккуратно', price: 30, dur: 30, icon: 'clipper' },
    { id: 's4', cat: 'Стрижки', name: 'Удлинённая стрижка', desc: 'Работа с длиной, текстура, укладка', price: 70, dur: 60, icon: 'scissors' },
    { id: 's5', cat: 'Борода', name: 'Оформление бороды', desc: 'Форма, контур, уход маслом', price: 35, dur: 30, icon: 'beard' },
    { id: 's6', cat: 'Борода', name: 'Королевское бритьё', desc: 'Опасная бритва, горячее полотенце, бальзам', price: 50, dur: 40, icon: 'razor' },
    { id: 's7', cat: 'Комплекс', name: 'Стрижка + борода', desc: 'Полный образ за один визит', price: 75, dur: 75, icon: 'combo' },
    { id: 's8', cat: 'Комплекс', name: 'Отец + сын', desc: 'Две стрижки подряд: для папы и сына', price: 80, dur: 80, icon: 'family' },
    { id: 's9', cat: 'Детям', name: 'Детская стрижка', desc: 'До 12 лет. Терпеливо и без слёз', price: 35, dur: 30, icon: 'kid' }
  ],
  extras: [
    { id: 'e1', name: 'Мытьё головы', price: 10, dur: 10 },
    { id: 'e2', name: 'Укладка', price: 15, dur: 10 },
    { id: 'e3', name: 'Камуфляж седины', price: 40, dur: 20 },
    { id: 'e4', name: 'Горячее полотенце', price: 10, dur: 5 }
  ],
  settings: { workStart: '09:00', workEnd: '20:00', breakStart: '13:00', breakEnd: '14:00', daysOff: [0], closedDates: [], step: 30, leadMin: 30 }
};

const demo = (() => {
  const KEY = 'bb_demo_db_v1';
  let db;
  function seed() {
    let x = 11; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    const names = ['Фаррух','Сухроб','Алишер','Дилшод','Бехруз','Комрон','Шахзод','Рустам','Умед','Джамшед','Исмоил','Фирдавс','Манучехр','Амир'];
    const n = k => { let s = ''; for (let i = 0; i < k; i++) s += Math.floor(rnd() * 10); return s; };
    const bookings = [];
    const add = (dk, time, sid, status, ex, tgId) => {
      const s = DEF.services.find(z => z.id === sid);
      let price = s.price, dur = s.dur; const exn = [];
      (ex || []).forEach(id => { const e = DEF.extras.find(z => z.id === id); price += e.price; dur += e.dur; exn.push(e.name); });
      bookings.push({ id: 'b' + (bookings.length + 1), date: dk, time, dur, serviceId: sid, serviceName: s.name, extras: exn.join(', '),
        total: price, name: names[Math.floor(rnd() * names.length)], phone: '+992 9' + n(1) + ' ' + n(3) + ' ' + n(2) + ' ' + n(2),
        comment: '', tgId: tgId || 2000 + bookings.length, tgUsername: '', status, createdAt: '' });
    };
    const times = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00'];
    const sids = ['s1','s1','s1','s2','s2','s3','s5','s7','s7','s9','s6','s4'];
    for (let i = 30; i >= 1; i--) {
      const d = addDays(new Date(), -i); if (d.getDay() === 0) continue;
      const cnt = 3 + Math.floor(rnd() * 5); const pool = times.slice();
      for (let j = 0; j < cnt; j++) {
        const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        add(dkey(d), t, sids[Math.floor(rnd() * sids.length)], rnd() < 0.9 ? 'done' : 'noshow', rnd() < 0.3 ? ['e2'] : []);
      }
    }
    const fut = [[0, ['10:00','s1','confirmed'], ['11:30','s7','confirmed'], ['16:00','s2','new'], ['18:30','s5','new']],
                 [1, ['09:00','s3','confirmed'], ['12:00','s7','new'], ['15:00','s1','new']],
                 [2, ['10:30','s2','new'], ['17:00','s8','confirmed']], [4, ['14:00','s1','new']]];
    fut.forEach(([off, ...rows]) => { const d = addDays(new Date(), off); if (d.getDay() === 0) return; rows.forEach(r => add(dkey(d), r[0], r[1], r[2], r[1] === 's1' ? ['e1'] : [])); });
    bookings.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return { services: clone(DEF.services), extras: clone(DEF.extras), settings: clone(DEF.settings), bookings };
  }
  function load() { try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} if (!db) { db = seed(); save(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  const busy = () => db.bookings.filter(b => b.status !== 'cancelled' && b.date >= todayKey()).map(b => ({ date: b.date, time: b.time, dur: b.dur }));
  load();
  return {
    getPublic: () => ({ services: db.services.filter(s => !s.hidden), extras: db.extras.filter(e => !e.hidden), settings: db.settings, busy: busy(), isAdmin: true }),
    book(p) {
      const s = db.services.find(z => z.id === p.serviceId && !z.hidden); if (!s) throw new Error('Услуга не найдена');
      let price = s.price, dur = s.dur; const exn = [];
      (p.extras || []).forEach(id => { const e = db.extras.find(z => z.id === id); if (e) { price += e.price; dur += e.dur; exn.push(e.name); } });
      const sl = computeSlots(p.date, dur, db.settings, busy()).slots.find(x => x.time === p.time);
      if (!sl || !sl.free) throw new Error('Это время уже занято, выберите другое');
      const b = { id: 'b' + Date.now(), date: p.date, time: p.time, dur, serviceId: s.id, serviceName: s.name, extras: exn.join(', '), total: price,
        name: p.name, phone: p.phone, comment: p.comment || '', tgId: DEMO_USER.id, tgUsername: '', status: 'new', createdAt: new Date().toISOString() };
      db.bookings.push(b); save(); return b;
    },
    myBookings: () => db.bookings.filter(b => b.tgId === DEMO_USER.id && b.date >= todayKey() && b.status !== 'cancelled'),
    cancelMine(p) { const b = db.bookings.find(z => z.id === p.id && z.tgId === DEMO_USER.id); if (b) { b.status = 'cancelled'; save(); } return true; },
    adminData: () => clone({ bookings: db.bookings, services: db.services, extras: db.extras, settings: db.settings }),
    setStatus(p) { const b = db.bookings.find(z => z.id === p.id); if (b) { b.status = p.status; save(); } return true; },
    saveServices(p) { db.services = p.services; db.extras = p.extras; save(); return true; },
    saveSettings(p) { db.settings = p.settings; save(); return true; },
    reset() { localStorage.removeItem(KEY); load(); return true; }
  };
})();

async function call(action, payload) {
  if (DEMO) { await sleep(220); return clone(demo[action](payload || {})); }
  if (!inTG) throw new Error('Откройте приложение через Telegram');
  const res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload: payload || {}, initData: tg.initData }) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Ошибка сервера');
  return j.data;
}

/* =================== состояние =================== */
const S = {
  view: 'home', step: 1, cat: null, serviceId: null, extras: [], date: null, time: null,
  name: '', phone: '', comment: '', my: [], busy: false, last: null, error: null,
  admin: { tab: 'bookings', range: 'today', data: null, es: null, ev: null, newClosed: '' }
};
let DATA = null;
const svc = id => DATA && DATA.services.find(s => s.id === id);
const cats = () => { const c = []; DATA.services.forEach(s => { if (c.indexOf(s.cat) < 0) c.push(s.cat); }); return c; };
function total() {
  const s = svc(S.serviceId); let price = s ? Number(s.price) : 0, dur = s ? Number(s.dur) : 0; const names = [];
  S.extras.forEach(id => { const e = DATA.extras.find(x => x.id === id); if (e) { price += Number(e.price); dur += Number(e.dur); names.push(e.name); } });
  return { price, dur, names };
}
function days() { const out = []; for (let i = 0; i < (CFG.daysAhead || 14); i++) out.push(dkey(addDays(new Date(), i))); return out; }
function nextFree(dur) {
  for (const k of days()) { const r = computeSlots(k, dur, DATA.settings, DATA.busy); const f = r.slots.find(s => s.free); if (f) return { date: k, time: f.time }; }
  return null;
}
function openState() {
  const st = DATA.settings, now = new Date(), k = todayKey(), m = now.getHours() * 60 + now.getMinutes();
  const off = st.daysOff.indexOf(now.getDay()) >= 0 || st.closedDates.indexOf(k) >= 0;
  if (!off && m >= toMin(st.workStart) && m < toMin(st.workEnd)) {
    if (st.breakStart && m >= toMin(st.breakStart) && m < toMin(st.breakEnd)) return { open: false, text: 'Перерыв до ' + st.breakEnd };
    return { open: true, text: 'Открыто до ' + st.workEnd };
  }
  return { open: false, text: 'Сейчас закрыто' };
}

/* =================== отрисовка =================== */
function render() {
  const keep = {}; document.querySelectorAll('[data-keep]').forEach(el => { keep[el.dataset.keep] = el.scrollLeft; });
  const app = $('#app');
  if (S.error) app.innerHTML = errorView();
  else if (!DATA) app.innerHTML = skeleton();
  else app.innerHTML = '<div class="view">' + VIEWS[S.view]() + '</div>';
  document.querySelectorAll('[data-keep]').forEach(el => { if (keep[el.dataset.keep] != null) el.scrollLeft = keep[el.dataset.keep]; });
  renderBar();
  if (inTG) { if (S.view === 'home') tg.BackButton.hide(); else tg.BackButton.show(); }
}
function rerender() { // без анимации появления
  const keep = {}; document.querySelectorAll('[data-keep]').forEach(el => { keep[el.dataset.keep] = el.scrollLeft; });
  $('#app').innerHTML = '<div>' + VIEWS[S.view]() + '</div>';
  document.querySelectorAll('[data-keep]').forEach(el => { if (keep[el.dataset.keep] != null) el.scrollLeft = keep[el.dataset.keep]; });
  renderBar();
}
function go(view) { S.view = view; window.scrollTo(0, 0); render(); }
const ctaBtn = (label, act, dis) => `<button class="cta" data-act="${act}" ${dis ? 'disabled' : ''}><span>${label}</span></button>`;
function renderBar() {
  const bar = $('#bar'); let html = '';
  if (DATA && !S.error) {
    if (S.view === 'home') html = ctaBtn('Записаться', 'start');
    else if (S.view === 'book') {
      const t = total();
      if (S.step === 1) html = ctaBtn(S.serviceId ? 'Выбрать время · ' + money(t.price) : 'Выберите услугу', 'next', !S.serviceId);
      else if (S.step === 2) html = ctaBtn(S.time ? 'Далее · ' + relDay(S.date).toLowerCase() + ', ' + S.time : 'Выберите время', 'next', !S.time);
      else html = ctaBtn(S.busy ? 'Отправляем…' : 'Записаться · ' + money(t.price), 'submit', S.busy);
    } else if (S.view === 'success') html = ctaBtn('Готово', 'home');
  }
  bar.innerHTML = html; bar.classList.toggle('show', !!html); document.body.classList.toggle('has-bar', !!html);
}
const nav = (title, extra) => `<div class="nav"><button class="back" data-act="back" aria-label="Назад">${ic('back')}</button><h2>${title}</h2>${extra || ''}</div>`;
const demoPill = () => DEMO ? '<span class="demo-pill">ДЕМО</span>' : '';

function skeleton() {
  return `<div style="padding-top:30px"><div class="sk" style="width:104px;height:104px;border-radius:50%;margin:20px auto"></div>
    <div class="sk" style="height:26px;width:50%;margin:0 auto 12px"></div><div class="sk" style="height:14px;width:35%;margin:0 auto 30px"></div>
    <div class="sk" style="height:76px;margin-bottom:12px"></div><div class="sk" style="height:140px"></div></div>`;
}
function errorView() {
  return `<div class="err-box">${ic('shield', 'lg')}<b>Не удалось загрузить</b>${esc(S.error)}<br><br><button class="sbtn gold" data-act="reload">Повторить</button></div>`;
}

const VIEWS = {
  home() {
    const o = openState(); const nf = nextFree(30); const st = DATA.settings;
    const popular = ['s1','s7','s2','s5'].map(svc).filter(Boolean);
    const pops = (popular.length ? popular : DATA.services.slice(0, 4));
    const offDays = st.daysOff.map(d => WDF[d]).join(', ');
    const myNext = S.my.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    return `
    <div class="hero">
      <div class="hero-top">
        <span class="status ${o.open ? '' : 'closed'}"><i></i>${o.text}</span>
        <div class="hero-btns">
          ${DATA.isAdmin ? `<button class="icon-btn" data-act="admin" aria-label="Админ-панель">${ic('sliders')}</button>` : ''}
          <button class="icon-btn" data-act="my" aria-label="Мои записи">${ic('cal')}${S.my.length ? '<span class="dot"></span>' : ''}</button>
        </div>
      </div>
      <div class="hero-main">
        <div class="avatar">${B.photo ? `<img src="${esc(B.photo)}" alt="">` : esc(B.name[0])}</div>
        <h1>${esc(B.name)}</h1>
        <div class="sub">${esc(B.title)} · ${esc(B.experience)}</div>
        <div class="rating">${starFill} ${B.rating} <span>· ${B.reviews} отзывов</span></div>
      </div>
      <div class="quick">
        <a class="q" href="tel:${esc(B.phone)}">${ic('phone')}Позвонить</a>
        <button class="q" data-act="map">${ic('pin')}Маршрут</button>
        <button class="q" data-act="chat">${ic('chat')}Написать</button>
      </div>
    </div>

    ${myNext ? `<div class="sec"><div class="card next-slot" data-act="my" style="cursor:pointer">
      <div class="badge-ic">${ic('bell')}</div>
      <div><div class="lbl">Ваша запись</div><div class="big" style="font-size:17px">${relDay(myNext.date)}, ${myNext.time}</div><div class="lbl">${esc(myNext.serviceName)}</div></div>
      <span class="go">Открыть</span></div></div>` : ''}

    ${nf ? `<div class="sec"><div class="card next-slot">
      <div class="badge-ic">${ic('clock')}</div>
      <div><div class="lbl">Ближайшее свободное</div><div class="big">${relDay(nf.date)}, ${nf.time}</div></div>
      <button class="go" data-act="start">Занять</button></div></div>` : ''}

    <div class="sec">
      <div class="sec-h"><h2>Популярное</h2><button class="link" data-act="start">Все услуги →</button></div>
      <div class="hscroll" data-keep="pop">${pops.map(s => `
        <button class="pop" data-act="pick" data-id="${s.id}">
          <div class="badge-ic">${ic(s.icon)}</div>
          <div class="nm">${esc(s.name)}</div>
          <div><div class="pr">${money(s.price)}</div><div class="du">${durText(s.dur)}</div></div>
        </button>`).join('')}</div>
    </div>

    <div class="sec">
      <div class="sec-h"><h2>Работы</h2></div>
      <div class="hscroll" data-keep="works">${(CFG.portfolio || []).map(w => `
        <div class="work tone-${esc(w.tone || 'a')}">${w.img ? `<img src="${esc(w.img)}" alt="">` : `<div class="art">${ic('scissors')}</div>`}<span>${esc(w.title)}</span></div>`).join('')}</div>
    </div>

    <div class="sec card">
      <div class="info-row">${ic('pin')}<div><b>${esc(B.address)}</b><small>Нажмите «Маршрут», чтобы открыть карту</small></div></div>
      <div class="info-row">${ic('clock')}<div><b>${st.workStart} – ${st.workEnd}</b><small>${st.breakStart ? 'Перерыв ' + st.breakStart + '–' + st.breakEnd + ' · ' : ''}${offDays ? 'Выходной: ' + offDays : 'Без выходных'}</small></div></div>
      <div class="info-row">${ic('phone')}<div><b>${esc(B.phoneText || B.phone)}</b><small>Звоните или пишите в Telegram</small></div></div>
    </div>
    ${DEMO ? `<p class="dim" style="text-align:center;font-size:12px;margin-top:22px">Демо-режим: данные примерные и хранятся только в этом браузере</p>` : ''}`;
  },

  book() {
    const head = nav(['Услуга', 'Дата и время', 'Подтверждение'][S.step - 1], demoPill());
    const steps = `<div class="steps">${[1, 2, 3].map(i => `<div class="${i <= S.step ? 'on' : ''}"></div>`).join('')}</div>`;
    return head + steps + (S.step === 1 ? stepService() : S.step === 2 ? stepTime() : stepConfirm());
  },

  success() {
    const b = S.last;
    return `<div class="success">
      <div class="burst"><div class="core">${ic('check')}</div></div>
      <h1>Вы записаны!</h1>
      <p>${esc(B.name)} получил вашу запись${DEMO ? '' : ' и скоро её подтвердит'}. Ждём вас ${relDay(b.date).toLowerCase()} в ${b.time}.</p>
      <div class="card summary" style="text-align:left">
        <div class="row"><span>Услуга</span><span>${esc(b.serviceName)}${b.extras ? ' + ' + esc(b.extras) : ''}</span></div>
        <div class="row"><span>Когда</span><span>${fmtDate(b.date)}, ${b.time}</span></div>
        <div class="row"><span>Длительность</span><span>${durText(b.dur)}</span></div>
        <div class="row"><span>Адрес</span><span>${esc(B.address)}</span></div>
        <div class="total"><span class="muted">Итого</span><b>${money(b.total)}</b></div>
      </div>
      <button class="btn2" data-act="map">${ic('pin', 'sm')} Как добраться</button>
      <button class="btn2" data-act="my">${ic('cal', 'sm')} Мои записи</button>
    </div>`;
  },

  my() {
    const list = S.my.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return nav('Мои записи') + (list.length ? list.map(b => `
      <div class="bk">
        <div class="bk-top"><div class="bk-when">${relDay(b.date)}, ${b.time}</div>${stBadge(b.status)}</div>
        <div class="bk-what">${esc(b.serviceName)}${b.extras ? ' + ' + esc(b.extras) : ''}</div>
        <div class="bk-sub">${fmtDate(b.date)} · ${durText(b.dur)} · ${money(b.total)}</div>
        <div class="bk-act">
          <button class="sbtn" data-act="map">${ic('pin', 'sm')} Маршрут</button>
          <button class="sbtn bad" data-act="cancel-my" data-id="${b.id}">${ic('x', 'sm')} Отменить</button>
        </div>
      </div>`).join('') : `<div class="empty">${ic('cal')}<b>Записей пока нет</b>Выберите услугу и удобное время</div>
      <button class="cta" data-act="start" style="margin-top:8px"><span>Записаться</span></button>`);
  },

  admin() {
    const A = S.admin;
    const head = nav('Админ-панель', demoPill());
    if (!A.data) return head + '<div class="sk" style="height:50px;margin:8px 0 16px"></div><div class="sk" style="height:90px;margin-bottom:10px"></div><div class="sk" style="height:90px"></div>';
    const tabs = [['bookings', 'Записи', 'list'], ['schedule', 'График', 'clock'], ['services', 'Услуги', 'tag'], ['stats', 'Итоги', 'chart']];
    const tabBar = `<div class="tabs">${tabs.map(t => `<button class="tab ${A.tab === t[0] ? 'on' : ''}" data-act="atab" data-v="${t[0]}">${ic(t[2], 'sm')}${t[1]}</button>`).join('')}</div>`;
    return head + tabBar + ({ bookings: admBookings, schedule: admSchedule, services: admServices, stats: admStats })[A.tab]();
  }
};

const ST = { new: 'Новая', confirmed: 'Подтверждена', done: 'Пришёл', noshow: 'Не пришёл', cancelled: 'Отменена' };
const stBadge = s => `<span class="st st-${s}">${ST[s] || s}</span>`;

function stepService() {
  const cs = cats(); if (!S.cat || cs.indexOf(S.cat) < 0) S.cat = svc(S.serviceId) ? svc(S.serviceId).cat : cs[0];
  const list = DATA.services.filter(s => s.cat === S.cat);
  return `
    <div class="chips scroll" data-keep="cats">${cs.map(c => `<button class="chip ${c === S.cat ? 'on' : ''}" data-act="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div style="margin-top:16px">${list.map(s => `
      <button class="svc ${s.id === S.serviceId ? 'on' : ''}" data-act="svc" data-id="${s.id}">
        <div class="badge-ic">${ic(s.icon)}</div>
        <div class="body"><div class="nm">${esc(s.name)}</div><div class="ds">${esc(s.desc)}</div>
          <div class="meta">${ic('clock', 'sm')}${durText(s.dur)}</div></div>
        <div class="pr">${money(s.price)}</div>
        <span class="chk">${ic('check', 'sm')}</span>
      </button>`).join('')}</div>
    ${DATA.extras.length ? `<div class="sec" style="margin-top:20px"><div class="sec-h"><h2>Дополнительно</h2></div>
      <div class="chips">${DATA.extras.map(e => `<button class="chip ${S.extras.indexOf(e.id) >= 0 ? 'on' : ''}" data-act="extra" data-id="${e.id}">${esc(e.name)} <span class="plus">+${e.price}</span></button>`).join('')}</div></div>` : ''}`;
}

function stepTime() {
  const t = total(); const s = svc(S.serviceId);
  const dl = days();
  const r = computeSlots(S.date, t.dur, DATA.settings, DATA.busy);
  const groups = [['Утро', 'sun', 0, 720], ['День', 'sunset', 720, 1020], ['Вечер', 'moon', 1020, 1440]];
  let slotsHtml;
  if (r.off) slotsHtml = `<div class="empty">${ic('moon')}<b>Выходной день</b>Выберите другую дату</div>`;
  else if (!r.slots.some(x => x.free)) slotsHtml = `<div class="empty">${ic('cal')}<b>Свободного времени нет</b>Попробуйте другой день</div>`;
  else slotsHtml = groups.map(([name, icon, a, b]) => {
    const g = r.slots.filter(x => toMin(x.time) >= a && toMin(x.time) < b); if (!g.length) return '';
    return `<div class="tgroup"><h3>${ic(icon, 'sm')}${name}</h3><div class="tgrid">${g.map(x =>
      `<button class="slot ${x.time === S.time ? 'on' : ''}" data-act="time" data-v="${x.time}" ${x.free ? '' : 'disabled'}>${x.time}</button>`).join('')}</div></div>`;
  }).join('');
  return `
    <div class="mini"><div class="badge-ic">${ic(s.icon)}</div><div><b>${esc(s.name)}</b><small>${t.names.length ? '+ ' + esc(t.names.join(', ')) + ' · ' : ''}${durText(t.dur)}</small></div><div class="pr">${money(t.price)}</div></div>
    <div class="hscroll" data-keep="days">${dl.map((k, i) => {
      const d = parseKey(k); const rr = computeSlots(k, t.dur, DATA.settings, DATA.busy); const off = rr.off || !rr.slots.some(x => x.free);
      return `<button class="day ${k === S.date ? 'on' : ''} ${off ? 'off' : ''}" data-act="date" data-v="${k}">
        <span class="wd">${i === 0 ? 'Сег' : i === 1 ? 'Завт' : WD[d.getDay()]}</span><span class="dn">${d.getDate()}</span><span class="mk">${rr.off ? 'вых' : off ? 'нет' : MON[d.getMonth()].slice(0, 3)}</span></button>`;
    }).join('')}</div>
    <div style="margin-top:4px;font-weight:700">${fmtDate(S.date)}</div>
    ${slotsHtml}`;
}

function stepConfirm() {
  const t = total(); const s = svc(S.serviceId);
  return `
    <div class="card summary">
      <div class="row"><span>Мастер</span><span>${esc(B.name)}</span></div>
      <div class="row"><span>Услуга</span><span>${esc(s.name)}</span></div>
      ${t.names.length ? `<div class="row"><span>Дополнительно</span><span>${esc(t.names.join(', '))}</span></div>` : ''}
      <div class="row"><span>Когда</span><span>${fmtDate(S.date)}, ${S.time}</span></div>
      <div class="row"><span>Длительность</span><span>${durText(t.dur)}</span></div>
      <div class="total"><span class="muted">Итого</span><b>${money(t.price)}</b></div>
    </div>
    <div class="field"><label>Ваше имя</label><input class="input" id="f-name" data-model="name" value="${esc(S.name)}" placeholder="Например, Фаррух" autocomplete="given-name"></div>
    <div class="field"><label>Телефон</label><input class="input" id="f-phone" data-model="phone" value="${esc(S.phone)}" placeholder="+992 __ ___ __ __" inputmode="tel" autocomplete="tel"></div>
    <div class="field"><label>Комментарий (необязательно)</label><textarea class="input" data-model="comment" placeholder="Пожелания мастеру">${esc(S.comment)}</textarea></div>
    <div class="hint">${ic('shield', 'sm')}<span>Имя и телефон видит только мастер. Они сохранятся в вашем Telegram, чтобы в следующий раз не вводить их заново.</span></div>`;
}

/* ---------- админка ---------- */
function admBookings() {
  const A = S.admin, all = A.data.bookings, t = todayKey(), tm = dkey(addDays(new Date(), 1)), wk = dkey(addDays(new Date(), 6)), past = dkey(addDays(new Date(), -30));
  const f = { today: b => b.date === t, tomorrow: b => b.date === tm, week: b => b.date >= t && b.date <= wk, past: b => b.date < t && b.date >= past }[A.range];
  const list = all.filter(f).sort((a, b) => A.range === 'past' ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time));
  const act = list.filter(b => b.status !== 'cancelled');
  const ranges = [['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['week', '7 дней'], ['past', 'Прошедшие']];
  let html = `<div class="kpis">
      <div class="kpi"><b>${act.length}</b><small>записей</small></div>
      <div class="kpi"><b>${act.filter(b => b.status === 'new').length}</b><small>новых</small></div>
      <div class="kpi gold"><b>${act.filter(b => b.status !== 'noshow').reduce((a, b) => a + Number(b.total), 0)}</b><small>${A.range === 'past' ? 'выручка' : 'ожидается'}, ${CFG.currency}</small></div>
    </div>
    <div class="chips scroll" data-keep="ranges">${ranges.map(r => `<button class="chip ${A.range === r[0] ? 'on' : ''}" data-act="arange" data-v="${r[0]}">${r[1]}</button>`).join('')}</div>`;
  if (!list.length) return html + `<div class="empty">${ic('cal')}<b>Записей нет</b>${A.range === 'today' ? 'Сегодня свободный день' : 'В этом периоде пусто'}</div>`;
  let cur = '';
  list.forEach(b => {
    if (b.date !== cur) { cur = b.date; html += `<div class="adm-day">${relDay(b.date)}${relDay(b.date) !== fmtDate(b.date) ? ' · ' + fmtDate(b.date) : ''}</div>`; }
    const btns = [];
    if (b.status === 'new') btns.push(`<button class="sbtn gold" data-act="astatus" data-id="${b.id}" data-v="confirmed">${ic('check', 'sm')} Подтвердить</button>`);
    if (b.status === 'new' || b.status === 'confirmed') {
      btns.push(`<button class="sbtn ok" data-act="astatus" data-id="${b.id}" data-v="done">Пришёл</button>`);
      btns.push(`<button class="sbtn" data-act="astatus" data-id="${b.id}" data-v="noshow">Не пришёл</button>`);
      btns.push(`<button class="sbtn bad" data-act="astatus" data-id="${b.id}" data-v="cancelled">${ic('x', 'sm')}</button>`);
    }
    if (b.status === 'done' || b.status === 'noshow' || b.status === 'cancelled') btns.push(`<button class="sbtn" data-act="astatus" data-id="${b.id}" data-v="confirmed">Вернуть</button>`);
    html += `<div class="abk ${b.status}">
      <div class="tm">${b.time}<small>${durText(b.dur)}</small></div>
      <div class="bd">
        <div class="nm">${esc(b.name)} ${stBadge(b.status)}</div>
        <div class="sv">${esc(b.serviceName)}${b.extras ? ' + ' + esc(b.extras) : ''}</div>
        <a class="ph" href="tel:${esc(String(b.phone).replace(/[^\d+]/g, ''))}">${esc(b.phone)}</a>${b.tgUsername ? ` · <a class="ph" href="https://t.me/${esc(b.tgUsername)}" target="_blank">@${esc(b.tgUsername)}</a>` : ''}
        ${b.comment ? `<div class="cm">«${esc(b.comment)}»</div>` : ''}
        <div class="bk-act">${btns.join('')}</div>
      </div>
      <div class="sm">${b.total}</div>
    </div>`;
  });
  return html;
}

function admSchedule() {
  const A = S.admin; if (!A.es) A.es = clone(A.data.settings); const s = A.es;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return `
    <div class="card">
      <h3 style="margin-bottom:6px">Рабочее время</h3>
      <div class="set-row"><b>Начало</b><input class="tin" type="time" step="1800" data-set="workStart" value="${s.workStart}"></div>
      <div class="set-row"><b>Конец</b><input class="tin" type="time" step="1800" data-set="workEnd" value="${s.workEnd}"></div>
      <div class="set-row"><b>Перерыв с</b><input class="tin" type="time" step="1800" data-set="breakStart" value="${s.breakStart || ''}"></div>
      <div class="set-row"><b>Перерыв до</b><input class="tin" type="time" step="1800" data-set="breakEnd" value="${s.breakEnd || ''}"></div>
    </div>
    <div class="card sec">
      <h3>Рабочие дни</h3><small class="muted">Нажмите на день, чтобы сделать его выходным</small>
      <div class="wdays">${order.map(d => `<button class="wd ${s.daysOff.indexOf(d) >= 0 ? 'off' : ''}" data-act="aday" data-v="${d}">${WD[d]}</button>`).join('')}</div>
    </div>
    <div class="card sec">
      <h3>Закрытые даты</h3><small class="muted">Отпуск, болезнь, праздники: в эти дни запись закрыта</small>
      <div class="add-row"><input class="input" type="date" data-set="__newClosed" value="${esc(A.newClosed)}" min="${todayKey()}"><button class="sbtn gold" data-act="aclosed-add">${ic('plus', 'sm')}</button></div>
      <div class="cd-list">${s.closedDates.filter(d => d >= todayKey()).sort().map(d => `<span class="cd">${fmtDate(d)}<button data-act="aclosed-del" data-v="${d}" aria-label="Удалить">${ic('x', 'sm')}</button></span>`).join('') || '<small class="dim">Нет закрытых дат</small>'}</div>
    </div>
    <button class="cta sec" data-act="asave-settings"><span>Сохранить график</span></button>`;
}

function admServices() {
  const A = S.admin; if (!A.ev) A.ev = { services: clone(A.data.services), extras: clone(A.data.extras) };
  const cs = []; A.ev.services.forEach(s => { if (cs.indexOf(s.cat) < 0) cs.push(s.cat); });
  const icons = ['scissors', 'fade', 'clipper', 'beard', 'razor', 'combo', 'family', 'kid'];
  return `<div class="sec-h"><h2>Услуги</h2><button class="sbtn gold" data-act="asvc-add">${ic('plus', 'sm')} Добавить</button></div>
    ${A.ev.services.map((s, i) => `
      <div class="ed ${s.hidden ? 'hidden' : ''}">
        <input class="input" data-ed="services|${i}|name" value="${esc(s.name)}" placeholder="Название" style="font-weight:800">
        <input class="input" data-ed="services|${i}|desc" value="${esc(s.desc)}" placeholder="Описание" style="margin-top:8px">
        <div class="ed-grid">
          <div><label>Цена, ${CFG.currency}</label><input class="input" type="number" inputmode="numeric" data-ed="services|${i}|price" value="${s.price}"></div>
          <div><label>Минут</label><input class="input" type="number" inputmode="numeric" step="5" data-ed="services|${i}|dur" value="${s.dur}"></div>
          <div><label>Раздел</label><input class="input" list="cats" data-ed="services|${i}|cat" value="${esc(s.cat)}"></div>
        </div>
        <div class="ed-act">
          <select class="input" data-ed="services|${i}|icon" style="flex:1">${icons.map(n => `<option value="${n}" ${s.icon === n ? 'selected' : ''}>Иконка: ${n}</option>`).join('')}</select>
          <button class="sbtn" data-act="ahide" data-k="services" data-i="${i}">${ic(s.hidden ? 'eyeoff' : 'eye', 'sm')}${s.hidden ? 'Скрыта' : 'Видна'}</button>
          <button class="sbtn bad" data-act="adel" data-k="services" data-i="${i}" aria-label="Удалить">${ic('trash', 'sm')}</button>
        </div>
      </div>`).join('')}
    <datalist id="cats">${cs.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="sec-h sec"><h2>Дополнительно</h2><button class="sbtn gold" data-act="aext-add">${ic('plus', 'sm')} Добавить</button></div>
    ${A.ev.extras.map((e, i) => `
      <div class="ed ${e.hidden ? 'hidden' : ''}">
        <input class="input" data-ed="extras|${i}|name" value="${esc(e.name)}" placeholder="Название" style="font-weight:800">
        <div class="ed-grid">
          <div><label>Цена, ${CFG.currency}</label><input class="input" type="number" inputmode="numeric" data-ed="extras|${i}|price" value="${e.price}"></div>
          <div><label>Минут</label><input class="input" type="number" inputmode="numeric" step="5" data-ed="extras|${i}|dur" value="${e.dur}"></div>
          <div style="display:flex;align-items:flex-end;gap:6px">
            <button class="sbtn" data-act="ahide" data-k="extras" data-i="${i}" aria-label="Скрыть">${ic(e.hidden ? 'eyeoff' : 'eye', 'sm')}</button>
            <button class="sbtn bad" data-act="adel" data-k="extras" data-i="${i}" aria-label="Удалить">${ic('trash', 'sm')}</button>
          </div>
        </div>
      </div>`).join('')}
    <button class="cta sec" data-act="asave-svc"><span>Сохранить услуги</span></button>`;
}

function admStats() {
  const all = S.admin.data.bookings, t = todayKey();
  const done = all.filter(b => b.status === 'done');
  const from = n => dkey(addDays(new Date(), -n));
  const sum = arr => arr.reduce((a, b) => a + Number(b.total), 0);
  const inP = (arr, n) => arr.filter(b => b.date >= from(n) && b.date <= t);
  const d30 = inP(done, 29), all30 = inP(all.filter(b => b.status !== 'cancelled'), 29);
  const noshow = all30.filter(b => b.status === 'noshow').length;
  const clients = new Set(d30.map(b => b.phone)).size;
  const bars = []; for (let i = 6; i >= 0; i--) { const k = from(i); bars.push({ k, v: sum(done.filter(b => b.date === k)) }); }
  const mx = Math.max(1, ...bars.map(b => b.v));
  const cnt = {}; d30.forEach(b => { cnt[b.serviceName] = (cnt[b.serviceName] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5); const tmx = top.length ? top[0][1] : 1;
  return `
    <div class="kpis">
      <div class="kpi gold"><b>${sum(inP(done, 0))}</b><small>сегодня, ${CFG.currency}</small></div>
      <div class="kpi gold"><b>${sum(inP(done, 6))}</b><small>7 дней</small></div>
      <div class="kpi gold"><b>${sum(d30)}</b><small>30 дней</small></div>
      <div class="kpi"><b>${d30.length}</b><small>визитов</small></div>
      <div class="kpi"><b>${d30.length ? Math.round(sum(d30) / d30.length) : 0}</b><small>средний чек</small></div>
      <div class="kpi"><b>${clients}</b><small>клиентов</small></div>
    </div>
    <div class="card"><h3>Выручка за неделю</h3>
      <div class="bars">${bars.map(b => `<div class="b"><span class="v">${b.v || ''}</span><div class="f" style="height:${Math.round(b.v / mx * 100)}%"></div><small>${WD[parseKey(b.k).getDay()]}</small></div>`).join('')}</div>
    </div>
    <div class="card sec"><h3 style="margin-bottom:14px">Популярные услуги · 30 дней</h3>
      ${top.map(([n, c]) => `<div class="top-row"><div class="l"><span>${esc(n)}</span><span>${c}</span></div><div class="t"><i style="width:${Math.round(c / tmx * 100)}%"></i></div></div>`).join('') || '<small class="dim">Пока нет данных</small>'}
    </div>
    <div class="card sec" style="display:flex;justify-content:space-between;align-items:center"><span class="muted">Не пришли за 30 дней</span><b style="color:#f08a8d">${noshow}</b></div>
    ${DEMO ? `<button class="btn2 sec" data-act="demo-reset">Сбросить демо-данные</button>` : ''}`;
}

/* =================== действия =================== */
function startBook(id) {
  S.view = 'book'; S.step = 1; S.time = null;
  if (id) { S.serviceId = id; S.cat = svc(id).cat; }
  window.scrollTo(0, 0); haptic('light'); render();
}
function firstOpenDay() {
  const dur = total().dur;
  for (const k of days()) { const r = computeSlots(k, dur, DATA.settings, DATA.busy); if (r.slots.some(s => s.free)) return k; }
  return todayKey();
}
function goBack() {
  haptic('light');
  if (S.view === 'book' && S.step > 1) { S.step--; window.scrollTo(0, 0); render(); return; }
  go('home');
}
async function refreshPublic() { DATA = await call('getPublic'); S.my = await call('myBookings'); }

async function submit() {
  if (S.busy) return;
  const name = S.name.trim(), phone = S.phone.trim();
  if (name.length < 2) { toast('Введите имя', 'err'); haptic('error'); $('#f-name') && $('#f-name').focus(); return; }
  if (phone.replace(/\D/g, '').length < 9) { toast('Введите номер телефона', 'err'); haptic('error'); $('#f-phone') && $('#f-phone').focus(); return; }
  S.busy = true; renderBar();
  try {
    if (inTG && tg.requestWriteAccess && tg.isVersionAtLeast('6.9')) await new Promise(r => tg.requestWriteAccess(() => r()));
    const b = await call('book', { serviceId: S.serviceId, extras: S.extras, date: S.date, time: S.time, name, phone, comment: S.comment.trim() });
    store.set('name', name); store.set('phone', phone);
    S.last = b; haptic('success');
    await refreshPublic();
    S.serviceId = null; S.extras = []; S.time = null; S.comment = ''; S.step = 1;
    S.busy = false; go('success');
  } catch (e) {
    S.busy = false; haptic('error'); toast(e.message, 'err');
    if (/занят/i.test(e.message)) { try { await refreshPublic(); } catch (x) {} S.step = 2; S.time = null; render(); } else renderBar();
  }
}

async function openAdmin() {
  S.view = 'admin'; S.admin.data = null; S.admin.es = null; S.admin.ev = null; window.scrollTo(0, 0); render();
  try { S.admin.data = await call('adminData'); } catch (e) { toast(e.message, 'err'); S.view = 'home'; }
  render();
}

const H = {
  start: () => startBook(),
  pick: el => startBook(el.dataset.id),
  back: goBack,
  home: () => go('home'),
  my: () => { haptic('light'); go('my'); },
  map: () => openLink(B.mapUrl),
  chat: () => openTg('https://t.me/' + B.telegram),
  reload: () => location.reload(),
  cat: el => { S.cat = el.dataset.v; haptic('select'); rerender(); },
  svc: el => { S.serviceId = el.dataset.id; S.time = null; haptic('select'); rerender(); },
  extra: el => { const id = el.dataset.id, i = S.extras.indexOf(id); if (i >= 0) S.extras.splice(i, 1); else S.extras.push(id); S.time = null; haptic('select'); rerender(); },
  next: () => {
    if (S.step === 1 && S.serviceId) { S.step = 2; S.date = firstOpenDay(); }
    else if (S.step === 2 && S.time) S.step = 3;
    else return;
    haptic('light'); window.scrollTo(0, 0); render();
  },
  date: el => { S.date = el.dataset.v; S.time = null; haptic('select'); rerender(); },
  time: el => { S.time = el.dataset.v; haptic('select'); rerender(); },
  submit,
  'cancel-my': async el => {
    if (!(await ask('Отменить эту запись?'))) return;
    try { await call('cancelMine', { id: el.dataset.id }); await refreshPublic(); haptic('success'); toast('Запись отменена', 'ok'); rerender(); }
    catch (e) { toast(e.message, 'err'); }
  },
  admin: openAdmin,
  atab: el => { S.admin.tab = el.dataset.v; haptic('select'); window.scrollTo(0, 0); rerender(); },
  arange: el => { S.admin.range = el.dataset.v; haptic('select'); rerender(); },
  astatus: async el => {
    const id = el.dataset.id, v = el.dataset.v;
    if (v === 'cancelled' && !(await ask('Отменить запись клиента?'))) return;
    try {
      await call('setStatus', { id, status: v });
      const b = S.admin.data.bookings.find(x => x.id === id); if (b) b.status = v;
      haptic('success'); toast({ confirmed: 'Подтверждено', done: 'Отмечено: пришёл', noshow: 'Отмечено: не пришёл', cancelled: 'Запись отменена' }[v], 'ok'); rerender();
      refreshPublic().catch(() => {});
    } catch (e) { toast(e.message, 'err'); }
  },
  aday: el => { const d = Number(el.dataset.v), a = S.admin.es.daysOff, i = a.indexOf(d); if (i >= 0) a.splice(i, 1); else a.push(d); haptic('select'); rerender(); },
  'aclosed-add': () => {
    const v = S.admin.newClosed; if (!v) { toast('Выберите дату', 'err'); return; }
    if (S.admin.es.closedDates.indexOf(v) < 0) S.admin.es.closedDates.push(v); S.admin.newClosed = ''; haptic('light'); rerender();
  },
  'aclosed-del': el => { const a = S.admin.es.closedDates; a.splice(a.indexOf(el.dataset.v), 1); haptic('light'); rerender(); },
  'asave-settings': async () => {
    const s = S.admin.es;
    if (toMin(s.workEnd) <= toMin(s.workStart)) { toast('Конец работы должен быть позже начала', 'err'); return; }
    if ((s.breakStart && !s.breakEnd) || (!s.breakStart && s.breakEnd)) { toast('Укажите перерыв полностью или очистите оба поля', 'err'); return; }
    try { await call('saveSettings', { settings: s }); S.admin.data.settings = clone(s); await refreshPublic(); haptic('success'); toast('График сохранён', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  },
  'asvc-add': () => { S.admin.ev.services.push({ id: 's' + Date.now().toString(36), cat: S.admin.ev.services[0] ? S.admin.ev.services[0].cat : 'Стрижки', name: '', desc: '', price: 0, dur: 30, icon: 'scissors' }); rerender(); },
  'aext-add': () => { S.admin.ev.extras.push({ id: 'e' + Date.now().toString(36), name: '', price: 0, dur: 0 }); rerender(); },
  ahide: el => { const o = S.admin.ev[el.dataset.k][el.dataset.i]; o.hidden = !o.hidden; haptic('select'); rerender(); },
  adel: async el => { if (!(await ask('Удалить?'))) return; S.admin.ev[el.dataset.k].splice(Number(el.dataset.i), 1); rerender(); },
  'asave-svc': async () => {
    const ev = S.admin.ev;
    const bad = ev.services.concat(ev.extras).find(x => !String(x.name).trim());
    if (bad) { toast('У каждой позиции должно быть название', 'err'); return; }
    ev.services.forEach(s => { s.price = Number(s.price) || 0; s.dur = Math.max(5, Number(s.dur) || 30); s.cat = String(s.cat).trim() || 'Другое'; });
    ev.extras.forEach(e => { e.price = Number(e.price) || 0; e.dur = Math.max(0, Number(e.dur) || 0); });
    try { await call('saveServices', clone(ev)); S.admin.data.services = clone(ev.services); S.admin.data.extras = clone(ev.extras); await refreshPublic(); haptic('success'); toast('Услуги сохранены', 'ok'); rerender(); }
    catch (e) { toast(e.message, 'err'); }
  },
  'demo-reset': async () => { if (!(await ask('Сбросить демо-данные?'))) return; demo.reset(); await refreshPublic(); openAdmin(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = H[el.dataset.act]; if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.model) S[el.dataset.model] = el.value;
  else if (el.dataset.set) { if (el.dataset.set === '__newClosed') S.admin.newClosed = el.value; else S.admin.es[el.dataset.set] = el.value; }
  else if (el.dataset.ed) { const [k, i, f] = el.dataset.ed.split('|'); S.admin.ev[k][Number(i)][f] = el.value; }
});
document.addEventListener('change', e => { const el = e.target; if (el.dataset.ed && el.tagName === 'SELECT') { const [k, i, f] = el.dataset.ed.split('|'); S.admin.ev[k][Number(i)][f] = el.value; rerender(); } });

/* =================== запуск =================== */
async function init() {
  if (inTG) {
    tg.ready(); tg.expand();
    try { tg.setHeaderColor('#0c0c0e'); tg.setBackgroundColor('#0c0c0e'); if (tg.setBottomBarColor) tg.setBottomBarColor('#0c0c0e'); } catch (e) {}
    try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
    tg.BackButton.onClick(goBack);
  }
  render();
  try {
    const n = await store.get('name'), p = await store.get('phone');
    const u = inTG && tg.initDataUnsafe && tg.initDataUnsafe.user;
    S.name = n || (u ? u.first_name : ''); S.phone = p || '';
    await refreshPublic();
    if (new URLSearchParams(location.search).get('admin') === '1' && DATA.isAdmin) { openAdmin(); return; }
  } catch (e) { S.error = e.message; }
  render();
}
init();
})();
