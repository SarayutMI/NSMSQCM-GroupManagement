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
function itemStatus(it) {
  const q = Number(it.qty) || 0;
  const min = Number(it.minQty) || 0;
  if (q <= 0) return "out";
  if (min > 0 && q <= min) return "low";
  return "ok";
}
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
  ITEMS = (data.items || []).map((i) => Object.assign(i, { qty: Number(i.qty) || 0, minQty: Number(i.minQty) || 0 }));
  ITEMS.sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
  LOCATIONS = (data.locations || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
  LOG = data.log || [];
  if (ui.selectedLocId && !locById(ui.selectedLocId)) ui.selectedLocId = null;
  if (ui.focusItemId && !itemById(ui.focusItemId)) ui.focusItemId = null;
  $("categoryList").innerHTML = categories().map((c) => `<option value="${esc(c)}"></option>`).join("");
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

const locOptions = (selected, blankLabel) =>
  `<option value="">${esc(blankLabel || "- ไม่ระบุตำแหน่ง -")}</option>` +
  LOCATIONS.map((l) => `<option value="${esc(l.id)}"${l.id === selected ? " selected" : ""}>${esc(l.name)}${l.zone ? " · " + esc(l.zone) : ""}</option>`).join("");

// ---------- item actions ----------
/** preset: ค่าตั้งต้นของรายการใหม่ เช่น {barcode} จากการสแกนที่ไม่พบในระบบ */
function openItemForm(id, preset) {
  const it = id ? itemById(id) : Object.assign({ name: "", category: "", unit: "ชิ้น", qty: 0, minQty: 0, locationId: ui.selectedLocId || "", locationNote: "", note: "", imageUrl: "", barcode: "", code: "" }, preset || {});
  if (!it) return;
  openModal(
    id ? "แก้ไขรายการ" : "เพิ่มของใหม่",
    `<label>รหัส<input name="code" maxlength="50" value="${esc(it.code || "")}" placeholder="เช่น IS-001" autocapitalize="characters"></label>
     <label>ชื่อสิ่งของ *<input name="name" required maxlength="200" value="${esc(it.name)}"></label>
     <label>หมวดหมู่<input name="category" list="categoryList" value="${esc(it.category)}" placeholder="เลือกหรือพิมพ์ใหม่"></label>
     <label>หน่วย<input name="unit" value="${esc(it.unit)}" placeholder="ชิ้น / กล่อง / แพ็ค"></label>
     <label>จำนวนคงเหลือ<input name="qty" type="text" inputmode="none" data-num autocomplete="off" value="${esc(it.qty)}"></label>
     <label>จำนวนขั้นต่ำ (แจ้งเตือนเมื่อเหลือเท่านี้)<input name="minQty" type="text" inputmode="none" data-num autocomplete="off" value="${esc(it.minQty)}"></label>
     <label>ตำแหน่งจัดเก็บ<select name="locationId">${locOptions(it.locationId)}</select></label>
     <label>รายละเอียดตำแหน่ง<input name="locationNote" value="${esc(it.locationNote)}" placeholder="เช่น ชั้น 2 กล่องสีฟ้า"></label>
     <label class="f-full">บาร์โค้ด (ถ้ามี)
       <span class="with-btn"><input name="barcode" id="fBarcode" inputmode="numeric" value="${esc(it.barcode || "")}" placeholder="สแกน / ยิง / พิมพ์เลข"><button type="button" class="btn" data-scan-into="fBarcode">📷 สแกน</button></span></label>
     <label class="f-full">ลิงก์รูป (ถ้ามี)<input name="imageUrl" type="url" value="${esc(it.imageUrl)}" placeholder="https://..."></label>
     <label class="f-full">หมายเหตุ<textarea name="note" rows="2">${esc(it.note)}</textarea></label>`,
    async (v) => {
      if (!v.name.trim()) return setStatus("กรุณาใส่ชื่อสิ่งของ", "warn");
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
    `<p class="f-full muted">คงเหลือในระบบ <b>${fmtQty(it.qty)} ${esc(it.unit)}</b></p>
     <label>ประเภท<select name="type"><option value="out">เบิกออก (−)</option><option value="in">รับเข้า (+)</option></select></label>
     <label>จำนวน<input name="amount" type="text" inputmode="none" data-num autocomplete="off" required></label>
     <label class="f-full">หมายเหตุ / ใช้กับกิจกรรมอะไร<input name="note" placeholder="เช่น กิจกรรม Gear Box รอบเช้า"></label>`,
    async (v) => {
      const amount = Number(v.amount);
      if (!(amount > 0)) return setStatus("กรุณาใส่จำนวนที่มากกว่า 0", "warn");
      const ok = await run({ action: "adjust", id: id, delta: v.type === "in" ? amount : -amount, note: v.note }, "กำลังบันทึก...", v.type === "in" ? "รับเข้าแล้ว" : "เบิกออกแล้ว");
      if (ok) closeModal();
    },
  );
}

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
    setStatus(`พบ "${it.name}" คงเหลือ ${fmtQty(it.qty)} ${it.unit || ""}`, "success");
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
