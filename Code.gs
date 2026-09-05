/**
 * ===================================================================
 * School Group Management — Google Apps Script Backend
 * ---------------------------------------------------------------
 * ระบบนี้จะ "สร้างชีตและหัวตารางที่ต้องใช้ให้อัตโนมัติ" ในสเปรดชีตที่แนบ
 * สคริปต์นี้ไว้ (ไม่ต้องสร้างชีตหรือพิมพ์หัวตารางเอง) — ดูฟังก์ชัน getSheet_()
 *
 * วิธีติดตั้ง (สรุปสั้นๆ ดูละเอียดใน README.md):
 *  1. สร้าง Google Sheet ใหม่ 1 ไฟล์ (จะว่างเปล่าก็ได้ ไม่ต้องตั้งหัวตารางเอง)
 *  2. เมนู Extensions > Apps Script
 *  3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้แทน กด Save
 *  4. Deploy > New deployment > Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  5. คัดลอก URL ที่ได้ (ลงท้ายด้วย /exec) ไปใส่ใน CONFIG.API_URL ของ script.js
 *  6. เปิดเว็บแอปอีกครั้ง — พอมีการจองแรกเข้ามา ระบบจะสร้างชีตชื่อ "Bookings"
 *     พร้อมหัวตารางให้อัตโนมัติทันที ไม่ต้องทำอะไรเพิ่ม
 * ===================================================================
 */

const SHEET_NAME = 'Bookings';
const HEADERS = [
  'id','docNo','school','gradeLevel','packageLabel','contactPerson','contactPhone',
  'date','childrenCount','adultCount','totalPeople','status','notes',
  'activitiesJson','createdAt','updatedAt'
];

/**
 * ดึงชีตข้อมูล — ถ้ายังไม่มีชีตชื่อ "Bookings" หรือยังไม่มีหัวตาราง
 * ฟังก์ชันนี้จะสร้างให้อัตโนมัติ (auto-create) ทุกครั้งที่ถูกเรียกใช้
 */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((h, i) => firstRow[i] === h);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeValue_(key, val) {
  // Google Sheets มักแปลงข้อความวันที่ (เช่น "2026-09-05") ให้กลายเป็น Date object
  // อัตโนมัติ ซึ่งพอส่งกลับเป็น JSON จะกลายเป็นเวลา UTC ที่อาจเพี้ยนวันไปตาม time zone
  // ฟังก์ชันนี้แปลงกลับเป็นข้อความ yyyy-MM-dd ที่แน่นอนเสมอ กันปัญหาการจองไม่ขึ้นในปฏิทิน
  if (val instanceof Date) {
    if (key === 'date') {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    return val.toISOString();
  }
  return val;
}
function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = normalizeValue_(h, row[i]); });
  return obj;
}

function decorate_(obj) {
  // แปลง activitiesJson (เก็บเป็นข้อความในชีต) กลับเป็น array ให้หน้าเว็บใช้งานตรงๆ
  let activities = [];
  try { activities = JSON.parse(obj.activitiesJson || '[]'); } catch (e) { activities = []; }
  const out = Object.assign({}, obj);
  out.activities = activities;
  delete out.activitiesJson;
  return out;
}

function getAllBookings_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row[0] !== '')
    .map(row => decorate_(rowToObject_(headers, row)));
}

function findRowIndexById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // เลขแถวจริงในชีต (1-indexed)
  }
  return -1;
}

function generateDocNo_(date) {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const dateCol = HEADERS.indexOf('date');
  const dateStr = String(date).replace(/-/g, '');
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const rowDate = normalizeValue_('date', values[i][dateCol]);
    if (String(rowDate).replace(/-/g, '') === dateStr) count++;
  }
  return 'BK-' + dateStr + '-' + String(count + 1).padStart(3, '0');
}

function buildRecord_(data, overrides) {
  const activities = data.activities || [];
  const total = (Number(data.childrenCount) || 0) + (Number(data.adultCount) || 0);
  return Object.assign({
    school: data.school || '',
    gradeLevel: data.gradeLevel || '',
    packageLabel: data.packageLabel || '',
    contactPerson: data.contactPerson || '',
    contactPhone: data.contactPhone || '',
    date: data.date || '',
    childrenCount: Number(data.childrenCount) || 0,
    adultCount: Number(data.adultCount) || 0,
    totalPeople: total,
    status: data.status || 'pending',
    notes: data.notes || '',
    activitiesJson: JSON.stringify(activities)
  }, overrides);
}

function createBooking_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const now = new Date().toISOString();
    const id = Utilities.getUuid();
    const docNo = generateDocNo_(data.date);
    const record = buildRecord_(data, { id, docNo, createdAt: now, updatedAt: now });
    const rowIndex = sheet.getLastRow() + 1;
    const dateCol = HEADERS.indexOf('date') + 1;
    sheet.getRange(rowIndex, dateCol).setNumberFormat('@'); // บังคับเซลล์วันที่เป็นข้อความ ป้องกัน Sheet แปลงเป็น Date อัตโนมัติ
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([HEADERS.map(h => record[h])]);
    return { data: decorate_(record) };
  } finally {
    lock.releaseLock();
  }
}

function updateBooking_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const rowIndex = findRowIndexById_(sheet, data.id);
    if (rowIndex === -1) return { error: 'ไม่พบรายการที่ต้องการแก้ไข' };
    const now = new Date().toISOString();
    const existingRow = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
    const existing = rowToObject_(HEADERS, existingRow);
    const record = buildRecord_(data, { id: existing.id, docNo: existing.docNo, createdAt: existing.createdAt, updatedAt: now });
    const dateCol = HEADERS.indexOf('date') + 1;
    sheet.getRange(rowIndex, dateCol).setNumberFormat('@'); // กันชีตแปลงวันที่เป็น Date object ตอนแก้ไขด้วย
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([HEADERS.map(h => record[h])]);
    return { data: decorate_(record) };
  } finally {
    lock.releaseLock();
  }
}

function updateStatus_(id, status) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const rowIndex = findRowIndexById_(sheet, id);
    if (rowIndex === -1) return { error: 'ไม่พบรายการ' };
    sheet.getRange(rowIndex, HEADERS.indexOf('status') + 1).setValue(status);
    sheet.getRange(rowIndex, HEADERS.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
    const row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
    return { data: decorate_(rowToObject_(HEADERS, row)) };
  } finally {
    lock.releaseLock();
  }
}

function deleteBooking_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const rowIndex = findRowIndexById_(sheet, id);
    if (rowIndex === -1) return { error: 'ไม่พบรายการ' };
    sheet.deleteRow(rowIndex);
    return { data: { ok: true } };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- HTTP entry points ---------------- */

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'list';
  if (action === 'list') {
    return respond_({ data: getAllBookings_() });
  }
  return respond_({ error: 'unknown action: ' + action });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond_({ error: 'invalid JSON body' });
  }
  const action = body.action;
  try {
    if (action === 'create') return respond_(createBooking_(body.data));
    if (action === 'update') return respond_(updateBooking_(body.data));
    if (action === 'updateStatus') return respond_(updateStatus_(body.id, body.status));
    if (action === 'delete') return respond_(deleteBooking_(body.id));
    return respond_({ error: 'unknown action: ' + action });
  } catch (err) {
    return respond_({ error: err.message });
  }
}
