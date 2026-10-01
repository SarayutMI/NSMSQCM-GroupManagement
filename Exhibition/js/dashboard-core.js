// Dashboard: shared state, date math, aggregation and chart renderers.
// Needs config.js + api.js. Rooms / names come from the Sheet, never from this file.

// ---------- constants ----------
const EXHIBIT_COLOR = "#2a78d6";
const EXTERNAL_COLOR = "#4a3aa7";
const ROLE_SERIES = [
  { role: ROLES[0], label: ROLES[0], color: "#2a78d6" },
  { role: ROLES[1], label: ROLES[1], color: "#eb6834" },
  { role: "", label: "ยังไม่ระบุ", color: "#9aa1ac" },
];
const ROLE_COLOR = Object.fromEntries(ROLE_SERIES.map((r) => [r.role, r.color]));
const TREND_LIMIT = { day: 31, week: 16, month: 12, year: 10 };
const BASE_FIELDS = [
  "walkin_grand_total", "group_grand_total", "exhibition_grand_total", "external_rooms_total", "summary_activity_total", "summary_AllDay_participants",
  "walkin_child_th_total", "walkin_adult_th_total", "walkin_child_intl_total", "walkin_adult_intl_total",
  "group_child_grand_total", "group_adult_grand_total", "exhibition_total_child", "exhibition_total_adult",
  "external_child", "external_adult",
];
// Count categories of the form (same suffixes as Code.gs COUNT_SUFFIXES). Groups and external
// activities only record child / adult, so their nationality split is unknown.
const NAT_COLS = [
  { key: "child_th", label: "เด็กไทย" },
  { key: "child_intl", label: "เด็กต่างชาติ" },
  { key: "adult_th", label: "ผู้ใหญ่ไทย" },
  { key: "adult_intl", label: "ผู้ใหญ่ต่างชาติ" },
];
const AGE_SERIES = [
  { key: "child", label: "เด็ก", color: "#e8a33d" },
  { key: "adult", label: "ผู้ใหญ่", color: "#2a78d6" },
];

// ---------- state ----------
let DAILY = [];
let SESSIONS = [];
let STAFF = [];
let ROOMS = []; // [{key, label, color, active}] from the Rooms tab
let FINANCE = []; // [{date, revenue: {channel: {section: amount}}}] from the E-Mod tab
const state = { view: "visitors", gran: "day", anchor: null, role: "all", room: "all", person: null, vmode: "area" };

// ---------- helpers ----------
const fmt = (n) => Math.round(n || 0).toLocaleString("th-TH");
const roleName = (r) => r || "ยังไม่ระบุ";

const roomField = (key) => key + "_rooms_total";
const roomLabel = (key) => (ROOMS.find((r) => r.key === key) || {}).label || key;
const roomColor = (key) => (ROOMS.find((r) => r.key === key) || {}).color || "#9aa1ac";
const roomPill = (key) => `<span class="pill"><i style="background:${esc(roomColor(key))}"></i>${esc(roomLabel(key))}</span>`;
const emptyRoomCounts = () => Object.fromEntries(ROOMS.map((r) => [r.key, 0]));
const fields = () => BASE_FIELDS.concat(...ROOMS.map((r) => [roomField(r.key), ...NAT_COLS.map((c) => `${r.key}_${c.key}_total`)]));

/** {child_th, child_intl, adult_th, adult_intl} of a room in an aggregated bucket. */
const roomNat = (b, key) => Object.fromEntries(NAT_COLS.map((c) => [c.key, b[`${key}_${c.key}_total`] || 0]));
const natChild = (n) => (n.child_th || 0) + (n.child_intl || 0);
const natAdult = (n) => (n.adult_th || 0) + (n.adult_intl || 0);
const walkinNat = (b) => Object.fromEntries(NAT_COLS.map((c) => [c.key, b[`walkin_${c.key}_total`] || 0]));

/** Child / adult over everything counted in a bucket: exhibition + every room + external. */
function ageTotals(b) {
  let child = (b.exhibition_total_child || 0) + (b.external_child || 0);
  let adult = (b.exhibition_total_adult || 0) + (b.external_adult || 0);
  ROOMS.forEach((r) => {
    const n = roomNat(b, r.key);
    child += natChild(n);
    adult += natAdult(n);
  });
  return { child, adult };
}
const ageSub = (child, adult) => `เด็ก ${fmt(child)} · ผู้ใหญ่ ${fmt(adult)}`;

function visitorSeries() {
  return [
    { key: "exhibition_grand_total", label: "นิทรรศการ", color: EXHIBIT_COLOR },
    ...ROOMS.map((r) => ({ key: roomField(r.key), label: r.label, color: r.color })),
    { key: "external_rooms_total", label: "กิจกรรมภายนอก", color: EXTERNAL_COLOR },
  ];
}

function setStatus(msg) {
  $("status").textContent = msg;
}

// ---------- dates (UTC math so the browser time zone never shifts a day) ----------
function parseD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtD(dt) {
  return dt.toISOString().slice(0, 10);
}
function weekStart(s) {
  const dt = parseD(s);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // Monday
  return fmtD(dt);
}
function bucketKey(s, g) {
  if (g === "day") return s;
  if (g === "week") return weekStart(s);
  if (g === "month") return s.slice(0, 7);
  if (g === "year") return s.slice(0, 4);
  return "all";
}
function shortDate(dt) {
  return dt.getUTCDate() + " " + TH_MONTHS_SHORT[dt.getUTCMonth()];
}
function bucketLabel(k, g) {
  if (g === "all") return "ข้อมูลทั้งหมด";
  if (g === "year") return "พ.ศ. " + (+k + 543);
  if (g === "month") {
    const [y, m] = k.split("-").map(Number);
    return TH_MONTHS[m - 1] + " " + (y + 543);
  }
  const dt = parseD(k);
  if (g === "day") return shortDate(dt) + " " + (dt.getUTCFullYear() + 543);
  const end = new Date(dt.getTime() + 6 * 864e5);
  const from = dt.getUTCMonth() === end.getUTCMonth() ? String(dt.getUTCDate()) : shortDate(dt);
  return "สัปดาห์ " + from + " – " + shortDate(end) + " " + (end.getUTCFullYear() + 543);
}
function tickLabel(k, g) {
  if (g === "day") return String(+k.slice(8));
  if (g === "week") return +k.slice(8) + "/" + +k.slice(5, 7);
  if (g === "month") return TH_MONTHS_SHORT[+k.slice(5, 7) - 1];
  return String(+k + 543);
}
const GRAN_NOUN = { day: "วัน", week: "สัปดาห์", month: "เดือน", year: "ปี" };

function trendGran() {
  return state.gran === "all" ? "month" : state.gran;
}
function periodKey() {
  return bucketKey(state.anchor, state.gran);
}
function inPeriod(dateStr) {
  return state.gran === "all" || bucketKey(dateStr, state.gran) === periodKey();
}
function allDates() {
  return [...new Set(DAILY.map((r) => r.date).concat(SESSIONS.map((s) => s.date), FINANCE.map((f) => f.date)))].sort();
}
function latestDateIn(key, g) {
  const ds = allDates().filter((d) => bucketKey(d, g) === key);
  return ds.length ? ds[ds.length - 1] : key.length === 10 ? key : null;
}

// ---------- aggregation ----------
function zero() {
  const o = { rounds: 0 };
  fields().forEach((f) => (o[f] = 0));
  return o;
}

function sumBuckets(buckets) {
  return buckets.reduce((acc, b) => {
    fields().forEach((f) => (acc[f] += b[f]));
    acc.rounds += b.rounds;
    return acc;
  }, zero());
}

function visitorBuckets(g) {
  const m = new Map();
  const get = (k) => {
    if (!m.has(k)) m.set(k, Object.assign({ key: k }, zero()));
    return m.get(k);
  };
  DAILY.forEach((r) => {
    const b = get(bucketKey(r.date, g));
    fields().forEach((f) => (b[f] += r[f] || 0));
  });
  SESSIONS.forEach((s) => (get(bucketKey(s.date, g)).rounds += 1));
  return [...m.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

function sessionMatches(s) {
  if (state.room !== "all" && s.room !== state.room) return false;
  if (state.role !== "all" && s.role !== state.role) return false;
  return true;
}

function trendWindow(keys, selKey, g) {
  const limit = TREND_LIMIT[g];
  let end = keys.length;
  const idx = keys.indexOf(selKey);
  if (idx !== -1 && idx < keys.length - limit) end = Math.min(keys.length, idx + Math.ceil(limit / 2));
  return keys.slice(Math.max(0, end - limit), end);
}

// ---------- charts ----------
function niceMax(v) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v / 4)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p * 4 >= v) return m * p * 4;
  return 10 * p * 4;
}

function roundedTop(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** buckets: [{key, tick, label, values:[per series], total}] */
function renderStacked(mount, buckets, series, selKey, unit) {
  if (!buckets.length || buckets.every((b) => !b.total)) {
    mount.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';
    return;
  }
  const chartH = 190, padTop = 24, padBottom = 24, gap = 2, left = 34;
  // fit all bars in the card when possible; otherwise keep a minimum slot and scroll
  const avail = mount.clientWidth || 600;
  const slot = Math.max(16, Math.min(36, (avail - left - 4) / buckets.length));
  const barW = Math.min(22, slot - 6);
  const gapW = slot - barW;
  const pad = Math.min(7, gapW / 2);
  const w = Math.max(left + buckets.length * slot + 4, 300);
  const h = chartH + padTop + padBottom;
  const base = padTop + chartH;
  const maxVal = Math.max(...buckets.map((b) => b.total), 1);
  const top = niceMax(maxVal);

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padTop + chartH * (1 - f);
      return `<line class="bar-gridline" x1="${left}" x2="${w}" y1="${y}" y2="${y}"></line><text class="bar-tick" x="0" y="${y + 3}">${fmt(top * f)}</text>`;
    })
    .join("");

  const maxIdx = buckets.reduce((best, b, i) => (b.total > buckets[best].total ? i : best), 0);

  const cols = buckets
    .map((b, i) => {
      const x = left + gapW / 2 + i * slot;
      let cum = 0;
      const lastNonZero = b.values.reduce((last, v, j) => (v > 0 ? j : last), -1);
      const segs = b.values
        .map((v, j) => {
          if (!v) return "";
          const segH = (v / top) * chartH;
          const y = base - cum - segH;
          const drawH = cum > 0 && segH > gap + 1 ? segH - gap : segH;
          cum += segH;
          const fill = series[j].color;
          return j === lastNonZero
            ? `<path d="${roundedTop(x, y, barW, drawH, 4)}" fill="${fill}"></path>`
            : `<rect x="${x}" y="${y}" width="${barW}" height="${drawH}" fill="${fill}"></rect>`;
        })
        .join("");
      const isSel = b.key === selKey;
      const topLabel = i === maxIdx && b.total ? `<text class="bar-toplabel" x="${x + barW / 2}" y="${base - cum - 6}" text-anchor="middle">${fmt(b.total)}</text>` : "";
      const tip = series.map((s, j) => `${s.label}: ${fmt(b.values[j])}`).join("|");
      return `<g class="bar-col" data-key="${esc(b.key)}" data-label="${esc(b.label)}" data-total="${b.total}" data-tip="${esc(tip)}">
        ${isSel ? `<rect class="sel-band" x="${x - pad}" y="${padTop - 6}" width="${barW + 2 * pad}" height="${chartH + padBottom + 6}" rx="6"></rect>` : `<rect class="hover-band" x="${x - pad}" y="${padTop - 6}" width="${barW + 2 * pad}" height="${chartH + padBottom + 6}" rx="6" fill="transparent"></rect>`}
        ${segs}${topLabel}
        <text class="bar-tick${isSel ? " sel" : ""}" x="${x + barW / 2}" y="${base + 15}" text-anchor="middle">${esc(b.tick)}</text>
      </g>`;
    })
    .join("");

  mount.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="กราฟแท่ง">${grid}${cols}</svg>`;
  mount.scrollLeft = mount.scrollWidth; // newest period is on the right
  mount.querySelectorAll(".bar-col").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const lines = el.dataset.tip.split("|").map((l) => esc(l)).join("<br>");
      showTooltip(e, esc(el.dataset.label), `${lines}<br><span class="v">รวม ${fmt(el.dataset.total)} ${unit}</span>`);
    });
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("click", () => pickBucket(el.dataset.key));
  });
}

/** Same input as renderStacked, but one bar per series side by side (easier to compare). */
function renderGrouped(mount, buckets, series, selKey, unit) {
  if (!buckets.length || buckets.every((b) => !b.total)) {
    mount.innerHTML = '<div class="empty">ยังไม่มีข้อมูล</div>';
    return;
  }
  const chartH = 190, padTop = 24, padBottom = 24, left = 40;
  const n = series.length;
  const avail = mount.clientWidth || 600;
  // one slot per bucket holds n bars + a gap; keep bars readable and scroll when they don't fit
  const slot = Math.max(n * 7 + 8, Math.min(n * 16 + 14, (avail - left - 4) / buckets.length));
  const barW = Math.max(5, Math.min(14, (slot - 8) / n));
  const groupW = barW * n;
  const pad = (slot - groupW) / 2;
  const w = Math.max(left + buckets.length * slot + 4, 300);
  const h = chartH + padTop + padBottom;
  const base = padTop + chartH;
  const maxVal = Math.max(...buckets.flatMap((b) => b.values), 1);
  const top = niceMax(maxVal);

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padTop + chartH * (1 - f);
      return `<line class="bar-gridline" x1="${left}" x2="${w}" y1="${y}" y2="${y}"></line><text class="bar-tick" x="0" y="${y + 3}">${fmt(top * f)}</text>`;
    })
    .join("");

  const cols = buckets
    .map((b, i) => {
      const x0 = left + i * slot + pad;
      const bars = b.values
        .map((v, j) => {
          if (!v) return "";
          const barH = Math.max((v / top) * chartH, 1);
          return `<path d="${roundedTop(x0 + j * barW, base - barH, barW - 1, barH, 3)}" fill="${series[j].color}"></path>`;
        })
        .join("");
      const isSel = b.key === selKey;
      const band = `<rect class="${isSel ? "sel-band" : "hover-band"}" x="${x0 - pad + 2}" y="${padTop - 6}" width="${slot - 4}" height="${chartH + padBottom + 6}" rx="6"${isSel ? "" : ' fill="transparent"'}></rect>`;
      const tip = series.map((s, j) => `${s.label}: ${fmt(b.values[j])}`).join("|");
      return `<g class="bar-col" data-key="${esc(b.key)}" data-label="${esc(b.label)}" data-total="${b.total}" data-tip="${esc(tip)}">
        ${band}${bars}
        <text class="bar-tick${isSel ? " sel" : ""}" x="${x0 + groupW / 2}" y="${base + 15}" text-anchor="middle">${esc(b.tick)}</text>
      </g>`;
    })
    .join("");

  mount.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="กราฟแท่งแยกกลุ่ม">${grid}${cols}</svg>`;
  mount.scrollLeft = mount.scrollWidth;
  mount.querySelectorAll(".bar-col").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const lines = el.dataset.tip.split("|").map((l) => esc(l)).join("<br>");
      showTooltip(e, esc(el.dataset.label), `${lines}<br><span class="v">รวม ${fmt(el.dataset.total)} ${unit}</span>`);
    });
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("click", () => pickBucket(el.dataset.key));
  });
}

function pickBucket(key) {
  const g = trendGran();
  const d = latestDateIn(key, g);
  if (!d) return;
  state.gran = g;
  state.anchor = d;
  render();
}

function renderLegend(mount, series) {
  mount.innerHTML = series.map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
}

function renderDonut(mount, rows, centerLabel) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) {
    mount.innerHTML = '<div class="empty">ไม่มีข้อมูลในช่วงนี้</div>';
    return;
  }
  const size = 168, r = 62, stroke = 26, gap = 3;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = rows
    .filter((row) => row.value > 0)
    .map((row) => {
      const pct = row.value / total;
      const len = Math.max(pct * c - gap, 0);
      const seg = `<circle class="donut-seg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${row.color}" stroke-width="${stroke}" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" data-label="${esc(row.label)}" data-value="${row.value}" data-pct="${(pct * 100).toFixed(1)}"></circle>`;
      offset += pct * c;
      return seg;
    })
    .join("");
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segs}
    <text x="${size / 2}" y="${size / 2 - 2}" text-anchor="middle" class="donut-total-val">${fmt(total)}</text>
    <text x="${size / 2}" y="${size / 2 + 15}" text-anchor="middle" class="donut-total-lbl">${esc(centerLabel)}</text></svg>`;
  const legend = rows
    .map((row) => {
      const pct = ((row.value / total) * 100).toFixed(1);
      return `<div class="legend-row"><span class="legend-dot" style="background:${row.color}"></span><span class="legend-name">${esc(row.label)}</span><span class="legend-val">${fmt(row.value)}</span><span class="legend-pct">${pct}%</span></div>`;
    })
    .join("");
  mount.innerHTML = `<div class="donut-wrap"><div>${svg}</div><div class="legend">${legend}</div></div>`;
  mount.querySelectorAll(".donut-seg").forEach((el) => {
    el.addEventListener("mousemove", (e) => showTooltip(e, el.dataset.label, `${fmt(el.dataset.value)} (${el.dataset.pct}%)`));
    el.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(e, label, html) {
  const tt = $("tooltip");
  tt.innerHTML = `${label}<br>${html}`;
  tt.style.left = e.clientX + 14 + "px";
  tt.style.top = e.clientY + 14 + "px";
  tt.style.opacity = "1";
}
function hideTooltip() {
  $("tooltip").style.opacity = "0";
}

function kpiTiles(tiles) {
  return tiles
    .map(
      (t) => `<div class="card kpi ${t.span || "span-2"}">
        <div class="lbl">${t.color ? `<span class="dot" style="background:${t.color}"></span>` : ""}${esc(t.lbl)}</div>
        <div class="val">${t.val}</div>
        ${t.sub ? `<div class="sub">${t.sub}</div>` : ""}
      </div>`,
    )
    .join("");
}

function table(head, rows, opts) {
  opts = opts || {};
  if (!rows.length) return '<div class="empty">ไม่มีข้อมูลในช่วงนี้</div>';
  const th = head.map((h, i) => `<th${i === 0 || (opts.left || []).includes(i) ? ' class="l"' : ""}>${h}</th>`).join("");
  const body = rows
    .map((r) => `<tr${r.attrs || ""}>${r.cells.map((c, i) => `<td${(opts.left || []).includes(i) ? ' class="l wrap"' : ""}>${c}</td>`).join("")}</tr>`)
    .join("");
  const foot = opts.foot ? `<tfoot><tr>${opts.foot.map((c) => `<td>${c}</td>`).join("")}</tr></tfoot>` : "";
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}

const rolePill = (r) => `<span class="pill"><i style="background:${ROLE_COLOR[r] || ROLE_COLOR[""]}"></i>${esc(roleName(r))}</span>`;
