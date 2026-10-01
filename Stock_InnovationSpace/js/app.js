// สถานะของหน้า, ตัวช่วย, modal และคำสั่งเขียนข้อมูล — ใช้ร่วมกันทุกแท็บ (views.js / plan.js)

let ITEMS = [];
let LOCATIONS = [];
let LOG = [];
const ui = { view: "overview", focusItemId: null, selectedLocId: null, placingLocId: null };
const USER_KEY = "stock.innovation.user";

// ---------- helpers ----------
const fmtQty = (n) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const locById = (id) => LOCATIONS.find((l) => l.id === id) || null;
const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
const locName = (id) => (locById(id) || {}).name || "";
const normCode = (v) => String(v == null ? "" : v).replace(/\s+/g, "");
/** หาด้วยบาร์โค้ด หรือรหัสสิ่งของ (ตัวพิมพ์เล็ก/ใหญ่ไม่สำคัญ) */
const itemByBarcode = (code) => {
  const c = normCode(code).toUpperCase();
  return c ? ITEMS.find((i) => normCode(i.barcode).toUpperCase() === c || normCode(i.code).toUpperCase() === c) || null : null;
};

/** "out" = หมด, "low" = ใกล้หมด (ถึงขั้นต่ำ), "ok" = ปกติ */
/** สถานะดูจาก Stock (ของที่มีจริงในคลัง) — Ready คือส่วนที่ดึงออกไปแล้ว ไม่นับเป็นของในคลัง */
function itemStatus(it) {
  const q = piles(it).stock;
  const min = Number(it.minQty) || 0;
  if (q <= 0) return "out";
  if (min > 0 && q <= min) return "low";
  return "ok";
}
/** 2 กอง: Stock = ของที่มีจริงในคลัง, Ready = ดึงออกจาก Stock ไปเตรียมใช้แล้ว (เก็บในคอลัมน์ standbyQty)
    qty ใน Sheet = Stock + Ready */
const piles = (it) => ({ stock: Math.round(((Number(it.qty) || 0) - (it.standbyQty || 0)) * 100) / 100, standby: it.standbyQty || 0 });
const stockOf = (it) => piles(it).stock;
const PILE_NAME = { stock: "Stock", standby: "Ready" };
/** ข้อความจาก Sheet (log เก่า/ใหม่) ใช้ชื่อ Standby — แสดงเป็น Ready */
const readyText = (s) => String(s == null ? "" : s).replace(/ย้ายไป Standby/g, "ดึงออกไป Ready").replace(/ย้ายไป Stock/g, "คืนเข้า Stock").replace(/Standby/g, "Ready");
const pileText = (it) => {
  const p = piles(it);
  return `<span class="pile pile-stock">Stock ${fmtQty(p.stock)}</span><span class="pile pile-standby">Ready ${fmtQty(p.standby)}</span>`;
};
const STATUS_LABEL = { out: "หมด", low: "ใกล้หมด", ok: "ปกติ" };
const statusPill = (s) => `<span class="pill pill-${s}">${STATUS_LABEL[s]}</span>`;
const needsRefill = (it) => itemStatus(it) !== "ok";

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return esc(iso);
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function categories() {
  return [...new Set(STOCK_CONFIG.CATEGORIES.concat(ITEMS.map((i) => String(i.category || "").trim()).filter(Boolean)))];
}

/** ข้อความรวมของรายการไว้ใช้ค้นหา */
function itemHaystack(it) {
  const loc = locById(it.locationId) || {};
  return [it.name, it.category, it.unit, it.note, it.locationNote, loc.name, loc.zone, it.id, it.barcode, it.code].join(" ").toLowerCase();
}
function matchText(it, q) {
  q = String(q || "").trim().toLowerCase();
  return !q || q.split(/\s+/).every((w) => itemHaystack(it).includes(w));
}

function setStatus(msg, type) {
  if (window.NsmPopup) NsmPopup.show(msg, type);
}

// ---------- ผู้ทำรายการ ----------
function currentUser() {
  return $("userSelect").value;
}
function requireUser() {
  if (currentUser()) return true;
  setStatus("กรุณาเลือก \"ผู้ทำรายการ\" ที่มุมขวาบนก่อน", "warn");
  $("userSelect").focus();
  return false;
}
function fillUsers(names) {
  let saved = "";
  try {
    saved = localStorage.getItem(USER_KEY) || "";
  } catch (e) {
    /* storage blocked */
  }
  const list = names.slice();
  if (saved && !list.includes(saved)) list.push(saved);
  $("userSelect").innerHTML = '<option value="">- เลือกชื่อ -</option>' + list.map((n) => `<option${n === saved ? " selected" : ""}>${esc(n)}</option>`).join("");
}

// ---------- data ----------
function applyState(data) {
  ITEMS = (data.items || []).map((i) => {
    const qty = Number(i.qty) || 0;
    return Object.assign(i, { qty: qty, minQty: Number(i.minQty) || 0, standbyQty: Math.min(qty, Math.max(0, Number(i.standbyQty) || 0)) });
  });
  ITEMS.sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
  LOCATIONS = (data.locations || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
  LOG = data.log || [];
  if (ui.selectedLocId && !locById(ui.selectedLocId)) ui.selectedLocId = null;
  if (ui.focusItemId && !itemById(ui.focusItemId)) ui.focusItemId = null;
  render();
}

async function reload(quiet) {
  if (!quiet) setStatus("กำลังโหลดข้อมูลสต๊อกจาก Sheet...");
  try {
    applyState(await fetchState());
    if (!quiet) setStatus("", "none");
  } catch (err) {
    setStatus("โหลดข้อมูลไม่สำเร็จ: " + err.message, "error");
  }
}

/** ส่งคำสั่งเขียน + แสดง popup ระหว่างรอ; คืน true เมื่อสำเร็จ */
async function run(body, busyMsg, doneMsg) {
  if (!requireUser()) return false;
  setStatus(busyMsg || "กำลังบันทึก...");
  try {
    applyState(await postAction(body));
    setStatus(doneMsg || "บันทึกลง Sheet แล้ว", "success");
    return true;
  } catch (err) {
    setStatus("บันทึกไม่สำเร็จ: " + err.message, "error");
    return false;
  }
}

// ---------- modal ----------
let modalSubmit = null;
function openModal(title, bodyHtml, onSubmit, submitLabel) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = bodyHtml;
  $("modalSubmit").textContent = submitLabel || "บันทึก";
  modalSubmit = onSubmit;
  $("modal").hidden = false;
  const first = $("modalBody").querySelector("input, select, textarea");
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() {
  $("modal").hidden = true;
  modalSubmit = null;
  StockNumpad.close();
  const ghost = $("planGhost");
  if (ghost) ghost.hidden = true;
}
function formValues() {
  const o = {};
  $("modalBody").querySelectorAll("[name]").forEach((el) => (o[el.name] = el.value));
  return o;
}

// หมวดหมู่เป็น dropdown จริง (datalist ไม่แสดงบน iPhone/iPad) + ตัวเลือกเพิ่มหมวดใหม่
const NEW_CATEGORY = "__new__";
const categoryOptions = (selected) =>
  '<option value="">- ไม่ระบุหมวด -</option>' +
  categories().map((c) => `<option value="${esc(c)}"${c === selected ? " selected" : ""}>${esc(c)}</option>`).join("") +
  `<option value="${NEW_CATEGORY}">＋ เพิ่มหมวดใหม่...</option>`;

const locOptions = (selected, blankLabel) =>
  `<option value="">${esc(blankLabel || "- ไม่ระบุตำแหน่ง -")}</option>` +
  LOCATIONS.map((l) => `<option value="${esc(l.id)}"${l.id === selected ? " selected" : ""}>${esc(l.name)}${l.zone ? " · " + esc(l.zone) : ""}</option>`).join("");

// ---------- item actions ----------
/** preset: ค่าตั้งต้นของรายการใหม่ เช่น {barcode} จากการสแกนที่ไม่พบในระบบ */
function openItemForm(id, preset) {
  const it = id ? itemById(id) : Object.assign({ name: "", category: "", unit: "ชิ้น", qty: 0, minQty: 0, locationId: ui.selectedLocId || "", locationNote: "", note: "", imageUrl: "", barcode: "", code: "", standbyQty: 0 }, preset || {});
  const p = piles(it);
  if (!it) return;
  openModal(
    id ? "แก้ไขรายการ" : "เพิ่มของใหม่",
    `<label class="f-full">ชื่อสิ่งของ *<input name="name" required maxlength="200" value="${esc(it.name)}"></label>
     <label>รหัส<input name="code" maxlength="50" value="${esc(it.code || "")}" placeholder="เช่น IS-001" autocapitalize="characters"></label>
     <label>หน่วย<input name="unit" value="${esc(it.unit)}" placeholder="ชิ้น / กล่อง"></label>
     <label class="f-full">หมวดหมู่<select name="category" id="fCategorySel">${categoryOptions(it.category)}</select></label>
     <label class="f-full" id="fCategoryNewBox" hidden>ชื่อหมวดหมู่ใหม่<input name="categoryNew" id="fCategoryNew" maxlength="100" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่"></label>
     <label>Stock (มีจริงในคลัง)<input name="stockQty" type="text" inputmode="none" data-num autocomplete="off" value="${esc(p.stock)}"></label>
     <label>Ready (ดึงออกจาก Stock)<input name="standbyQty" type="text" inputmode="none" data-num autocomplete="off" value="${esc(p.standby)}"></label>
     <label>ขั้นต่ำ (เตือนเมื่อ Stock เหลือ)<input name="minQty" type="text" inputmode="none" data-num autocomplete="off" value="${esc(it.minQty)}"></label>
     <p class="muted pile-sum">ทั้งหมด (Stock + Ready) <b id="fQtySum">${fmtQty(it.qty)}</b> ${esc(it.unit || "")}</p>
     <label class="f-full">ตำแหน่งจัดเก็บ<select name="locationId">${locOptions(it.locationId)}</select></label>
     <label class="f-full">รายละเอียดตำแหน่ง<input name="locationNote" value="${esc(it.locationNote)}" placeholder="เช่น ชั้น 2 กล่องสีฟ้า"></label>
     <label class="f-full">บาร์โค้ด (ถ้ามี)
       <span class="with-btn"><input name="barcode" id="fBarcode" inputmode="numeric" value="${esc(it.barcode || "")}" placeholder="สแกน / ยิง / พิมพ์เลข"><button type="button" class="btn" data-scan-into="fBarcode">📷 สแกน</button></span></label>
     <label class="f-full">ลิงก์รูป (ถ้ามี)<input name="imageUrl" type="url" value="${esc(it.imageUrl)}" placeholder="https://..."></label>
     <label class="f-full">หมายเหตุ<textarea name="note" rows="2">${esc(it.note)}</textarea></label>`,
    async (v) => {
      if (!v.name.trim()) return setStatus("กรุณาใส่ชื่อสิ่งของ", "warn");
      if (v.category === NEW_CATEGORY) {
        v.category = v.categoryNew.trim();
        if (!v.category) return setStatus("กรุณาพิมพ์ชื่อหมวดหมู่ใหม่ (หรือเลือกหมวดที่มีอยู่)", "warn");
      }
      delete v.categoryNew;
      const ok = await run({ action: "saveItem", data: Object.assign(v, { id: id || "" }) }, "กำลังบันทึกรายการ...", id ? "แก้ไขรายการแล้ว" : "เพิ่มของใหม่แล้ว");
      if (ok) closeModal();
    },
  );
}

function deleteItem(id) {
  const it = itemById(id);
  if (!it || !requireUser()) return;
  if (!confirm(`ลบ "${it.name}" ออกจากระบบ?\n(ประวัติการเคลื่อนไหวยังเก็บไว้)`)) return;
  if (ui.focusItemId === id) ui.focusItemId = null;
  run({ action: "deleteItem", id: id }, "กำลังลบ...", "ลบรายการแล้ว");
}

function quickAdjust(id, delta) {
  run({ action: "adjust", id: id, delta: delta, note: "ปุ่ม " + (delta > 0 ? "+" : "−") }, "กำลังปรับจำนวน...", "ปรับจำนวนแล้ว");
}

function openAdjustForm(id) {
  const it = itemById(id);
  if (!it) return;
  openModal(
    `รับเข้า / เบิกออก — ${it.name}`,
    `<p class="f-full muted">${pileText(it)} <span class="sub">ทั้งหมด ${fmtQty(it.qty)} ${esc(it.unit)}</span></p>
     <label>ประเภท<select name="type"><option value="out">เบิกออก (−)</option><option value="in">รับเข้า (+)</option></select></label>
     <label>กอง<select name="pile"><option value="stock">Stock (ในคลัง)</option><option value="standby">Ready (ที่ดึงออกไป)</option></select></label>
     <label>จำนวน<input name="amount" type="text" inputmode="none" data-num autocomplete="off" required></label>
     <label class="f-full">หมายเหตุ / ใช้กับกิจกรรมอะไร<input name="note" placeholder="เช่น กิจกรรม Gear Box รอบเช้า"></label>`,
    async (v) => {
      const amount = Number(v.amount);
      if (!(amount > 0)) return setStatus("กรุณาใส่จำนวนที่มากกว่า 0", "warn");
      const p = piles(it);
      if (v.type === "out" && amount > p[v.pile]) return setStatus(`ใน ${PILE_NAME[v.pile]} มีแค่ ${fmtQty(p[v.pile])}`, "warn");
      const ok = await run({ action: "adjust", id: id, delta: v.type === "in" ? amount : -amount, pile: v.pile, note: v.note }, "กำลังบันทึก...", v.type === "in" ? "รับเข้าแล้ว" : "เบิกออกแล้ว");
      if (ok) closeModal();
    },
  );
}

/** ดึงออกจาก Stock ไป Ready / คืน Ready เข้า Stock (ทั้งหมดเท่าเดิม) */
function openMoveForm(id, to) {
  const it = itemById(id);
  if (!it) return;
  const p = piles(it);
  to = to || (p.stock > 0 ? "standby" : "stock");
  openModal(
    `ดึงออก / คืน Stock — ${it.name}`,
    `<p class="f-full muted">${pileText(it)}</p>
     <label class="f-full">ย้าย<select name="to">
       <option value="standby"${to === "standby" ? " selected" : ""}>ดึงออกจาก Stock → Ready</option>
       <option value="stock"${to === "stock" ? " selected" : ""}>คืน Ready → เข้า Stock</option></select></label>
     <label>จำนวน<input name="amount" ${'type="text" inputmode="none" data-num autocomplete="off"'} required></label>
     <label>หมายเหตุ<input name="note" placeholder="เช่น เตรียมกิจกรรมรอบบ่าย"></label>`,
    async (v) => {
      const amount = Number(v.amount);
      if (!(amount > 0)) return setStatus("กรุณาใส่จำนวนที่มากกว่า 0", "warn");
      const from = v.to === "standby" ? "stock" : "standby";
      if (amount > p[from]) return setStatus(`ใน ${PILE_NAME[from]} มีแค่ ${fmtQty(p[from])}`, "warn");
      const ok = await run({ action: "move", id: id, amount: amount, to: v.to, note: v.note }, "กำลังบันทึก...", v.to === "standby" ? "ดึงออกไป Ready แล้ว" : "คืนเข้า Stock แล้ว");
      if (ok) closeModal();
    },
    "ย้าย",
  );
}

/** ย้ายตำแหน่งจัดเก็บ */
function openRelocateForm(id) {
  const it = itemById(id);
  if (!it) return;
  openModal(
    `ย้ายตำแหน่ง — ${it.name}`,
    `<p class="f-full muted">ตอนนี้อยู่ที่ <b>${esc(locName(it.locationId) || "ไม่ระบุ")}</b>${it.locationNote ? " · " + esc(it.locationNote) : ""}</p>
     <label class="f-full">ย้ายไปตำแหน่ง<select name="locationId">${locOptions(it.locationId)}</select></label>
     <label class="f-full">รายละเอียดตำแหน่งใหม่<input name="locationNote" value="${esc(it.locationNote)}" placeholder="เช่น ชั้น 2 กล่องสีฟ้า"></label>`,
    async (v) => {
      if (v.locationId === (it.locationId || "") && v.locationNote === (it.locationNote || "")) return closeModal();
      const ok = await run({ action: "relocate", id: id, locationId: v.locationId, locationNote: v.locationNote }, "กำลังย้ายตำแหน่ง...", `ย้าย "${it.name}" แล้ว`);
      if (ok) {
        closeModal();
        if (ui.focusItemId === id) ui.selectedLocId = v.locationId || null;
        if (ui.view === "plan") renderPlan();
      }
    },
    "ย้าย",
  );
}

/** เมนูจัดการ (การ์ดผลค้นหา / ผัง) */
const manageButtons = (id) => `
  <button class="btn btn-small" data-move="${esc(id)}">รับ / เบิก</button>
  <button class="btn btn-small" data-pile-move="${esc(id)}">ดึงออก / คืน Stock</button>
  <button class="btn btn-small" data-relocate="${esc(id)}">📍 ย้ายตำแหน่ง</button>
  <button class="btn btn-small" data-edit="${esc(id)}">แก้ไข</button>`;

// ---------- location actions ----------
/** preset: {x, y} เมื่อเพิ่มจากการคลิกบนผังตรงจุดนั้น */
function openLocationForm(id, preset) {
  const l = id ? locById(id) : Object.assign({ name: "", zone: "", note: "", x: "", y: "" }, preset || {});
  if (!l) return;
  openModal(
    id ? "แก้ไขตำแหน่งจัดเก็บ" : preset ? "เพิ่มตำแหน่งจัดเก็บตรงจุดที่คลิก" : "เพิ่มตำแหน่งจัดเก็บ",
    `<label>ชื่อตำแหน่ง *<input name="name" required value="${esc(l.name)}" placeholder="เช่น ตู้ A1"></label>
     <label>โซน / ฝั่งห้อง<input name="zone" value="${esc(l.zone)}" placeholder="เช่น ฝั่งหน้าต่าง"></label>
     <label class="f-full">หมายเหตุ<input name="note" value="${esc(l.note)}"></label>
     <p class="f-full muted">${l.x !== "" && l.x != null ? `วางบนผังแล้วที่ (${fmtQty(l.x)}%, ${fmtQty(l.y)}%)` : "ยังไม่ได้วางบนผัง"} · บันทึกแล้วกด 📌 ในตารางเพื่อวาง/ย้ายจุดบนผัง</p>`,
    async (v) => {
      if (!v.name.trim()) return setStatus("กรุณาใส่ชื่อตำแหน่ง", "warn");
      const ok = await run({ action: "saveLocation", data: Object.assign(v, { id: id || "", x: l.x, y: l.y }) }, "กำลังบันทึกตำแหน่ง...", "บันทึกตำแหน่งแล้ว");
      if (ok) closeModal();
    },
  );
}

function deleteLocation(id) {
  const l = locById(id);
  if (!l || !requireUser()) return;
  if (!confirm(`ลบตำแหน่ง "${l.name}"?`)) return;
  run({ action: "deleteLocation", id: id }, "กำลังลบตำแหน่ง...", "ลบตำแหน่งแล้ว");
}

function savePlacement(id, x, y) {
  const l = locById(id);
  if (!l) return;
  run({ action: "saveLocation", data: Object.assign({}, l, { x: x, y: y }) }, "กำลังบันทึกจุดบนผัง...", `วาง "${l.name}" บนผังแล้ว`);
}

// ---------- barcode ----------
/** ค้นหาด้วยบาร์โค้ด: เจอ = ชี้ตำแหน่งบนผัง, ไม่เจอ = ถามว่าจะเพิ่มเป็นของใหม่ไหม */
function openByBarcode(code) {
  code = normCode(code);
  if (!code) return;
  const it = itemByBarcode(code);
  if (it) {
    focusItem(it.id);
    setStatus(`พบ "${it.name}" Stock ${fmtQty(stockOf(it))} · Ready ${fmtQty(piles(it).standby)} ${it.unit || ""}`, "success");
    return;
  }
  if (confirm(`ไม่พบบาร์โค้ด ${code} ในระบบ\nต้องการเพิ่มเป็นของใหม่หรือไม่?`)) openItemForm(null, { barcode: code });
}

/** ตรวจนับ: สแกนแล้วกระโดดไปช่องนับของรายการนั้น */
function countByBarcode(code) {
  const it = itemByBarcode(code);
  if (!it) return setStatus(`ไม่พบบาร์โค้ด ${normCode(code)} ในระบบ`, "warn");
  $("cLocation").value = "";
  $("cText").value = "";
  renderCount();
  const input = document.querySelector(`[data-count="${CSS.escape(it.id)}"]`);
  if (!input) return;
  input.closest("tr").classList.add("picked");
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus();
  setStatus(`"${it.name}" — กรอกจำนวนที่นับได้`, "info");
}

// ---------- navigation ----------
function showView(view) {
  ui.view = view;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Live point: เปิดผังแล้วชี้จุดตำแหน่งของรายการนี้ */
function focusItem(id) {
  const it = itemById(id);
  if (!it) return;
  ui.focusItemId = id;
  ui.selectedLocId = it.locationId || null;
  showView("plan");
}

function render() {
  document.querySelectorAll("#viewTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.view === ui.view));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + ui.view));
  if (ui.view === "overview") renderOverview();
  else if (ui.view === "items") renderItems();
  else if (ui.view === "count") renderCount();
  else if (ui.view === "plan") renderPlan();
  else renderLog();
}
