// E-Mod Dashboard: สรุปรายงาน E-Mod ทุกวัน — รายได้, กรุ๊ป/โรงเรียน, ผู้เข้าชมแยกกลุ่ม, กิจกรรม, ทีม MOD
// ข้อมูลมาจาก Exhibition/Code.gs (action=emod ต้อง login) ซึ่งอ่านแท็บ EMod ของ Spreadsheet เดียวกัน
// ใช้ผู้ใช้/PIN และ token ชุดเดียวกับ Exhibition Dashboard (login หน้าไหนก็ใช้ได้ทั้งสองหน้า)
// โหลดหลัง Exhibition/js/config.js ($, esc, TH_MONTHS, WEBAPP_URL) และ Exhibition/js/api.js (jsonp, loginDashboard)

// ---------- ค่าคงที่ (ชุดเดียวกับ E-Mod-Script.js) ----------
const CATS = [
  { key: "childTh", label: "เด็กไทย" },
  { key: "childFor", label: "เด็กต่างชาติ" },
  { key: "adultTh", label: "ผู้ใหญ่ไทย" },
  { key: "adultFor", label: "ผู้ใหญ่ต่างชาติ" },
  { key: "senior", label: "ผู้สูงอายุ" },
];
const ROUND_CATS = ["childTh", "adultTh", "childFor", "adultFor"];
const CHANNELS = [
  { key: "walkinOnsite", label: "Walk-in : On-site" },
  { key: "walkinOnline", label: "Walk-in : Online" },
  { key: "groupOnsite", label: "Group : On-site" },
  { key: "groupOnline", label: "Group : Online" },
];
const SECTIONS = [
  { key: "inspireLab", label: "Inspire Lab" },
  { key: "innovationSpace", label: "Innovation space" },
  { key: "walkRally", label: "Walk Rally" },
  { key: "miniMakePlay", label: "Mini make & play" },
  { key: "dontMiss", label: "Don't Miss" },
  { key: "iScream", label: "I-Scream" },
  { key: "camp", label: "Camp" },
  { key: "workshop", label: "Workshop" },
  { key: "member", label: "Member" },
  { key: "other", label: "Other" },
];
const ROOMS = [
  { key: "inspireLab", label: "Inspire Lab" },
  { key: "innovationSpace", label: "Innovation Space" },
];
const MOD_ROLES = [
  { key: "mod", label: "MOD" },
  { key: "mExhibition", label: "M-Exhibition" },
  { key: "mEducation", label: "M-Education" },
  { key: "mVisitorService", label: "M-Visitor Service" },
];

let REPORTS = [];
const state = { gran: "month", key: null };
const AUTH_KEY = "exhibition.dashboard.auth"; // ชุดเดียวกับ Exhibition/js/dashboard.js
const CACHE_KEY = "emod.dashboard.data";

// ---------- helpers ----------
const n = (v) => Number(v) || 0;
const fmt = (v) => Math.round(n(v)).toLocaleString("th-TH-u-nu-latn");
const baht = (v) => n(v).toLocaleString("th-TH-u-nu-latn", { maximumFractionDigits: 2 });
const sumBy = (list, f) => list.reduce((a, x) => a + f(x), 0);
const setStatus = (msg, type) => {
  $("status").textContent = msg;
  if (window.NsmPopup) NsmPopup.show(msg, type);
};
function bucketKey(date, g) {
  if (g === "day") return date;
  if (g === "month") return date.slice(0, 7);
  if (g === "year") return date.slice(0, 4);
  return "all";
}
function bucketLabel(k, g) {
  if (g === "all") return "ข้อมูลทั้งหมด";
  if (g === "year") return "ปี พ.ศ. " + (Number(k) + 543);
  const [y, m, d] = k.split("-").map(Number);
  if (g === "month") return TH_MONTHS[m - 1] + " " + (y + 543);
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
}
const dayLabel = (date) => bucketLabel(date, "day");
function table(head, rows, opts) {
  opts = opts || {};
  if (!rows.length) return `<div class="empty">${esc(opts.empty || "ไม่มีข้อมูลในช่วงนี้")}</div>`;
  const left = opts.left || [0];
  const th = head.map((h, i) => `<th${left.includes(i) ? ' class="l"' : ""}>${h}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td${left.includes(i) ? ' class="l wrap"' : ""}>${c}</td>`).join("")}</tr>`).join("");
  const foot = opts.foot ? `<tfoot><tr>${opts.foot.map((c, i) => `<td${left.includes(i) ? ' class="l"' : ""}>${c}</td>`).join("")}</tr></tfoot>` : "";
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}
const barCell = (v, max, text) => `<div class="bar-cell"><i style="width:${max ? Math.round((v / max) * 100) : 0}%"></i><span>${text}</span></div>`;

// ---------- สรุปของรายงาน 1 วัน (ตรรกะเดียวกับ computeSummary ใน E-Mod-Script.js) ----------
function summaryOf(r) {
  const vc = r.visitorCounts || {}, ar = r.activityRounds || {};
  const row = (key, label, src) => {
    const o = { key, label };
    CATS.forEach((c) => (o[c.key] = n(src[c.key])));
    o.total = sumBy(CATS, (c) => o[c.key]);
    return o;
  };
  const rounds = (list) => (list || []).reduce((a, x) => {
    ROUND_CATS.forEach((c) => (a[c] = (a[c] || 0) + n(x[c])));
    return a;
  }, {});
  const rows = [
    row("exWalkin", "นิทรรศการ Walk-in", vc.exWalkin || {}),
    row("exGroup", "นิทรรศการ Group", vc.exGroup || {}),
    row("inspireLab", "Inspire Lab", rounds(ar.inspireLab)),
    row("innovationSpace", "Innovation Space", rounds(ar.innovationSpace)),
  ];
  (r.otherActivities || []).forEach((a) => {
    const src = {};
    ROUND_CATS.forEach((c) => (src[c] = n(a["w_" + c]) + n(a["g_" + c])));
    const name = String(a.name || "").trim() || "กิจกรรมอื่น";
    rows.push(row("other:" + name, name, src));
  });
  return rows;
}
const revTotal = (r) => sumBy(CHANNELS, (c) => sumBy(SECTIONS, (s) => n(((r.revenue || {})[c.key] || {})[s.key])));
const visitorsTotal = (r) => sumBy(summaryOf(r), (x) => x.total);
const groupsOf = (r) => ((r.visitorCounts || {}).groups || []);

// ---------- render ----------
function periodReports() {
  if (state.gran === "all") return REPORTS;
  return REPORTS.filter((r) => bucketKey(r.date, state.gran) === state.key);
}

function renderControls() {
  document.querySelectorAll("#gran-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.gran === state.gran));
  const sel = $("period");
  sel.disabled = state.gran === "all";
  if (state.gran === "all") {
    sel.innerHTML = "<option>ข้อมูลทั้งหมด</option>";
    return;
  }
  const keys = [...new Set(REPORTS.map((r) => bucketKey(r.date, state.gran)))].sort().reverse();
  if (!keys.includes(state.key)) state.key = keys[0] || null;
  sel.innerHTML = keys.map((k) => `<option value="${esc(k)}"${k === state.key ? " selected" : ""}>${esc(bucketLabel(k, state.gran))}</option>`).join("");
}

// ---------- กราฟ (ไม่พึ่งไลบรารี) — ทุกการ์ดสลับ ตาราง / กราฟแท่ง / กราฟวงกลม ได้ในการ์ดเดียว ----------
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#8a5cd6", "#d6457a", "#20a4c9", "#b45309", "#0f766e", "#a21caf", "#65a30d", "#6b7280"];
const views = {}; // card id -> "table" | "bar" | "pie"
const VIEW_LABELS = [["table", "ตาราง"], ["bar", "กราฟแท่ง"], ["pie", "กราฟวงกลม"]];
const color = (i) => PALETTE[i % PALETTE.length];

/** แท่งแนวนอน: เรียงมากไปน้อย แสดงสูงสุด 15 รายการ (ที่เหลือรวมเป็น "อื่นๆ") */
function hBars(items, fv) {
  let list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  if (list.length > 15) list = list.slice(0, 14).concat([{ label: `อื่นๆ (${list.length - 14} รายการ)`, value: sumBy(list.slice(14), (x) => x.value) }]);
  if (!list.length) return '<div class="empty">ไม่มีข้อมูลสำหรับกราฟในช่วงนี้</div>';
  const max = list[0].value;
  return `<div class="hbars">${list.map((x, i) => `<div class="hb-row" title="${esc(x.label)}: ${esc(fv(x.value))}">
      <span class="hb-label">${esc(x.label)}</span>
      <span class="hb-track"><i style="width:${Math.max(1, (x.value / max) * 100)}%;background:${color(i)}"></i></span>
      <span class="hb-val">${esc(fv(x.value))}</span></div>`).join("")}</div>`;
}
/** แท่งแนวตั้งตามลำดับเวลา (รายวัน) */
function vBars(items, fv) {
  if (!items.some((x) => x.value > 0)) return '<div class="empty">ไม่มีข้อมูลสำหรับกราฟในช่วงนี้</div>';
  const max = Math.max(...items.map((x) => x.value));
  return `<div class="vbars">${items.map((x) => `<div class="vb-col" title="${esc(x.label)}: ${esc(fv(x.value))}">
      <span class="vb-val">${x.value ? esc(fv(x.value)) : ""}</span>
      <span class="vb-bar" style="height:${max ? Math.max(x.value ? 2 : 0, (x.value / max) * 100) : 0}%"></span>
      <span class="vb-label">${esc(x.short || x.label)}</span></div>`).join("")}</div>`;
}
/** วงกลม (donut) + คำอธิบายสัดส่วน */
function pie(items, fv) {
  let list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  if (list.length > 10) list = list.slice(0, 9).concat([{ label: `อื่นๆ (${list.length - 9} รายการ)`, value: sumBy(list.slice(9), (x) => x.value) }]);
  const total = sumBy(list, (x) => x.value);
  if (!total) return '<div class="empty">ไม่มีข้อมูลสำหรับกราฟในช่วงนี้</div>';
  const R = 70, C = 2 * Math.PI * R;
  let off = 0;
  const segs = list.map((x, i) => {
    const len = (x.value / total) * C;
    const seg = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${color(i)}" stroke-width="34" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(x.label)}: ${esc(fv(x.value))}</title></circle>`;
    off += len;
    return seg;
  }).join("");
  return `<div class="pie-wrap"><svg viewBox="0 0 180 180" width="180" height="180" role="img">${segs}
      <text x="90" y="88" text-anchor="middle" class="pie-total">${esc(fv(total))}</text><text x="90" y="106" text-anchor="middle" class="pie-sub">รวม</text></svg>
    <div class="pie-legend">${list.map((x, i) => `<div><i style="background:${color(i)}"></i><span>${esc(x.label)}</span><b>${esc(fv(x.value))}</b><small>${((x.value / total) * 100).toFixed(1)}%</small></div>`).join("")}</div></div>`;
}

/** วาดการ์ด: หัวการ์ด + ปุ่มสลับมุมมอง + เนื้อหาตามมุมมองที่เลือก
    cfg: { table, bars: [{label,value,short?}], pie?: [...], fv, vertical? }  (ไม่มี bars = ตารางอย่างเดียว) */
function card(id, title, cfg) {
  $(id + "-title").innerHTML = title;
  const head = $(id + "-title").parentElement;
  let sw = head.querySelector(".view-switch");
  const charts = !!cfg.bars;
  if (charts && !sw) {
    head.insertAdjacentHTML("beforeend", `<div class="tabs view-switch" data-card="${id}">${VIEW_LABELS.map(([v, l]) => `<button class="tab" type="button" data-v="${v}">${l}</button>`).join("")}</div>`);
    sw = head.querySelector(".view-switch");
  }
  const v = charts ? views[id] || "table" : "table";
  if (sw) sw.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.v === v));
  const fv = cfg.fv || fmt;
  $(id).innerHTML = v === "bar" ? (cfg.vertical ? vBars(cfg.bars, fv) : hBars(cfg.bars, fv)) : v === "pie" ? pie(cfg.pie || cfg.bars, fv) : cfg.table;
}

function render() {
  renderControls();
  const list = periodReports();
  const label = state.gran === "all" ? "ข้อมูลทั้งหมด" : state.key ? bucketLabel(state.key, state.gran) : "-";
  const tag = (t) => `${t}<span class="n">${esc(label)}</span>`;

  // ---- KPI ----
  const groups = list.flatMap((r) => groupsOf(r).map((g) => Object.assign({ date: r.date }, g)));
  const schools = new Set(groups.map((g) => String(g.school || "").trim()).filter(Boolean));
  const rev = sumBy(list, revTotal);
  const vis = sumBy(list, visitorsTotal);
  const roundsN = (key) => sumBy(list, (r) => ((r.activityRounds || {})[key] || []).length);
  const issues = list.flatMap((r) => (r.evening || []).filter((e) => String(e.issues || "").trim() || String(e.notes || "").trim()).map((e) => Object.assign({ date: r.date }, e)));
  $("kpi").innerHTML = [
    { lbl: "รายงาน", val: fmt(list.length), sub: "วัน" },
    { lbl: "ผู้เข้าชมรวม", val: fmt(vis), sub: list.length ? `เฉลี่ย ${fmt(vis / list.length)} คน/วัน` : "" },
    { lbl: "รายได้รวม", val: baht(rev), sub: list.length ? `บาท · เฉลี่ย ${baht(rev / list.length)}/วัน` : "บาท" },
    { lbl: "กรุ๊ป", val: fmt(groups.length), sub: `${fmt(schools.size)} โรงเรียน/หน่วยงาน · ${fmt(sumBy(groups, (g) => sumBy(CATS, (c) => n(g[c.key]))))} คน` },
    { lbl: "รอบ Lab / Inno", val: `${fmt(roundsN("inspireLab"))} / ${fmt(roundsN("innovationSpace"))}`, sub: "Inspire Lab / Innovation Space" },
    { lbl: "ปัญหา/ข้อเสนอแนะ", val: fmt(issues.length), sub: "รายการจาก Evening Briefing" },
  ].map((k) => `<div class="card kpi span-2"><div class="lbl">${esc(k.lbl)}</div><div class="val">${k.val}</div><div class="sub">${esc(k.sub)}</div></div>`).join("");

  // ---- รายได้รายวัน (แบ่งตามช่องทาง) ----
  const days = list.slice().reverse();
  const maxRev = Math.max(0, ...days.map(revTotal));
  const chanOf = (r, c) => sumBy(SECTIONS, (s) => n(((r.revenue || {})[c.key] || {})[s.key]));
  card("rev-day", tag("รายได้รายวัน (บาท)"), {
    fv: baht,
    vertical: true,
    bars: list.map((r) => ({ label: dayLabel(r.date), short: String(Number(r.date.slice(8))), value: revTotal(r) })),
    pie: CHANNELS.map((c) => ({ label: c.label, value: sumBy(list, (r) => chanOf(r, c)) })),
    table: table(
      ["วันที่", ...CHANNELS.map((c) => esc(c.label)), "รวม"],
      days.map((r) => [`<a class="day-link" href="E-Mod.html?date=${esc(r.date)}">${esc(dayLabel(r.date))}</a>`, ...CHANNELS.map((c) => baht(chanOf(r, c))), barCell(revTotal(r), maxRev, `<b>${baht(revTotal(r))}</b>`)]),
      { foot: ["รวม", ...CHANNELS.map((c) => baht(sumBy(list, (r) => chanOf(r, c)))), `<b>${baht(rev)}</b>`] },
    ),
  });

  // ---- รายได้แยกส่วนงาน × ช่องทาง ----
  const cell = (s, c) => sumBy(list, (r) => n(((r.revenue || {})[c.key] || {})[s.key]));
  const secRows = SECTIONS.map((s) => ({ s, vals: CHANNELS.map((c) => cell(s, c)) })).map((x) => Object.assign(x, { total: sumBy(x.vals, (v) => v) }));
  card("rev-sec", tag("รายได้แยกตามส่วนงาน (บาท)"), {
    fv: baht,
    bars: secRows.map((x) => ({ label: x.s.label, value: x.total })),
    table: table(
      ["ส่วนงาน", ...CHANNELS.map((c) => esc(c.label)), "รวม", "สัดส่วน"],
      secRows.map((x) => [esc(x.s.label), ...x.vals.map(baht), `<b>${baht(x.total)}</b>`, rev ? ((x.total / rev) * 100).toFixed(1) + "%" : "–"]),
      { foot: ["รวม", ...CHANNELS.map((c) => baht(sumBy(SECTIONS, (s) => cell(s, c)))), `<b>${baht(rev)}</b>`, ""] },
    ),
  });

  // ---- กรุ๊ปที่มา ----
  const gTotal = (g) => sumBy(CATS, (c) => n(g[c.key]));
  const bySchool = new Map();
  groups.forEach((g) => {
    const k = String(g.school || "").trim() || "(ไม่ระบุชื่อ)";
    bySchool.set(k, (bySchool.get(k) || 0) + gTotal(g));
  });
  card("groups", tag(`กรุ๊ปที่มา · ${fmt(groups.length)} กรุ๊ป · ${fmt(schools.size)} โรงเรียน/หน่วยงาน`), {
    bars: [...bySchool].map(([label, value]) => ({ label, value })),
    table: table(
      ["วันที่", "โรงเรียน / หน่วยงาน", ...CATS.map((c) => c.label), "รวม"],
      groups.slice().reverse().map((g) => [esc(dayLabel(g.date)), esc(String(g.school || "").trim() || "(ไม่ระบุชื่อ)"), ...CATS.map((c) => fmt(g[c.key])), `<b>${fmt(gTotal(g))}</b>`]),
      { left: [0, 1], empty: "ไม่มีกรุ๊ปในช่วงนี้ (กรุ๊ปมาจากตาราง \"จำนวนกรุ๊ป\" ใน E-Mod)", foot: ["รวม", `${fmt(groups.length)} กรุ๊ป`, ...CATS.map((c) => fmt(sumBy(groups, (g) => n(g[c.key])))), `<b>${fmt(sumBy(groups, gTotal))}</b>`] },
    ),
  });

  // ---- ผู้เข้าชมแยกกลุ่ม ----
  const agg = new Map();
  list.forEach((r) => summaryOf(r).forEach((row) => {
    if (!agg.has(row.key)) agg.set(row.key, Object.assign({ label: row.label }, Object.fromEntries(CATS.map((c) => [c.key, 0])), { total: 0 }));
    const a = agg.get(row.key);
    CATS.forEach((c) => (a[c.key] += row[c.key]));
    a.total += row.total;
  }));
  const aggRows = [...agg.values()].filter((a) => a.total || !a.label.startsWith("กิจกรรมอื่น"));
  const kidAdult = (a) => [a.childTh + a.childFor, a.adultTh + a.adultFor + a.senior];
  const all = Object.fromEntries(CATS.map((c) => [c.key, sumBy(aggRows, (a) => a[c.key])]));
  all.total = sumBy(aggRows, (a) => a.total);
  card("visitors", tag("ผู้เข้าชมแยกกลุ่ม"), {
    bars: aggRows.map((a) => ({ label: a.label, value: a.total })),
    pie: CATS.map((c) => ({ label: c.label, value: all[c.key] })), // วงกลม: สัดส่วนเด็ก/ผู้ใหญ่ ไทย/ต่างชาติ
    table: table(
      ["กลุ่ม", ...CATS.map((c) => c.label), "เด็กรวม", "ผู้ใหญ่รวม", "รวม"],
      aggRows.map((a) => [esc(a.label), ...CATS.map((c) => fmt(a[c.key])), ...kidAdult(a).map(fmt), `<b>${fmt(a.total)}</b>`]),
      { foot: ["รวมทั้งหมด", ...CATS.map((c) => fmt(all[c.key])), ...kidAdult(all).map(fmt), `<b>${fmt(all.total)}</b>`] },
    ),
  });

  // ---- กิจกรรมอื่นๆ Walk-in / Group ----
  const oth = new Map();
  list.forEach((r) => (r.otherActivities || []).forEach((a) => {
    const name = String(a.name || "").trim() || "กิจกรรมอื่น";
    if (!oth.has(name)) oth.set(name, { name, w: 0, g: 0, days: new Set() });
    const o = oth.get(name);
    const w = sumBy(ROUND_CATS, (c) => n(a["w_" + c])), gg = sumBy(ROUND_CATS, (c) => n(a["g_" + c]));
    o.w += w;
    o.g += gg;
    if (w + gg) o.days.add(r.date);
  }));
  const othRows = [...oth.values()].filter((o) => o.w + o.g);
  card("other", tag("กิจกรรมอื่นๆ (Walk-in / Group)"), {
    bars: othRows.map((o) => ({ label: o.name, value: o.w + o.g })),
    table: table(
      ["กิจกรรม", "Walk-in", "Group", "รวม", "จำนวนวันที่มี"],
      othRows.sort((a, b) => b.w + b.g - (a.w + a.g)).map((o) => [esc(o.name), fmt(o.w), fmt(o.g), `<b>${fmt(o.w + o.g)}</b>`, fmt(o.days.size)]),
      { foot: ["รวม", fmt(sumBy(othRows, (o) => o.w)), fmt(sumBy(othRows, (o) => o.g)), `<b>${fmt(sumBy(othRows, (o) => o.w + o.g))}</b>`, ""] },
    ),
  });

  // ---- รอบกิจกรรม Inspire / Innovation ----
  const act = new Map();
  const leaders = new Map();
  const schoolUse = new Map();
  list.forEach((r) => ROOMS.forEach((room) => ((r.activityRounds || {})[room.key] || []).forEach((x) => {
    const name = String(x.activity || "").trim() || "(ไม่ได้เลือกกิจกรรม)";
    const k = room.key + "|" + name;
    const people = sumBy(ROUND_CATS, (c) => n(x[c]));
    if (!act.has(k)) act.set(k, { room: room.label, name, rounds: 0, people: 0 });
    act.get(k).rounds += 1;
    act.get(k).people += people;
    const ld = String(x.leader || "").trim();
    if (ld) {
      if (!leaders.has(ld)) leaders.set(ld, { name: ld, rounds: 0, people: 0, rooms: new Set() });
      const L = leaders.get(ld);
      L.rounds += 1;
      L.people += people;
      L.rooms.add(room.label);
    }
    const sc = String(x.school || "").trim();
    if (sc) {
      if (!schoolUse.has(sc)) schoolUse.set(sc, { name: sc, rounds: 0, people: 0, days: new Set() });
      const S = schoolUse.get(sc);
      S.rounds += 1;
      S.people += people;
      S.days.add(r.date);
    }
  })));
  const fRounds = (v) => fmt(v) + " รอบ";
  card("rounds", tag("Inspire Lab / Innovation Space (ตามกิจกรรม)"), {
    fv: fRounds,
    bars: [...act.values()].map((a) => ({ label: a.name, value: a.rounds })),
    pie: ROOMS.map((room) => ({ label: room.label, value: sumBy([...act.values()].filter((a) => a.room === room.label), (a) => a.rounds) })),
    table: table(["กิจกรรม", "ห้อง", "รอบ", "ผู้เข้าร่วม"], [...act.values()].sort((a, b) => b.rounds - a.rounds).map((a) => [esc(a.name), esc(a.room), fmt(a.rounds), fmt(a.people)]), { left: [0, 1] }),
  });
  card("schools", tag("โรงเรียนที่เข้าร่วมกิจกรรม (จากตารางรอบ)"), {
    fv: fRounds,
    bars: [...schoolUse.values()].map((s) => ({ label: s.name, value: s.rounds })),
    table: table(["โรงเรียน", "รอบ", "ผู้เข้าร่วม", "วัน"], [...schoolUse.values()].sort((a, b) => b.rounds - a.rounds).map((s) => [esc(s.name), fmt(s.rounds), fmt(s.people), fmt(s.days.size)]), { empty: "ไม่มีชื่อโรงเรียนในตารางรอบกิจกรรมของช่วงนี้" }),
  });
  card("leaders", tag("ผู้ดำเนินกิจกรรม"), {
    fv: fRounds,
    bars: [...leaders.values()].map((l) => ({ label: l.name, value: l.rounds })),
    table: table(["ชื่อ", "ห้อง", "รอบ", "ผู้เข้าร่วม"], [...leaders.values()].sort((a, b) => b.rounds - a.rounds).map((l) => [esc(l.name), esc([...l.rooms].join(", ")), fmt(l.rounds), fmt(l.people)]), { left: [0, 1] }),
  });

  // ---- ทีม MOD ----
  const team = new Map();
  list.forEach((r) => MOD_ROLES.forEach((role) => {
    const who = String(r[role.key] || "").trim();
    if (!who) return;
    if (!team.has(who)) team.set(who, Object.assign({ name: who }, Object.fromEntries(MOD_ROLES.map((x) => [x.key, 0]))));
    team.get(who)[role.key] += 1;
  }));
  const teamRows = [...team.values()].map((t) => Object.assign(t, { total: sumBy(MOD_ROLES, (r) => t[r.key]) })).sort((a, b) => b.total - a.total);
  card("team", tag("ทีม MOD (จำนวนวัน)"), {
    fv: (v) => fmt(v) + " วัน",
    bars: teamRows.map((t) => ({ label: t.name, value: t.total })),
    table: table(["ชื่อ", ...MOD_ROLES.map((r) => r.label), "รวม"], teamRows.map((t) => [esc(t.name), ...MOD_ROLES.map((r) => fmt(t[r.key])), `<b>${fmt(t.total)}</b>`])),
  });

  // ---- ปัญหาและข้อเสนอแนะ (Evening Briefing) ----
  const q = ($("issue-search").value || "").trim().toLowerCase();
  const shownIssues = issues.filter((x) => !q || [x.zone, x.duty, x.issues, x.notes, x.volunteers].join(" ").toLowerCase().includes(q));
  const byZone = new Map();
  issues.forEach((x) => byZone.set(x.zone || "(ไม่ระบุ Zone)", (byZone.get(x.zone || "(ไม่ระบุ Zone)") || 0) + 1));
  card("issues", tag(`ปัญหาและข้อเสนอแนะ · ${fmt(issues.length)} รายการ`), {
    fv: (v) => fmt(v) + " รายการ",
    bars: [...byZone].map(([label, value]) => ({ label, value })),
    table: table(
      ["วันที่", "Zone", "ปัญหาและข้อเสนอแนะ", "หมายเหตุ", "อาสา"],
      shownIssues.slice().reverse().map((x) => [`<a class="day-link" href="E-Mod.html?date=${esc(x.date)}">${esc(dayLabel(x.date))}</a>`, esc(x.zone || "-"), esc(x.issues || "-"), esc(x.notes || "-"), esc(x.volunteers || "-")]),
      { left: [0, 1, 2, 3, 4], empty: q ? "ไม่พบรายการที่ค้นหา" : "ไม่มีปัญหา/ข้อเสนอแนะในช่วงนี้" },
    ),
  });

  // ---- รายงานรายวัน ----
  card("days", tag("รายงานรายวัน"), {
    table: table(
      ["วันที่", "MOD", "ผู้เข้าชม", "รายได้ (บาท)", "กรุ๊ป", "กิจกรรมพิเศษ", "ผู้ลงชื่อ / ผู้บันทึก"],
      days.map((r) => [
        `<a class="day-link" href="E-Mod.html?date=${esc(r.date)}">${esc(dayLabel(r.date))}</a>`,
        esc(r.mod || "-"), fmt(visitorsTotal(r)), baht(revTotal(r)), fmt(groupsOf(r).length),
        esc((r.specialActivities || []).join(", ") || "-"), esc([r.signer, r.recorder].filter(Boolean).join(" / ") || "-"),
      ]),
      { left: [0, 1, 5, 6] },
    ),
  });
}

// ---------- login + data ----------
function readAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; }
}
function writeAuth(a) {
  try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY); } catch (e) { /* storage blocked */ }
  auth = a;
}
let auth = readAuth();
function readCache() {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && auth && c.user === auth.user ? c.reports : null; } catch (e) { return null; }
}
function writeCache(reports) {
  try { reports ? localStorage.setItem(CACHE_KEY, JSON.stringify({ user: auth.user, at: Date.now(), reports })) : localStorage.removeItem(CACHE_KEY); } catch (e) { /* storage เต็ม/ถูกปิด */ }
}
function showLogin(msg) {
  $("login").hidden = false;
  $("user-box").hidden = true;
  $("login-error").textContent = msg || "";
  $("login-pin").value = "";
  ($("login-user").value ? $("login-pin") : $("login-user")).focus();
}
let loaded = false;

async function loadData(fresh) {
  if (!auth || !auth.token) return showLogin();
  $("user-name").textContent = "👤 " + (auth.user || "");
  $("user-box").hidden = false;
  if (!loaded) {
    const cached = readCache();
    if (cached) { REPORTS = cached; loaded = true; render(); }
  }
  setStatus(loaded ? "กำลังอัปเดตข้อมูล..." : "กำลังโหลดข้อมูล E-Mod...", loaded ? "none" : undefined);
  try {
    const data = await jsonp(Object.assign({ action: "emod", token: auth.token }, fresh ? { fresh: 1 } : {}), 45000);
    if (data.error === "unauthorized") {
      writeAuth(null);
      writeCache(null);
      setStatus("", "none");
      return showLogin("หมดเวลาเข้าระบบ กรุณาเข้าสู่ระบบใหม่");
    }
    if (data.error) throw new Error(data.error);
    if (!Array.isArray(data.reports)) throw new Error("ข้อมูลไม่ตรงรูปแบบ (Deploy Exhibition/Code.gs เวอร์ชันใหม่แล้วหรือยัง)");
    const first = !loaded;
    REPORTS = data.reports;
    loaded = true;
    writeCache(REPORTS);
    render();
    setStatus("อัปเดตล่าสุด " + new Date().toLocaleTimeString("th-TH-u-nu-latn"), first ? "success" : "none");
  } catch (err) {
    setStatus(err.message + (loaded ? " (กำลังแสดงข้อมูลล่าสุดที่เก็บไว้ในเครื่อง)" : ""), "error");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".view-switch [data-v]");
    if (!b) return;
    views[b.closest(".view-switch").dataset.card] = b.dataset.v;
    render();
  });
  $("issue-search").addEventListener("input", render);
  $("gran-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-gran]");
    if (!b) return;
    state.gran = b.dataset.gran;
    state.key = null;
    render();
  });
  $("period").addEventListener("change", (e) => {
    state.key = e.target.value;
    render();
  });
  $("status").title = "คลิกเพื่อดึงข้อมูลล่าสุดจาก Sheet";
  $("status").style.cursor = "pointer";
  $("status").addEventListener("click", () => loadData(true));
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("login-btn").disabled) return; // กดซ้ำระหว่างรอ
    try {
      const res = await loginWithProgress($("login-user").value.trim(), $("login-pin").value.trim());
      writeAuth({ token: res.token, user: res.user });
      $("login").hidden = true;
      $("login-progress").textContent = "";
      loadData();
    } catch (err) {
      $("login-error").textContent = err.message;
      $("login-pin").value = "";
      $("login-pin").focus();
    }
  });
  $("logout-btn").addEventListener("click", () => {
    writeAuth(null);
    writeCache(null);
    REPORTS = [];
    loaded = false;
    render();
    showLogin();
  });
  render();
  loadData();
});
