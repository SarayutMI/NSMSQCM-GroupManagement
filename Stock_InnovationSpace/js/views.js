// แท็บ ภาพรวม / รายการทั้งหมด / ตรวจนับ / ประวัติ (ผังห้องอยู่ใน plan.js)

function table(head, rows, empty) {
  if (!rows.length) return `<div class="empty">${esc(empty || "ไม่มีข้อมูล")}</div>`;
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

const locLink = (it) => {
  const loc = locById(it.locationId);
  if (!loc) return '<span class="muted">ไม่ระบุ</span>';
  return `<button class="link" data-focus="${esc(it.id)}" title="ดูบนผังห้อง">📍 ${esc(loc.name)}</button>${it.locationNote ? `<div class="sub">${esc(it.locationNote)}</div>` : ""}`;
};

// ---------- ภาพรวม ----------
function renderOverview() {
  const out = ITEMS.filter((i) => itemStatus(i) === "out");
  const low = ITEMS.filter((i) => itemStatus(i) === "low");
  const placed = LOCATIONS.filter((l) => l.x !== "" && l.x != null).length;
  $("kpis").innerHTML = [
    { lbl: "รายการทั้งหมด", val: ITEMS.length, sub: `${categories().filter((c) => ITEMS.some((i) => i.category === c)).length} หมวดหมู่`, go: "" },
    { lbl: "หมด", val: out.length, cls: "kpi-out", sub: "Stock เหลือ 0", go: "out" },
    { lbl: "ใกล้หมด", val: low.length, cls: "kpi-low", sub: "Stock เหลือถึงขั้นต่ำ", go: "low" },
    { lbl: "ตำแหน่งจัดเก็บ", val: LOCATIONS.length, sub: `วางบนผังแล้ว ${placed}`, plan: true },
  ]
    .map(
      (k) => `<button class="kpi ${k.cls || ""}" ${k.plan ? 'data-goto="plan"' : `data-goto="items" data-status="${k.go}"`}>
        <span class="lbl">${esc(k.lbl)}</span><span class="val">${fmtQty(k.val)}</span><span class="sub">${esc(k.sub)}</span></button>`,
    )
    .join("");

  const need = out.concat(low);
  $("needCount").textContent = need.length ? `(${need.length})` : "";
  $("needTable").innerHTML = table(
    ["สิ่งของ", "Stock / ขั้นต่ำ", "ต้องเติมอย่างน้อย", "ตำแหน่ง"],
    need.map(
      (it) => `<tr>
        <td><b>${esc(it.name)}</b><div class="sub">${esc(it.category)}</div></td>
        <td class="num">${statusPill(itemStatus(it))} ${fmtQty(stockOf(it))} / ${fmtQty(it.minQty)} ${esc(it.unit)}${piles(it).standby ? `<div class="sub">Ready ${fmtQty(piles(it).standby)}</div>` : ""}</td>
        <td class="num">${fmtQty(Math.max((Number(it.minQty) || 0) - stockOf(it), stockOf(it) <= 0 ? 1 : 0))} ${esc(it.unit)}</td>
        <td>${locLink(it)}</td></tr>`,
    ),
    "ไม่มีของที่ต้องเติม 🎉",
  );

  $("recentLog").innerHTML = LOG.length
    ? `<ul class="feed">${LOG.slice(0, 10).map((l) => `<li>${actionPill(l.action)} <b>${esc(l.itemName)}</b> ${deltaText(l.delta)}<span class="sub">${esc(l.by)} · ${fmtTime(l.timestamp)}</span></li>`).join("")}</ul>`
    : '<div class="empty">ยังไม่มีความเคลื่อนไหว</div>';

  const byCat = new Map();
  ITEMS.forEach((it) => {
    const c = it.category || "ไม่ระบุหมวด";
    if (!byCat.has(c)) byCat.set(c, { n: 0, out: 0, low: 0 });
    const b = byCat.get(c);
    b.n += 1;
    if (itemStatus(it) === "out") b.out += 1;
    if (itemStatus(it) === "low") b.low += 1;
  });
  $("catTable").innerHTML = table(
    ["หมวดหมู่", "รายการ", "หมด", "ใกล้หมด"],
    [...byCat.entries()].sort((a, b) => b[1].n - a[1].n).map(([c, b]) => `<tr><td>${esc(c)}</td><td class="num">${b.n}</td><td class="num ${b.out ? "t-out" : ""}">${b.out}</td><td class="num ${b.low ? "t-low" : ""}">${b.low}</td></tr>`),
    "ยังไม่มีรายการของ — กด \"รายการทั้งหมด\" > ＋ เพิ่มของ",
  );
}

// ---------- รายการทั้งหมด ----------
function fillFilterSelects() {
  const keep = (id) => $(id).value;
  const cat = keep("fCategory"), loc = keep("fLocation"), cloc = keep("cLocation");
  $("fCategory").innerHTML = '<option value="">ทุกหมวดหมู่</option>' + categories().map((c) => `<option${c === cat ? " selected" : ""}>${esc(c)}</option>`).join("");
  $("fLocation").innerHTML = locOptions(loc, "ทุกตำแหน่ง") + `<option value="__none"${loc === "__none" ? " selected" : ""}>(ยังไม่ระบุตำแหน่ง)</option>`;
  $("cLocation").innerHTML = locOptions(cloc, "ทุกตำแหน่ง") + `<option value="__none"${cloc === "__none" ? " selected" : ""}>(ยังไม่ระบุตำแหน่ง)</option>`;
}

function filteredItems() {
  const q = $("fText").value, cat = $("fCategory").value, loc = $("fLocation").value, st = $("fStatus").value;
  return ITEMS.filter((it) => {
    if (!matchText(it, q)) return false;
    if (cat && it.category !== cat) return false;
    if (loc === "__none" ? locById(it.locationId) : loc && it.locationId !== loc) return false;
    const s = itemStatus(it);
    if (st === "low" && s === "ok") return false;
    if (st && st !== "low" && s !== st) return false;
    return true;
  });
}

function renderItems() {
  fillFilterSelects();
  const list = filteredItems();
  $("itemsCount").textContent = `(${list.length} จาก ${ITEMS.length})`;
  $("itemsTable").innerHTML = table(
    ["สิ่งของ", "Stock (มีจริง)", "ขั้นต่ำ", "สถานะ", "ตำแหน่ง", "อัปเดตล่าสุด", ""],
    list.map(
      (it) => `<tr class="${ui.focusItemId === it.id ? "picked" : ""}">
        <td>${it.code ? `<span class="code item-code">${esc(it.code)}</span> ` : ""}<b>${esc(it.name)}</b><div class="sub">${esc(it.category || "")}${it.barcode ? ` · <span class="code">▮ ${esc(it.barcode)}</span>` : ""}${it.note ? " · " + esc(it.note) : ""}</div></td>
        <td class="qty-cell"><div class="stepper">
          <button class="step" data-adjust="${esc(it.id)}" data-delta="-1" ${stockOf(it) <= 0 ? "disabled" : ""} aria-label="ลด Stock 1">−</button>
          <span class="q">${fmtQty(stockOf(it))} <small>${esc(it.unit)}</small></span>
          <button class="step" data-adjust="${esc(it.id)}" data-delta="1" aria-label="เพิ่ม 1">+</button></div>
          <div class="piles"><span class="pile pile-standby">Ready ${fmtQty(piles(it).standby)}</span><span class="sub">ทั้งหมด ${fmtQty(it.qty)}</span></div></td>
        <td class="num">${fmtQty(it.minQty)}</td>
        <td>${statusPill(itemStatus(it))}</td>
        <td>${locLink(it)}</td>
        <td class="sub">${fmtTime(it.updatedAt)}<br>${esc(it.updatedBy || "")}</td>
        <td class="actions">
          <button class="btn btn-small" data-move="${esc(it.id)}" title="รับเข้า / เบิกออก หลายชิ้น">รับ/เบิก</button>
          <button class="btn btn-small" data-pile-move="${esc(it.id)}" title="ดึงออกจาก Stock ไป Ready / คืนเข้า Stock">ดึงออก/คืน</button>
          <button class="btn btn-small" data-edit="${esc(it.id)}">แก้ไข</button>
          <button class="btn btn-small btn-danger" data-del="${esc(it.id)}">ลบ</button>
        </td></tr>`,
    ),
    ITEMS.length ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีรายการของ — กด ＋ เพิ่มของ",
  );
}

// ---------- ตรวจนับ ----------
const countDraft = {}; // id -> {stock, standby} ที่กรอก (string) เก็บไว้แม้สลับแท็บ; ช่องว่าง = ยังไม่ได้นับ

function renderCount() {
  fillFilterSelects();
  const loc = $("cLocation").value, q = $("cText").value;
  const list = ITEMS.filter((it) => matchText(it, q) && (loc === "__none" ? !locById(it.locationId) : !loc || it.locationId === loc));
  // จัดกลุ่มตามตำแหน่ง เดินนับทีละจุดได้ง่าย
  const groups = new Map();
  list.forEach((it) => {
    const k = locName(it.locationId) || "(ยังไม่ระบุตำแหน่ง)";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  });
  const rows = [];
  [...groups.keys()].sort((a, b) => a.localeCompare(b, "th")).forEach((k) => {
    rows.push(`<tr class="group-row"><td colspan="5">📍 ${esc(k)} <span class="sub">(${groups.get(k).length} รายการ)</span></td></tr>`);
    groups.get(k).forEach((it) => {
      const d = countDraft[it.id] || {};
      const p = piles(it);
      const inp = (pile) => `<input class="count-in" type="text" inputmode="none" data-num autocomplete="off" data-count="${esc(it.id)}" data-pile="${pile}" value="${esc(d[pile] ?? "")}" placeholder="${PILE_NAME[pile]}">`;
      rows.push(`<tr>
        <td>${it.code ? `<span class="code item-code">${esc(it.code)}</span> ` : ""}<b>${esc(it.name)}</b><div class="sub">${esc(it.locationNote || it.category || "")}</div></td>
        <td class="num">Stock ${fmtQty(p.stock)} ${esc(it.unit)}<div class="sub">Ready ${fmtQty(p.standby)}</div></td>
        <td class="count-cells">${inp("stock")}${inp("standby")}</td>
        <td class="num diff" data-diff="${esc(it.id)}">${diffText(it, d)}</td>
        <td>${statusPill(itemStatus(it))}</td></tr>`);
    });
  });
  $("countTable").innerHTML = table(["สิ่งของ", "ในระบบ", "นับได้จริง", "ส่วนต่าง", "สถานะ"], rows, "ไม่มีรายการ");
  updateCountButton();
}

const filled = (v) => v !== undefined && v !== null && v !== "";
/** ยอดรวมหลังนับ: กองที่ไม่ได้กรอกใช้ค่าในระบบ */
function countedTotal(it, d) {
  const p = piles(it);
  return (filled(d.stock) ? Number(d.stock) : p.stock) + (filled(d.standby) ? Number(d.standby) : p.standby);
}
function diffText(it, d) {
  d = d || {};
  if (!filled(d.stock) && !filled(d.standby)) return '<span class="muted">–</span>';
  const v = countedTotal(it, d);
  const p = piles(it);
  const ds = filled(d.stock) ? Math.round((Number(d.stock) - p.stock) * 100) / 100 : 0;
  const db = filled(d.standby) ? Math.round((Number(d.standby) - p.standby) * 100) / 100 : 0;
  if (!ds && !db) return '<span class="t-ok">ตรง</span>';
  if (Math.round((v - it.qty) * 100) === 0) return '<span class="t-low">ทั้งหมดตรง แต่ Stock/Ready ต่าง</span>';
  const d2 = Math.round((v - it.qty) * 100) / 100;
  return `<span class="${d2 < 0 ? "t-out" : "t-in"}">${d2 > 0 ? "+" : ""}${fmtQty(d2)}</span>`;
}
function countEntries() {
  return Object.keys(countDraft)
    .filter((id) => itemById(id) && (filled(countDraft[id].stock) || filled(countDraft[id].standby)))
    .map((id) => {
      const d = countDraft[id], e = { id: id };
      if (filled(d.stock)) e.stock = Number(d.stock);
      if (filled(d.standby)) e.standby = Number(d.standby);
      return e;
    });
}
function updateCountButton() {
  const n = countEntries().length;
  $("countSaveBtn").textContent = n ? `บันทึกผลนับ (${n} รายการ)` : "บันทึกผลนับ";
  $("countSaveBtn").disabled = !n;
}
async function saveCount() {
  const counts = countEntries();
  if (!counts.length) return;
  const changed = counts.filter((c) => Math.round((countedTotal(itemById(c.id), c) - itemById(c.id).qty) * 100) !== 0).length;
  if (!confirm(`บันทึกผลนับ ${counts.length} รายการ (ยอดต่างจากในระบบ ${changed} รายการ)?`)) return;
  const ok = await run({ action: "count", counts: counts }, "กำลังบันทึกผลนับ...", "บันทึกผลนับแล้ว");
  if (ok) {
    counts.forEach((c) => delete countDraft[c.id]);
    render();
  }
}

// ---------- ประวัติ ----------
const ACTION_CLASS = { เพิ่มใหม่: "in", รับเข้า: "in", เบิกออก: "out", ลบ: "out", ตรวจนับ: "count", แก้ไข: "edit", "ย้ายไป Standby": "move", "ย้ายไป Stock": "move", ย้ายตำแหน่ง: "move" };
const actionPill = (a) => `<span class="pill pill-act-${ACTION_CLASS[a] || "edit"}">${esc(readyText(a))}</span>`;
function deltaText(d) {
  d = Number(d) || 0;
  if (!d) return "";
  return `<span class="${d < 0 ? "t-out" : "t-in"}">${d > 0 ? "+" : ""}${fmtQty(d)}</span>`;
}

function renderLog() {
  const q = $("lText").value.trim().toLowerCase(), act = $("lAction").value;
  const list = LOG.filter((l) => (!act || l.action === act) && (!q || [l.itemName, l.by, l.note, l.itemId].join(" ").toLowerCase().includes(q)));
  $("logTable").innerHTML = table(
    ["เวลา", "สิ่งของ", "ประเภท", "เปลี่ยน", "ทั้งหมดหลังทำรายการ", "ผู้ทำรายการ", "หมายเหตุ"],
    list.map(
      (l) => `<tr><td class="sub">${fmtTime(l.timestamp)}</td>
        <td>${itemById(l.itemId) ? `<button class="link" data-focus="${esc(l.itemId)}">${esc(l.itemName)}</button>` : esc(l.itemName)}</td>
        <td>${actionPill(l.action)}</td><td class="num">${deltaText(l.delta) || "–"}</td><td class="num">${fmtQty(l.qtyAfter)}</td>
        <td>${esc(l.by)}</td><td class="sub">${esc(readyText(l.note))}</td></tr>`,
    ),
    "ยังไม่มีประวัติ",
  );
}
