/**
 * ===================================================================
 * E-Mod — Google Apps Script Backend (รายงานประจำวัน MOD)
 * ---------------------------------------------------------------
 * ⚠ ต้องอยู่คนละโปรเจกต์ Apps Script กับ Code.gs หลักเสมอ (deploy เป็น Web App แยกต่างหาก)
 * เพราะไฟล์นี้มีฟังก์ชัน doGet/doPost ของตัวเอง — ถ้าวางรวมโปรเจกต์เดียวกับ Code.gs
 * ฟังก์ชัน doGet/doPost จะชนกัน (GAS อนุญาตให้มีชื่อซ้ำได้แค่ตัวเดียวต่อโปรเจกต์)
 * บันทึกลง Spreadsheet เดียวกับระบบ Group Management (จองห้อง) ในแท็บชื่อ "EMod"
 * ซึ่งสร้างพร้อมหัวตารางให้อัตโนมัติเหมือน Code.gs หลัก
 * รายชื่อผู้บันทึก/ผู้แก้ไขดึงจากชีตอ้างอิงเดียวกัน (แท็บ Staff_Name) ฝั่ง E-Mod-Script.js
 *
 * วิธีติดตั้ง:
 *  1. script.google.com > New project > วางโค้ดนี้ทั้งไฟล์
 *  2. ใส่ ID ของ Spreadsheet Group Management ที่ EMOD_SPREADSHEET_ID ด้านล่าง
 *     (ดูจาก URL: https://docs.google.com/spreadsheets/d/<ID>/edit)
 *  3. Deploy > New deployment > Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  4. คัดลอก URL ที่ได้ (ลงท้ายด้วย /exec) ไปใส่ใน CONFIG.API_URL ของ E-Mod-Script.js
 * ===================================================================
 */

// ID ของ Spreadsheet Group Management — เว้นว่าง = ใช้ Spreadsheet ที่ผูกกับสคริปต์นี้ (bound script)
const EMOD_SPREADSHEET_ID = '';
const EMOD_SHEET_NAME = 'EMod';
const EMOD_HEADERS = [
  'id', 'date', 'mod', 'mExhibition', 'mEducation', 'mVisitorService',
  'specialActivitiesJson', 'eveningJson', 'visitorCountsJson',
  'activityRoundsJson', 'otherActivitiesJson', 'revenueJson',
  'recorder', 'editor', 'createdAt', 'updatedAt'
  // คอลัมน์ใหม่ต่อท้ายสุดเสมอ — ห้ามแทรกกลาง เพราะจะทำให้คอลัมน์ของแถวเก่าในชีตเลื่อนตำแหน่งผิด
];
const EMOD_JSON_FIELDS = ['specialActivities', 'evening', 'visitorCounts', 'activityRounds', 'otherActivities', 'revenue'];

function emodGetSheet_() {
  const ss = EMOD_SPREADSHEET_ID
    ? SpreadsheetApp.openById(EMOD_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('ยังไม่ได้ตั้ง EMOD_SPREADSHEET_ID (สคริปต์นี้ไม่ได้ผูกกับ Spreadsheet)');
  let sheet = ss.getSheetByName(EMOD_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(EMOD_SHEET_NAME);
  const firstRow = sheet.getRange(1, 1, 1, EMOD_HEADERS.length).getValues()[0];
  const hasHeaders = EMOD_HEADERS.every((h, i) => firstRow[i] === h);
  if (!hasHeaders) {
    // แถว 1 ไม่ใช่หัวตารางเดิม (เช่นมีคนลบหัวตารางทิ้ง) — แทรกแถวใหม่แทนการเขียนทับข้อมูล
    if (firstRow[0] !== 'id' && sheet.getLastRow() > 0) sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, EMOD_HEADERS.length).setValues([EMOD_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function emodRespond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function emodNormalizeDate_(val) {
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return val;
}

function emodRowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    if (h === 'date') { obj[h] = emodNormalizeDate_(row[i]); return; }
    obj[h] = row[i];
  });
  return obj;
}

function emodDecorate_(obj) {
  const out = Object.assign({}, obj);
  EMOD_JSON_FIELDS.forEach(field => {
    const key = field + 'Json';
    let parsed;
    try { parsed = JSON.parse(out[key] || 'null'); } catch (e) { parsed = null; }
    out[field] = parsed;
    delete out[key];
  });
  return out;
}

function emodEncode_(data) {
  const record = {};
  EMOD_HEADERS.forEach(h => { record[h] = ''; });
  Object.assign(record, {
    mod: data.mod || '', mExhibition: data.mExhibition || '', mEducation: data.mEducation || '',
    mVisitorService: data.mVisitorService || '', date: data.date || '',
    recorder: data.recorder || '', editor: data.editor || ''
  });
  EMOD_JSON_FIELDS.forEach(field => { record[field + 'Json'] = JSON.stringify(data[field] || null); });
  return record;
}

function emodFindRowIndexById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // เลขแถวจริงในชีต (1-indexed)
  }
  return -1;
}

function emodFindRowIndexByDate_(sheet, date) {
  const values = sheet.getDataRange().getValues();
  const dateCol = EMOD_HEADERS.indexOf('date');
  for (let i = 1; i < values.length; i++) {
    if (String(emodNormalizeDate_(values[i][dateCol])) === String(date)) return i + 1;
  }
  return -1;
}

function emodGetAll_() {
  const sheet = emodGetSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row[0] !== '').map(row => emodDecorate_(emodRowToObject_(headers, row)));
}

function emodGetByDate_(date) {
  const sheet = emodGetSheet_();
  const rowIndex = emodFindRowIndexByDate_(sheet, date);
  if (rowIndex === -1) return { data: null };
  const row = sheet.getRange(rowIndex, 1, 1, EMOD_HEADERS.length).getValues()[0];
  return { data: emodDecorate_(emodRowToObject_(EMOD_HEADERS, row)) };
}

function emodValidDate_(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''));
}

function emodCreate_(data) {
  if (!String(data.recorder || '').trim()) return { error: 'กรุณาระบุผู้บันทึก' };
  if (!emodValidDate_(data.date)) return { error: 'วันที่ไม่ถูกต้อง' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = emodGetSheet_();
    const existingRow = emodFindRowIndexByDate_(sheet, data.date);
    if (existingRow !== -1) return { error: 'มีรายงานวันที่นี้อยู่แล้ว กรุณาใช้การแก้ไขแทน' };
    const now = new Date().toISOString();
    const id = Utilities.getUuid();
    const record = emodEncode_(Object.assign({}, data, { createdAt: now, updatedAt: now }));
    record.id = id; record.createdAt = now; record.updatedAt = now;
    const rowIndex = sheet.getLastRow() + 1;
    const dateCol = EMOD_HEADERS.indexOf('date') + 1;
    sheet.getRange(rowIndex, dateCol).setNumberFormat('@'); // กันชีตแปลงวันที่เป็น Date object อัตโนมัติ
    sheet.getRange(rowIndex, 1, 1, EMOD_HEADERS.length).setValues([EMOD_HEADERS.map(h => record[h])]);
    return { data: emodDecorate_(record) };
  } finally {
    lock.releaseLock();
  }
}

function emodUpdate_(data) {
  if (!String(data.editor || '').trim()) return { error: 'กรุณาระบุผู้แก้ไข' };
  if (!emodValidDate_(data.date)) return { error: 'วันที่ไม่ถูกต้อง' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = emodGetSheet_();
    const rowIndex = emodFindRowIndexById_(sheet, data.id);
    if (rowIndex === -1) return { error: 'ไม่พบรายงานที่ต้องการแก้ไข' };
    const dateRow = emodFindRowIndexByDate_(sheet, data.date);
    if (dateRow !== -1 && dateRow !== rowIndex) return { error: 'มีรายงานวันที่นี้อยู่แล้ว (1 วันมีได้ 1 รายงาน)' };
    const existingRow = sheet.getRange(rowIndex, 1, 1, EMOD_HEADERS.length).getValues()[0];
    const existing = emodRowToObject_(EMOD_HEADERS, existingRow);
    const now = new Date().toISOString();
    const record = emodEncode_(data);
    record.id = existing.id;
    record.recorder = existing.recorder || data.recorder || '';
    record.createdAt = existing.createdAt;
    record.updatedAt = now;
    const dateCol = EMOD_HEADERS.indexOf('date') + 1;
    sheet.getRange(rowIndex, dateCol).setNumberFormat('@');
    sheet.getRange(rowIndex, 1, 1, EMOD_HEADERS.length).setValues([EMOD_HEADERS.map(h => record[h])]);
    return { data: emodDecorate_(record) };
  } finally {
    lock.releaseLock();
  }
}

function emodDelete_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = emodGetSheet_();
    const rowIndex = emodFindRowIndexById_(sheet, id);
    if (rowIndex === -1) return { error: 'ไม่พบรายงาน' };
    sheet.deleteRow(rowIndex);
    return { data: { ok: true } };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- HTTP entry points ---------------- */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || 'list';
  try {
    if (action === 'list') return emodRespond_({ data: emodGetAll_() });
    if (action === 'getByDate') return emodRespond_(emodGetByDate_(params.date));
    return emodRespond_({ error: 'unknown action: ' + action });
  } catch (err) {
    return emodRespond_({ error: err.message });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return emodRespond_({ error: 'invalid JSON body' });
  }
  const action = body.action;
  try {
    if ((action === 'create' || action === 'update') && !body.data) return emodRespond_({ error: 'missing data' });
    if (action === 'create') return emodRespond_(emodCreate_(body.data));
    if (action === 'update') return emodRespond_(emodUpdate_(body.data));
    if (action === 'delete') return emodRespond_(emodDelete_(body.id));
    return emodRespond_({ error: 'unknown action: ' + action });
  } catch (err) {
    return emodRespond_({ error: err.message });
  }
}
