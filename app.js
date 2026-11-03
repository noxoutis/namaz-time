'use strict';

// ---------- Настройки расчёта: как на shiatime.ru ----------
prayTimes.setMethod('Jafari');                                   // фаджр 16°, полночь: середина между закатом и фаджром
prayTimes.adjust({ imsak: 17.7, maghrib: 4.5, dhuhr: '1 min' }); // имсак 17,7°, магриб 4,5°, зухр +1 мин

const NAMES = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'sunset', 'maghrib', 'midnight'];
const LABELS = ['Имсак', 'Фаджр', 'Восход', 'Зухр', 'Закат', 'Магриб', 'Полночь'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const HIJRI_MONTHS = ['мухаррам', 'сафар', 'раби аль-авваль', 'раби ас-сани', 'джумада аль-уля', 'джумада ас-сани',
  'раджаб', 'шаабан', 'рамадан', 'шавваль', 'зуль-каада', 'зуль-хиджжа'];

const PRESETS = [
  { name: 'Москва', lat: 55.7558, lng: 37.6173 },
  { name: 'Котельники', lat: 55.67, lng: 37.86 },
  { name: 'Дзержинский', lat: 55.63, lng: 37.85 },
  { name: 'Бишкек', lat: 42.87, lng: 74.59 },
];

const $ = s => document.querySelector(s);

// ---------- Хранение на устройстве ----------
const store = {
  get(k, def) { try { const v = localStorage.getItem('namaz.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('namaz.' + k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
};

// ---------- Часовые пояса ----------
function tzOf(lat, lng) {
  try { return tzlookup(lat, lng); } catch (e) { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
}

function partsIn(tz, date) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(date);
  const g = t => +p.find(x => x.type === t).value;
  return { y: g('year'), m: g('month'), d: g('day'), h: g('hour') % 24, min: g('minute') };
}

// сдвиг пояса (в часах) в полдень указанного дня
function offsetHours(tz, y, m, d) {
  const t = Date.UTC(y, m - 1, d, 12);
  const p = partsIn(tz, new Date(t));
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - t) / 60000) / 60;
}

function fmtOffset(h) {
  const s = h < 0 ? '−' : '+', a = Math.abs(h), hh = Math.floor(a), mm = Math.round((a - hh) * 60);
  return 'UTC' + s + hh + (mm ? ':' + String(mm).padStart(2, '0') : '');
}

// ---------- Расчёт ----------
function timesFor(place, y, m, d) {
  return prayTimes.getTimes([y, m, d], [place.lat, place.lng], offsetHours(place.tz, y, m, d), 0, '24h');
}

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const weekday = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
function shiftDay(o, n) { const t = new Date(Date.UTC(o.y, o.m - 1, o.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
const sameDay = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;

// ---------- Хиджра (арифметический календарь, как islamic-civil на сайте) + поправка ----------
const jdOf = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 2440587.5;
function gregOf(jd) { const t = new Date(Math.round((jd - 2440587.5) * 86400000)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
const hijriJd = (y, m, d) => d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439.5 - 1;
function hijriOf(y, m, d) {
  const jd = jdOf(y, m, d) + hCorr();
  const hy = Math.floor((30 * (jd - 1948439.5) + 10646) / 10631);
  const hm = Math.min(12, Math.ceil((jd - (29 + hijriJd(hy, 1, 1))) / 29.5) + 1);
  return { y: hy, m: hm, d: jd - hijriJd(hy, hm, 1) + 1 };
}
const hCorr = () => +store.get('hcorr', 0);
const hijriText = h => `${h.d} ${HIJRI_MONTHS[h.m - 1]} ${h.y} г.х.`;

// ---------- Состояние ----------
let place = store.get('place', null);
if (!place) {
  const devTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const p = devTz === 'Asia/Bishkek' ? PRESETS[3] : PRESETS[0];
  place = { ...p, tz: tzOf(p.lat, p.lng) };
}
let today = partsIn(place.tz, new Date());
let viewDay = { y: today.y, m: today.m, d: today.d };
let viewMonth = { y: today.y, m: today.m };

function setPlace(p, opts = {}) {
  place = { name: p.name, lat: +p.lat, lng: +p.lng, tz: p.tz || tzOf(+p.lat, +p.lng) };
  store.set('place', place);
  today = partsIn(place.tz, new Date());
  if (!opts.keepDate) { viewDay = { y: today.y, m: today.m, d: today.d }; viewMonth = { y: today.y, m: today.m }; }
  renderAll();
  if (map) moveMarker();
}

// ---------- Отрисовка ----------
function renderPlace() {
  $('#placeName').textContent = place.name;
  const off = offsetHours(place.tz, today.y, today.m, today.d);
  $('#placeMeta').textContent = `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)} · ${place.tz} (${fmtOffset(off)})`;
  const isFav = favs().some(f => near(f, place));
  $('#favBtn').textContent = isFav ? '★' : '☆';
  $('#favBtn').title = isFav ? 'Убрать из избранного' : 'Добавить в избранное';
}

function renderToday() {
  const h = hijriOf(today.y, today.m, today.d);
  $('#todayLine').textContent = `${today.d} ${MONTHS_GEN[today.m - 1]} ${today.y} · ${hijriText(h)}`;
}

const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

function renderDay() {
  const { y, m, d } = viewDay;
  const t = timesFor(place, y, m, d);
  const isToday = sameDay(viewDay, today);
  $('#dayTitle').textContent = `${d} ${MONTHS_GEN[m - 1]} ${y}, ${WEEKDAYS[weekday(y, m, d)]}`;
  $('#dayHijri').textContent = hijriText(hijriOf(y, m, d));
  $('#dayToday').classList.toggle('hidden', isToday);

  // ближайшее время (только для сегодняшнего дня)
  let next = -1, nextText = '';
  if (isToday) {
    const now = today.h * 60 + today.min;
    const mins = NAMES.map((n, i) => {
      let v = toMin(t[n]);
      if (n === 'midnight' && v < 12 * 60) v += 1440;
      if ((n === 'imsak' || n === 'fajr') && v > 18 * 60) v -= 1440;
      return v;
    });
    next = mins.findIndex(v => v > now);
    if (next >= 0) {
      const left = mins[next] - now, hh = Math.floor(left / 60), mm = left % 60;
      nextText = `${LABELS[next]} через ${hh ? hh + ' ч ' : ''}${mm} мин`;
    }
  }
  const box = $('#times');
  box.textContent = '';
  NAMES.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 't' + (i === next ? ' next' : '') + (i === 6 ? ' last' : '');
    const a = document.createElement('span'); a.className = 'n'; a.textContent = LABELS[i];
    const b = document.createElement('span'); b.className = 'v'; b.textContent = t[n];
    el.append(a, b);
    box.append(el);
  });
  $('#nextLine').textContent = nextText;
}

function renderMonth() {
  const { y, m } = viewMonth;
  $('#monthTitle').textContent = `${MONTHS[m - 1]} ${y}`;
  $('#printTitle').textContent = `${MONTHS[m - 1]} — ${y}`;
  $('#printPlace').textContent = place.name;
  const body = $('#monthBody');
  body.textContent = '';
  for (let d = 1; d <= daysIn(y, m); d++) {
    const t = timesFor(place, y, m, d);
    const tr = document.createElement('tr');
    if (sameDay({ y, m, d }, today)) tr.className = 'today';
    if (sameDay({ y, m, d }, viewDay)) tr.classList.add('sel');
    [String(d), ...NAMES.map(n => t[n])].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.append(td); });
    tr.addEventListener('click', () => { viewDay = { y, m, d }; renderDay(); renderMonth(); $('#dayCard').scrollIntoView({ behavior: 'smooth' }); });
    body.append(tr);
  }
}

function renderAll() { renderToday(); renderPlace(); renderDay(); renderMonth(); }

// ---------- Подсказки ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
function status(msg) { const el = $('#status'); el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }

// ---------- Панели ----------
const PANELS = { searchBtn: '#searchPanel', mapBtn: '#mapPanel', favListBtn: '#favPanel' };
function togglePanel(btnId) {
  Object.entries(PANELS).forEach(([b, p]) => {
    const open = b === btnId && $(p).classList.contains('hidden');
    $(p).classList.toggle('hidden', !open);
    $('#' + b).classList.toggle('on', open);
  });
  if (btnId === 'mapBtn' && !$('#mapPanel').classList.contains('hidden')) openMap();
  if (btnId === 'searchBtn' && !$('#searchPanel').classList.contains('hidden')) $('#q').focus();
  if (btnId === 'favListBtn') renderFavs();
}
Object.keys(PANELS).forEach(b => $('#' + b).addEventListener('click', () => togglePanel(b)));

// ---------- Поиск и названия мест (OpenStreetMap Nominatim) ----------
const NOMINATIM = 'https://nominatim.openstreetmap.org';

function shortName(a, fallback) {
  if (!a) return fallback;
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || a.state;
  const street = a.road || a.pedestrian || a.square || a.neighbourhood || a.suburb;
  const parts = [];
  if (a.state && city !== a.state && !/город|г\./i.test(a.state) && a.country_code === 'ru') parts.push(a.state);
  if (city) parts.push(city);
  if (street) parts.push(street + (a.house_number ? ', ' + a.house_number : ''));
  if (!parts.length && a.country) parts.push(a.country);
  return parts.join(', ') || fallback;
}

async function reverseName(lat, lng) {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=ru&lat=${lat}&lon=${lng}`);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    return shortName(j.address, j.display_name);
  } catch (e) { return null; }
}

function coordName(lat, lng) { return `Точка ${(+lat).toFixed(4)}, ${(+lng).toFixed(4)}`; }

async function choosePoint(lat, lng, name) {
  setPlace({ name: name || coordName(lat, lng), lat, lng });
  if (!name) {
    const n = await reverseName(lat, lng);
    if (n && place.lat === +lat && place.lng === +lng) setPlace({ ...place, name: n }, { keepDate: true });
  }
}

$('#searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (!q) return;
  const list = $('#results');
  list.textContent = '';
  status('Ищу…');
  try {
    const r = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=8&accept-language=ru&q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error(r.status);
    const res = await r.json();
    status(res.length ? '' : 'Ничего не найдено. Попробуйте написать иначе, например «Бишкек, Токомбаева 9».');
    const seen = new Set();
    res.filter(x => { const k = x.display_name; if (seen.has(k)) return false; seen.add(k); return true; }).forEach(x => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const name = shortName(x.address, x.name || x.display_name);
      b.textContent = name;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = x.display_name;
      b.append(sub);
      b.addEventListener('click', () => {
        setPlace({ name, lat: +x.lat, lng: +x.lon });
        list.textContent = '';
        togglePanel('searchBtn');
        toast('Место выбрано');
      });
      li.append(b); list.append(li);
    });
  } catch (err) {
    status('Поиск не ответил. Проверьте интернет и попробуйте ещё раз.');
  }
});

// ---------- Геолокация ----------
$('#geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Геолокация недоступна на этом устройстве'); return; }
  status('Определяю местоположение…');
  navigator.geolocation.getCurrentPosition(
    pos => { status(''); choosePoint(+pos.coords.latitude.toFixed(5), +pos.coords.longitude.toFixed(5)); toast('Место определено'); },
    err => {
      status(err.code === 1
        ? 'Нет доступа к геолокации. Разрешите его в настройках браузера (на iPhone: Настройки → Конфиденциальность → Службы геолокации → Safari).'
        : 'Не удалось определить место. Попробуйте ещё раз или воспользуйтесь поиском.');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
});

// ---------- Карта ----------
let map = null, marker = null;
function openMap() {
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([place.lat, place.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    marker = L.marker([place.lat, place.lng]).addTo(map);
    map.on('click', e => { choosePoint(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)); toast('Точка выбрана'); });
  }
  setTimeout(() => { map.invalidateSize(); moveMarker(); }, 50);
}
function moveMarker() { marker.setLatLng([place.lat, place.lng]); map.panTo([place.lat, place.lng]); }

// ---------- Избранное ----------
const near = (a, b) => Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
function favs() { return store.get('favs', null) || PRESETS.map(p => ({ ...p })); }
function renderFavs() {
  const box = $('#favChips');
  box.textContent = '';
  favs().forEach((f, i) => {
    const c = document.createElement('span'); c.className = 'chip';
    const b = document.createElement('button'); b.textContent = f.name;
    b.addEventListener('click', () => { setPlace(f); togglePanel('favListBtn'); toast('Место выбрано'); });
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Удалить ' + f.name);
    x.addEventListener('click', () => { const l = favs(); l.splice(i, 1); store.set('favs', l); renderFavs(); renderPlace(); });
    c.append(b, x); box.append(c);
  });
  if (!favs().length) box.textContent = 'Список пуст. Выберите место и нажмите ☆.';
}
$('#favBtn').addEventListener('click', () => {
  const l = favs(), i = l.findIndex(f => near(f, place));
  if (i >= 0) { l.splice(i, 1); toast('Убрано из избранного'); }
  else { l.push({ name: place.name, lat: place.lat, lng: place.lng }); toast('Добавлено в «Мои места»'); }
  store.set('favs', l); renderPlace(); renderFavs();
});
$('#mGo').addEventListener('click', () => {
  const lat = parseFloat($('#mLat').value.replace(',', '.')), lng = parseFloat($('#mLng').value.replace(',', '.'));
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) { toast('Проверьте широту (−90…90) и долготу (−180…180)'); return; }
  choosePoint(lat, lng, $('#mName').value.trim() || null);
  togglePanel('favListBtn');
});

// ---------- Листание ----------
$('#dayPrev').addEventListener('click', () => { viewDay = shiftDay(viewDay, -1); syncMonth(); });
$('#dayNext').addEventListener('click', () => { viewDay = shiftDay(viewDay, 1); syncMonth(); });
$('#dayToday').addEventListener('click', () => { viewDay = { y: today.y, m: today.m, d: today.d }; syncMonth(); });
function syncMonth() { viewMonth = { y: viewDay.y, m: viewDay.m }; renderDay(); renderMonth(); }
function moveMonth(n) {
  let { y, m } = viewMonth; m += n;
  if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
  viewMonth = { y, m }; renderMonth();
}
$('#monPrev').addEventListener('click', () => moveMonth(-1));
$('#monNext').addEventListener('click', () => moveMonth(1));
// ---------- Картинки ----------
const C = { green: '#0a5a48', head: '#e3f1ec', line: '#7fb3a3', text: '#14211d', muted: '#5a6b66', bg: '#ffffff' };
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

function wrapLines(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
}

function monthCanvas() {
  const { y, m } = viewMonth, n = daysIn(y, m), W = 1080, pad = 20;
  const cols = [100, 125, 125, 135, 115, 115, 135, 210], sx = cols.reduce((a, b) => a + b, 0);
  const scale = (W - 2 * pad) / sx;
  const cw = cols.map(c => c * scale);
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = `30px ${FONT}`;
  const placeLines = wrapLines(tmp, place.name, W - 2 * pad - 30);
  const titleH = 76, placeH = 22 + placeLines.length * 40, headH = 66, rowH = 58;
  const H = pad + titleH + placeH + headH + n * rowH + 54 + pad;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  let top = pad;
  c.fillStyle = C.green; c.fillRect(pad, top, W - 2 * pad, titleH);
  c.fillStyle = '#fff'; c.font = `600 36px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(`${MONTHS[m - 1]} — ${y}`, W / 2, top + titleH / 2);
  top += titleH;
  c.fillStyle = C.text; c.font = `30px ${FONT}`;
  placeLines.forEach((l, i) => c.fillText(l, W / 2, top + 11 + 20 + i * 40));
  c.strokeStyle = C.line; c.lineWidth = 2; c.strokeRect(pad, top, W - 2 * pad, placeH);
  top += placeH;
  const rows = [['День', ...LABELS]];
  for (let d = 1; d <= n; d++) { const t = timesFor(place, y, m, d); rows.push([String(d), ...NAMES.map(k => t[k])]); }
  rows.forEach((r, i) => {
    const h = i ? rowH : headH, yy = i ? top + headH + (i - 1) * rowH : top;
    if (!i) { c.fillStyle = C.head; c.fillRect(pad, yy, W - 2 * pad, h); }
    let x = pad;
    r.forEach((v, j) => {
      c.strokeStyle = C.line; c.lineWidth = 2; c.strokeRect(x, yy, cw[j], h);
      c.fillStyle = C.text; c.font = i ? `30px ${FONT}` : `600 27px ${FONT}`;
      c.fillText(v, x + cw[j] / 2, yy + h / 2 + 1);
      x += cw[j];
    });
  });
  c.fillStyle = C.muted; c.font = `22px ${FONT}`;
  c.fillText(`${place.lat.toFixed(4)}, ${place.lng.toFixed(4)} · ${place.tz} · имсак 17,7°, фаджр 16°, магриб 4,5°`, W / 2, H - pad - 22);
  return cv;
}

function dayCanvas() {
  const { y, m, d } = viewDay, t = timesFor(place, y, m, d), W = 1080, pad = 40;
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = `34px ${FONT}`;
  const placeLines = wrapLines(tmp, place.name, W - 2 * pad);
  const rowH = 118, H = 120 + 70 + placeLines.length * 46 + 40 + 7 * rowH + 90;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  c.fillStyle = C.green; c.fillRect(0, 0, W, 120);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `600 46px ${FONT}`;
  c.fillText(`${d} ${MONTHS_GEN[m - 1]} ${y}, ${WEEKDAYS[weekday(y, m, d)]}`, W / 2, 60);
  let top = 120 + 45;
  c.fillStyle = C.muted; c.font = `34px ${FONT}`; c.fillText(hijriText(hijriOf(y, m, d)), W / 2, top);
  top += 60;
  c.fillStyle = C.text;
  placeLines.forEach((l, i) => c.fillText(l, W / 2, top + i * 46));
  top += placeLines.length * 46 + 20;
  NAMES.forEach((n, i) => {
    const yy = top + i * rowH;
    c.strokeStyle = C.line; c.lineWidth = 2; c.strokeRect(pad, yy, W - 2 * pad, rowH - 14);
    c.textAlign = 'left'; c.fillStyle = C.muted; c.font = `44px ${FONT}`; c.fillText(LABELS[i], pad + 36, yy + (rowH - 14) / 2);
    c.textAlign = 'right'; c.fillStyle = C.text; c.font = `600 64px ${FONT}`; c.fillText(t[n], W - pad - 36, yy + (rowH - 14) / 2 + 2);
  });
  c.textAlign = 'center'; c.fillStyle = C.muted; c.font = `24px ${FONT}`;
  c.fillText('имсак 17,7°, фаджр 16°, магриб 4,5° (джафаритская методика)', W / 2, H - 45);
  return cv;
}

const safe = s => s.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
// iPhone/iPad не дают сайту молча положить файл в «Фото»: показываем картинку, её сохраняют долгим нажатием
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function savePng(cv, filename) {
  const url = cv.toDataURL('image/png');
  if (isIOS) {
    $('#imgViewImg').src = url;
    $('#imgView').classList.remove('hidden');
    return;
  }
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  toast('Картинка сохранена в «Загрузки»');
}
$('#imgViewClose').addEventListener('click', () => { $('#imgView').classList.add('hidden'); $('#imgViewImg').removeAttribute('src'); });

document.querySelectorAll('[data-save]').forEach(b => {
  b.addEventListener('click', () => {
    const month = b.dataset.save === 'month';
    const name = month
      ? `Время намаза — ${MONTHS[viewMonth.m - 1]} ${viewMonth.y} — ${safe(place.name)}.png`
      : `Время намаза — ${viewDay.d} ${MONTHS_GEN[viewDay.m - 1]} ${viewDay.y} — ${safe(place.name)}.png`;
    try { savePng(month ? monthCanvas() : dayCanvas(), name); }
    catch (e) { toast('Не получилось сохранить. Попробуйте ещё раз.'); }
  });
});

// ---------- Хиджра: поправка и конвертор ----------
$('#hCorr').value = String(hCorr());
$('#hCorr').addEventListener('change', () => { store.set('hcorr', +$('#hCorr').value); renderAll(); convG(); convH(); });
HIJRI_MONTHS.forEach((n, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = n; $('#hM').append(o); });
function convG() {
  const v = $('#gIn').value;
  if (!v) { $('#gOut').textContent = ''; return; }
  const [y, m, d] = v.split('-').map(Number);
  $('#gOut').textContent = `${WEEKDAYS[weekday(y, m, d)]}, ${hijriText(hijriOf(y, m, d))}`;
}
function convH() {
  const d = +$('#hD').value, m = +$('#hM').value, y = +$('#hY').value;
  if (!d || !y) { $('#hOut').textContent = ''; return; }
  if (d < 1 || d > 30) { $('#hOut').textContent = 'День должен быть от 1 до 30'; return; }
  const g = gregOf(hijriJd(y, m, d) - hCorr());
  $('#hOut').textContent = `${g.d} ${MONTHS_GEN[g.m - 1]} ${g.y}, ${WEEKDAYS[weekday(g.y, g.m, g.d)]}`;
}
$('#gIn').addEventListener('input', convG);
['#hD', '#hM', '#hY'].forEach(s => $(s).addEventListener('input', convH));
(function initConv() {
  $('#gIn').value = `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`;
  const h = hijriOf(today.y, today.m, today.d);
  $('#hD').value = h.d; $('#hM').value = h.m; $('#hY').value = h.y;
  convG(); convH();
})();

// ---------- Запуск ----------
renderAll();
setInterval(() => {
  const was = today;
  today = partsIn(place.tz, new Date());
  if (!sameDay(was, today) && sameDay(viewDay, was)) { viewDay = { y: today.y, m: today.m, d: today.d }; viewMonth = { y: today.y, m: today.m }; renderAll(); }
  else { renderToday(); renderDay(); }
}, 30000);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
