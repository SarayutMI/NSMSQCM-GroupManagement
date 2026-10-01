/**
 * Google Apps Script backend for ระบบสต๊อก Innovation Space.
 *
 * ใช้ Spreadsheet เดียวกับระบบ Group Management (จองห้อง) — เพิ่มแท็บของตัวเอง 3 แท็บ (สร้างให้อัตโนมัติ):
 *   Stock_Items      id | name | category | unit | qty | minQty | locationId | locationNote | note | imageUrl | createdAt | updatedAt | updatedBy | barcode | code | standbyQty
 *                    (qty = ยอดรวม, standbyQty = กอง Standby พร้อมใช้หน้างาน, Stock = qty - standbyQty)
 *   Stock_Locations  id | name | zone | x | y | note        (x, y = ตำแหน่งบนผังห้อง หน่วย % ของความกว้าง/สูงรูปผัง)
 *   Stock_Log        timestamp | itemId | itemName | action | delta | qtyAfter | by | note
 * ⚠ ต้องเป็นโปรเจกต์ Apps Script แยกจาก Code.gs ตัวอื่น (doGet/doPost ชนกันถ้าอยู่รวม)
 *
 * Setup:
 * 1. script.google.com > New project แล้ววางไฟล์นี้ทั้งไฟล์
 * 2. ใส่ ID ของ Spreadsheet Group Management ที่ STOCK_SPREADSHEET_ID ด้านล่าง
 * 3. Run setupSheets() 1 ครั้ง (สร้างแท็บ + กดอนุญาตสิทธิ์)
 * 4. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 * 5. คัดลอก URL /exec ไปใส่ API_URL ใน js/config.js
 * 6. แก้ไฟล์นี้ทีหลัง: Deploy > Manage deployments > Edit > New version (URL เดิม)
 *
 * แก้ข้อมูลในชีตตรงๆ ได้ แต่ห้ามเปลี่ยน/ลบคอลัมน์ id และห้ามเรียงหัวตารางใหม่ (เพิ่มคอลัมน์ใหม่ต่อท้ายได้)
 */

// Group Management spreadsheet ID. Blank = the spreadsheet this script is bound to.
const STOCK_SPREADSHEET_ID = "";

const LOG_LIMIT = 300; // rows of history sent to the page

const STOCK_TABS = {
  items: {
    name: "Stock_Items",
    // คอลัมน์ใหม่ต่อท้ายเสมอ (แท็บเดิมจะได้คอลัมน์ที่ขาดเพิ่มท้ายตารางให้อัตโนมัติ)
    header: ["id", "name", "category", "unit", "qty", "minQty", "locationId", "locationNote", "note", "imageUrl", "createdAt", "updatedAt", "updatedBy", "barcode", "code", "standbyQty"],
  },
  locations: { name: "Stock_Locations", header: ["id", "name", "zone", "x", "y", "note"] },
  log: { name: "Stock_Log", header: ["timestamp", "itemId", "itemName", "action", "delta", "qtyAfter", "by", "note"] },
};
const NUMBER_FIELDS = ["qty", "minQty", "x", "y", "delta", "qtyAfter", "standbyQty"];

let ssCache_ = null;
function ss_() {
  if (ssCache_) return ssCache_;
  const ss = STOCK_SPREADSHEET_ID ? SpreadsheetApp.openById(STOCK_SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("ยังไม่ได้ตั้ง STOCK_SPREADSHEET_ID (สคริปต์นี้ไม่ได้ผูกกับ Spreadsheet)");
  ssCache_ = ss;
  return ss;
}

/** The tab, created with its header when missing. A header that lost columns gets them back at the end. */
function tab_(key) {
  const def = STOCK_TABS[key];
  let sheet = ss_().getSheetByName(def.name);
  if (!sheet) {
    sheet = ss_().insertSheet(def.name);
    sheet.getRange(1, 1, 1, def.header.length).setValues([def.header]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, def.header.length).setValues([def.header]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    return sheet;
  }
  const have = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = def.header.filter((h) => have.indexOf(h) === -1);
  if (missing.length) sheet.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight("bold");
  return sheet;
}

function setupSheets() {
  Object.keys(STOCK_TABS).forEach(tab_);
}

/** [{...row by header}] with the sheet row number in _row. */
function readTab_(key) {
  const sheet = tab_(key);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const header = values.shift().map(String);
  return values
    .map((row, i) => {
      const o = { _row: i + 2 };
      header.forEach((h, j) => {
        if (!h) return;
        let v = row[j];
        if (v instanceof Date) v = v.toISOString();
        if (NUMBER_FIELDS.indexOf(h) !== -1) v = v === "" ? "" : Number(v) || 0;
        if (h === "barcode" || h === "code") v = String(v).trim();
        o[h] = v;
      });
      return o;
    })
    .filter((o) => (key === "log" ? o.timestamp !== "" : String(o.id || "").trim() !== ""));
}

/** Text a user typed must never become a formula in the Sheet. */
function text_(v, max) {
  let s = String(v == null ? "" : v).trim().slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
/** บาร์โค้ดเก็บเป็นข้อความเสมอ (กันเลข 0 นำหน้าหาย และเลขยาวถูกปัดเป็น 8.85E+12) */
function barcode_(v) {
  const s = String(v == null ? "" : v).replace(/\s+/g, "").slice(0, 100);
  return s ? "'" + s : "";
}

function num_(v, min) {
  const n = Number(v);
  if (!isFinite(n)) return min || 0;
  return Math.max(min == null ? -Infinity : min, Math.round(n * 100) / 100);
}

function writeRow_(key, rowNum, obj) {
  const sheet = tab_(key);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const existing = rowNum ? sheet.getRange(rowNum, 1, 1, header.length).getValues()[0] : [];
  const row = header.map((h, i) => (h in obj ? obj[h] : existing[i] !== undefined ? existing[i] : ""));
  if (rowNum) sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function log_(item, action, delta, by, note) {
  writeRow_("log", 0, {
    timestamp: new Date(),
    itemId: item.id,
    itemName: text_(item.name),
    action: action,
    delta: delta,
    qtyAfter: item.qty,
    by: text_(by, 100),
    note: text_(note),
  });
}

function strip_(o) {
  const out = Object.assign({}, o);
  delete out._row;
  return out;
}

function state_() {
  const log = readTab_("log");
  return {
    items: readTab_("items").map(strip_),
    locations: readTab_("locations").map(strip_),
    log: log.slice(-LOG_LIMIT).reverse().map(strip_),
    serverTime: new Date().toISOString(),
  };
}

const r2_ = (n) => Math.round(n * 100) / 100;
/** {stock, standby} ของรายการ (standby ไม่เกินยอดรวม) */
function piles_(it) {
  const qty = Number(it.qty) || 0;
  const standby = Math.min(qty, Math.max(0, Number(it.standbyQty) || 0));
  return { stock: r2_(qty - standby), standby: standby };
}
const pileNote_ = (p) => "Stock " + p.stock + " / Standby " + p.standby;

function requireBy_(by) {
  if (!String(by || "").trim()) throw new Error("กรุณาเลือกชื่อผู้ทำรายการ");
}

// ---------- actions ----------

function saveItem_(data, by) {
  requireBy_(by);
  const name = text_(data.name, 200);
  if (!name) throw new Error("กรุณาใส่ชื่อสิ่งของ");
  const items = readTab_("items");
  const now = new Date().toISOString();
  const fields = {
    name: name,
    category: text_(data.category, 100),
    unit: text_(data.unit, 30),
    minQty: num_(data.minQty, 0),
    locationId: text_(data.locationId, 60),
    locationNote: text_(data.locationNote, 200),
    note: text_(data.note, 1000),
    imageUrl: text_(data.imageUrl, 500),
    barcode: barcode_(data.barcode),
    code: barcode_(String(data.code == null ? "" : data.code).trim().toUpperCase()), // รหัสสิ่งของ เก็บเป็นข้อความเหมือนบาร์โค้ด
    updatedAt: now,
    updatedBy: text_(by, 100),
  };
  const code = fields.barcode.slice(1);
  const sameCode = code && items.find((i) => i.barcode === code && i.id !== data.id);
  if (sameCode) throw new Error("บาร์โค้ด " + code + " ใช้กับ \"" + sameCode.name + "\" อยู่แล้ว");
  const itemCode = fields.code.slice(1);
  const sameItemCode = itemCode && items.find((i) => String(i.code).toUpperCase() === itemCode && i.id !== data.id);
  if (sameItemCode) throw new Error("รหัส " + itemCode + " ใช้กับ \"" + sameItemCode.name + "\" อยู่แล้ว");
  // จำนวน: ส่ง stockQty + standbyQty (ฟอร์มใหม่) หรือ qty อย่างเดียว (ทั้งหมดอยู่ใน Stock)
  const standby = data.standbyQty == null || data.standbyQty === "" ? 0 : num_(data.standbyQty, 0);
  const qtyIn = data.stockQty == null || data.stockQty === "" ? num_(data.qty, 0) - standby : num_(data.stockQty, 0);
  const qty = r2_(Math.max(0, qtyIn) + standby);
  fields.standbyQty = standby;
  if (data.id) {
    const cur = items.find((i) => i.id === data.id);
    if (!cur) throw new Error("ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)");
    writeRow_("items", cur._row, Object.assign(fields, { qty: qty }));
    const delta = r2_(qty - (Number(cur.qty) || 0));
    const before = piles_(cur), after = piles_({ qty: qty, standbyQty: standby });
    const changed = before.stock !== after.stock || before.standby !== after.standby;
    log_({ id: cur.id, name: name, qty: qty }, "แก้ไข", delta, by, changed ? "แก้ไขจำนวน → " + pileNote_(after) : "แก้ไขข้อมูล");
  } else {
    const dup = items.find((i) => String(i.name).trim().toLowerCase() === name.toLowerCase() && String(i.locationId) === fields.locationId);
    if (dup) throw new Error("มี \"" + name + "\" ที่ตำแหน่งนี้อยู่แล้ว ใช้การแก้ไขแทน");
    const id = "IT-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    writeRow_("items", 0, Object.assign(fields, { id: id, qty: qty, createdAt: now }));
    log_({ id: id, name: name, qty: qty }, "เพิ่มใหม่", qty, by, standby ? pileNote_(piles_({ qty: qty, standbyQty: standby })) : "");
  }
}

function deleteItem_(id, by) {
  requireBy_(by);
  const cur = readTab_("items").find((i) => i.id === id);
  if (!cur) throw new Error("ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)");
  tab_("items").deleteRow(cur._row);
  log_(cur, "ลบ", -(Number(cur.qty) || 0), by, "");
}

/** +/- from the current Sheet value, so two people adjusting at once never overwrite each other. */
/** รับเข้า/เบิกออกจากกอง pile ("stock" | "standby"; ไม่ระบุ = stock, เบิกเกินกอง stock จะตัดจาก standby ต่อ) */
function adjust_(id, delta, by, note, pile) {
  requireBy_(by);
  delta = num_(delta);
  if (!delta) return;
  const cur = readTab_("items").find((i) => i.id === id);
  if (!cur) throw new Error("ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)");
  const p = piles_(cur);
  if (pile === "standby") p.standby = Math.max(0, r2_(p.standby + delta));
  else if (delta > 0 || p.stock + delta >= 0) p.stock = Math.max(0, r2_(p.stock + delta));
  else {
    p.standby = Math.max(0, r2_(p.standby + p.stock + delta));
    p.stock = 0;
  }
  const qty = r2_(p.stock + p.standby);
  writeRow_("items", cur._row, { qty: qty, standbyQty: p.standby, updatedAt: new Date().toISOString(), updatedBy: text_(by, 100) });
  const label = (pile === "standby" ? " (Standby)" : "");
  log_(Object.assign({}, cur, { qty: qty }), (delta > 0 ? "รับเข้า" : "เบิกออก"), r2_(qty - (Number(cur.qty) || 0)), by, [note, pileNote_(p) + label].filter(String).join(" · "));
}

/** ย้ายจำนวนระหว่างกอง: to = "standby" (Stock → Standby) | "stock" (Standby → Stock); ยอดรวมไม่เปลี่ยน */
function move_(id, amount, to, by, note) {
  requireBy_(by);
  amount = num_(amount, 0);
  if (!amount) throw new Error("กรุณาใส่จำนวนที่จะย้าย");
  const cur = readTab_("items").find((i) => i.id === id);
  if (!cur) throw new Error("ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)");
  const p = piles_(cur);
  const from = to === "standby" ? "stock" : "standby";
  if (amount > p[from]) throw new Error("ใน " + (from === "stock" ? "Stock" : "Standby") + " มีแค่ " + p[from]);
  p[from] = r2_(p[from] - amount);
  p[to === "standby" ? "standby" : "stock"] = r2_(p[to === "standby" ? "standby" : "stock"] + amount);
  writeRow_("items", cur._row, { standbyQty: p.standby, updatedAt: new Date().toISOString(), updatedBy: text_(by, 100) });
  log_(cur, to === "standby" ? "ย้ายไป Standby" : "ย้ายไป Stock", 0, by, [amount + " " + (cur.unit || ""), pileNote_(p), note].filter(String).join(" · "));
}

/** ย้ายตำแหน่งจัดเก็บของรายการ */
function relocate_(id, locationId, locationNote, by) {
  requireBy_(by);
  const items = readTab_("items");
  const cur = items.find((i) => i.id === id);
  if (!cur) throw new Error("ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)");
  locationId = text_(locationId, 60);
  const locs = readTab_("locations");
  const to = locs.find((l) => l.id === locationId);
  if (locationId && !to) throw new Error("ไม่พบตำแหน่งปลายทาง (อาจถูกลบไปแล้ว)");
  const from = locs.find((l) => l.id === cur.locationId);
  writeRow_("items", cur._row, { locationId: locationId, locationNote: text_(locationNote, 200), updatedAt: new Date().toISOString(), updatedBy: text_(by, 100) });
  log_(cur, "ย้ายตำแหน่ง", 0, by, (from ? from.name : "ไม่ระบุ") + " → " + (to ? to.name : "ไม่ระบุ") + (locationNote ? " (" + text_(locationNote, 200) + ")" : ""));
}

/** ตรวจนับ: counts = [{id, stock?, standby?}] (กองที่ไม่ส่งมา = ไม่ได้นับ คงค่าเดิม; {id, qty} แบบเก่า = นับรวมเป็น Stock) */
function count_(counts, by) {
  requireBy_(by);
  const items = readTab_("items");
  const now = new Date().toISOString();
  (counts || []).forEach((c) => {
    const cur = items.find((i) => i.id === c.id);
    if (!cur) return;
    const p = piles_(cur);
    const has = (v) => v !== undefined && v !== null && v !== "";
    if (has(c.standby)) p.standby = num_(c.standby, 0);
    if (has(c.stock)) p.stock = num_(c.stock, 0);
    else if (has(c.qty)) p.stock = Math.max(0, r2_(num_(c.qty, 0) - p.standby));
    const qty = r2_(p.stock + p.standby);
    const delta = r2_(qty - (Number(cur.qty) || 0));
    writeRow_("items", cur._row, { qty: qty, standbyQty: p.standby, updatedAt: now, updatedBy: text_(by, 100) });
    log_(Object.assign({}, cur, { qty: qty }), "ตรวจนับ", delta, by, (delta ? "ยอดนับต่างจากในระบบ" : "ตรงกับในระบบ") + " · " + pileNote_(p));
  });
}

function saveLocation_(data, by) {
  requireBy_(by);
  const name = text_(data.name, 100);
  if (!name) throw new Error("กรุณาใส่ชื่อตำแหน่งจัดเก็บ");
  const locs = readTab_("locations");
  const fields = {
    name: name,
    zone: text_(data.zone, 100),
    x: data.x === "" || data.x == null ? "" : Math.min(100, num_(data.x, 0)),
    y: data.y === "" || data.y == null ? "" : Math.min(100, num_(data.y, 0)),
    note: text_(data.note, 500),
  };
  if (data.id) {
    const cur = locs.find((l) => l.id === data.id);
    if (!cur) throw new Error("ไม่พบตำแหน่งนี้ (อาจถูกลบไปแล้ว)");
    writeRow_("locations", cur._row, fields);
  } else {
    if (locs.some((l) => String(l.name).trim().toLowerCase() === name.toLowerCase())) throw new Error("มีตำแหน่งชื่อนี้อยู่แล้ว");
    writeRow_("locations", 0, Object.assign(fields, { id: "LOC-" + Utilities.getUuid().slice(0, 6).toUpperCase() }));
  }
}

function deleteLocation_(id, by) {
  requireBy_(by);
  const cur = readTab_("locations").find((l) => l.id === id);
  if (!cur) throw new Error("ไม่พบตำแหน่งนี้ (อาจถูกลบไปแล้ว)");
  const used = readTab_("items").filter((i) => i.locationId === id).length;
  if (used) throw new Error("ยังมีของ " + used + " รายการอยู่ที่ตำแหน่งนี้ ย้ายของออกก่อนจึงจะลบได้");
  tab_("locations").deleteRow(cur._row);
}

// ---------- HTTP ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try {
    return json_({ data: state_() });
  } catch (err) {
    return json_({ error: err.message });
  }
}

/** Every write answers with the fresh state so the page is always in sync with the Sheet. */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: "invalid JSON body" });
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ error: "ระบบกำลังบันทึกของคนอื่นอยู่ ลองใหม่อีกครั้ง" });
  }
  try {
    const a = body.action;
    if (a === "saveItem") saveItem_(body.data || {}, body.by);
    else if (a === "deleteItem") deleteItem_(body.id, body.by);
    else if (a === "adjust") adjust_(body.id, body.delta, body.by, body.note, body.pile);
    else if (a === "move") move_(body.id, body.amount, body.to, body.by, body.note);
    else if (a === "relocate") relocate_(body.id, body.locationId, body.locationNote, body.by);
    else if (a === "count") count_(body.counts, body.by);
    else if (a === "saveLocation") saveLocation_(body.data || {}, body.by);
    else if (a === "deleteLocation") deleteLocation_(body.id, body.by);
    else throw new Error("unknown action: " + a);
    return json_({ data: state_() });
  } catch (err) {
    return json_({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}
