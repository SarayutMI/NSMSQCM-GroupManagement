/**
 * ===================================================================
 * E-Mod — Google Apps Script Backend (รายงานประจำวัน MOD)
 * ---------------------------------------------------------------
 * ⚠ ต้องอยู่คนละโปรเจกต์ Apps Script กับ Code.gs หลักเสมอ (deploy เป็น Web App แยกต่างหาก)
 * เพราะไฟล์นี้มีฟังก์ชัน doGet/doPost ของตัวเอง — ถ้าวางรวมโปรเจกต์เดียวกับ Code.gs
 * ฟังก์ชัน doGet/doPost จะชนกัน (GAS อนุญาตให้มีชื่อซ้ำได้แค่ตัวเดียวต่อโปรเจกต์)
 * บันทึกลง DBEMOD ในแท็บชื่อ "EMod" และอ่านยอดคนจาก DBExhibition
 * ซึ่งสร้างพร้อมหัวตารางให้อัตโนมัติเหมือน Code.gs หลัก
 * รายชื่อผู้บันทึก/ผู้แก้ไขดึงจากชีตอ้างอิงเดียวกัน (แท็บ Staff_Name) ฝั่ง E-Mod-Script.js
 *
 * วิธีติดตั้ง:
 *  1. script.google.com > New project > วางโค้ดนี้ทั้งไฟล์
 *  2. ตรวจ EMOD_SPREADSHEET_ID และ EXHIBITION_SPREADSHEET_ID ด้านล่าง
 *     (ดูจาก URL: https://docs.google.com/spreadsheets/d/<ID>/edit)
 *  3. Deploy > New deployment > Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  4. คัดลอก URL ที่ได้ (ลงท้ายด้วย /exec) ไปใส่ใน CONFIG.API_URL ของ E-Mod-Script.js
 * ===================================================================
 */

const EMOD_SPREADSHEET_ID = '1FJLd5tucqX1WGTWn9P0NipZwZDSJr73be20_FlIlxz8';
const EXHIBITION_SPREADSHEET_ID = '1tHFy0w7ucsWwTqGbAtIICwUgHCnHeCRKv7tZjN0x24c';
const EXHIBITION_SHEET_NAME = 'Exhibition_Data';
const EMOD_SHEET_NAME = 'EMod';
const EMOD_HEADERS = [
  'id', 'date', 'mod', 'mExhibition', 'mEducation', 'mVisitorService',
  'specialActivitiesJson', 'eveningJson', 'visitorCountsJson',
  'activityRoundsJson', 'otherActivitiesJson', 'revenueJson',
  'recorder', 'editor', 'createdAt', 'updatedAt',
  'signer', // ผู้ลงชื่อท้ายรายงาน (เพิ่มทีหลัง)
  // สรุปผู้เข้าชมแยกกลุ่ม (คำนวณจากข้อมูลในรายงานตอนบันทึก): ทั้งตารางเป็น JSON + ยอดรวมแยกคอลัมน์ไว้รวม/กรองในชีตได้ง่าย
  'summaryJson', 'sumChildTh', 'sumChildFor', 'sumAdultTh', 'sumAdultFor', 'sumSenior', 'sumTotal',
  'exhibitionSyncedAt'
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

const EMOD_CATS = ['childTh', 'childFor', 'adultTh', 'adultFor', 'senior'];

/** สรุปผู้เข้าชมแยกกลุ่มของรายงาน 1 วัน (ตรรกะเดียวกับ computeSummary ใน E-Mod-Script.js)
    rows: นิทรรศการ Walk-in, นิทรรศการ Group, Inspire Lab, Innovation Space, กิจกรรมอื่นทีละรายการ */
function emodSummary_(d) {
  const n = v => Number(v) || 0;
  const vc = d.visitorCounts || {}, ar = d.activityRounds || {};
  const row = (key, label, src) => {
    const r = { key: key, label: label };
    EMOD_CATS.forEach(c => { r[c] = n(src[c]); });
    r.total = EMOD_CATS.reduce((a, c) => a + r[c], 0);
    return r;
  };
  const sumRounds = list => (list || []).reduce((a, x) => {
    ['childTh', 'childFor', 'adultTh', 'adultFor'].forEach(c => { a[c] = (a[c] || 0) + n(x[c]); });
    return a;
  }, {});
  const rows = [
    row('exWalkin', 'นิทรรศการ Walk-in', vc.exWalkin || {}),
    row('exGroup', 'นิทรรศการ Group', vc.exGroup || {}),
    row('inspireLab', 'Inspire Lab', sumRounds(ar.inspireLab)),
    row('innovationSpace', 'Innovation Space', sumRounds(ar.innovationSpace))
  ];
  (d.otherActivities || []).forEach((a, i) => {
    const src = {};
    ['childTh', 'childFor', 'adultTh', 'adultFor'].forEach(c => { src[c] = n(a['w_' + c]) + n(a['g_' + c]); });
    const r = row('other' + i, String(a.name || '').trim() || ('กิจกรรมอื่น ' + (i + 1)), src);
    if (r.total || String(a.name || '').trim()) rows.push(r);
  });
  const all = {};
  EMOD_CATS.forEach(c => { all[c] = rows.reduce((s, r) => s + r[c], 0); });
  return { rows: rows, total: row('total', 'รวมทั้งหมด', all) };
}

function emodEncode_(data) {
  const record = {};
  EMOD_HEADERS.forEach(h => { record[h] = ''; });
  Object.assign(record, {
    mod: data.mod || '', mExhibition: data.mExhibition || '', mEducation: data.mEducation || '',
    mVisitorService: data.mVisitorService || '', date: data.date || '',
    recorder: data.recorder || '', editor: data.editor || '', signer: data.signer || '',
    exhibitionSyncedAt: data.exhibitionSyncedAt || ''
  });
  EMOD_JSON_FIELDS.forEach(field => { record[field + 'Json'] = JSON.stringify(data[field] || null); });
  const sum = emodSummary_(data);
  record.summaryJson = JSON.stringify(sum);
  record.sumChildTh = sum.total.childTh; record.sumChildFor = sum.total.childFor;
  record.sumAdultTh = sum.total.adultTh; record.sumAdultFor = sum.total.adultFor;
  record.sumSenior = sum.total.senior; record.sumTotal = sum.total.total;
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

/** Read the latest committed source row; never trust counts sent to the sync endpoint. */
function emodReadExhibition_(date) {
  const ss = SpreadsheetApp.openById(EXHIBITION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(EXHIBITION_SHEET_NAME);
  if (!sheet) throw new Error('ไม่พบแท็บ ' + EXHIBITION_SHEET_NAME + ' ใน DBExhibition');
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  const dateCol = headers.indexOf('visitDate');
  if (dateCol === -1) throw new Error('ไม่พบคอลัมน์ visitDate ใน DBExhibition');
  const normalize = value => {
    if (value instanceof Date) value = Utilities.formatDate(value, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    const str = String(value || '').trim();
    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const local = str.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (!iso && !local) return '';
    let year = Number(iso ? iso[1] : local[3]);
    if (year > 2400) year -= 543;
    return year + '-' + String(iso ? iso[2] : local[2]).padStart(2, '0') + '-' + String(iso ? iso[3] : local[1]).padStart(2, '0');
  };
  for (let i = values.length - 1; i >= 0; i--) {
    if (normalize(values[i][dateCol]) !== date) continue;
    const data = {};
    headers.forEach((key, col) => { if (key) data[key] = values[i][col]; });
    return data;
  }
  return null;
}

/** Merge source-owned sections, including explicit zero/empty values.
 * Absent columns (older schemas) leave that section alone. Income, staff,
 * signatures, evening briefing and special activities always belong to E-MOD.
 */
function emodMergeExhibition_(report, source) {
  const out = Object.assign({}, report);
  const num = value => Number(value) || 0;
  const txt = value => String(value == null ? '' : value).trim();
  const keys = Object.keys(source);
  const cats = { child_th: 'childTh', adult_th: 'adultTh', child_intl: 'childFor', adult_intl: 'adultFor' };
  const vc = Object.assign({ exWalkin: {}, exGroup: {}, groupCount: 0, groups: [] }, report.visitorCounts);
  if (keys.some(key => /^walkin_(child|adult)_(th|intl)_\d+$/.test(key))) {
    const walk = Object.assign({ senior: 0 }, vc.exWalkin);
    Object.keys(cats).forEach(cat => {
      walk[cats[cat]] = keys.filter(key => new RegExp('^walkin_' + cat + '_\\d+$').test(key))
        .reduce((sum, key) => sum + num(source[key]), 0);
    });
    vc.exWalkin = walk;
  }
  if (keys.some(key => /^group_(school|child|adult)_\d+$/.test(key))) {
    const indices = [...new Set(keys.map(key => (key.match(/^group_(?:school|child|adult)_(\d+)$/) || [])[1]).filter(Boolean))]
      .map(Number).sort((a, b) => a - b);
    const prior = (vc.groups || []).slice();
    vc.groups = indices.map(i => {
      const school = txt(source['group_school_' + i]);
      return { school: school, childTh: num(source['group_child_' + i]), adultTh: num(source['group_adult_' + i]),
        childFor: 0, adultFor: 0, senior: 0 };
    }).filter(g => g.school || g.childTh || g.adultTh).map(group => {
      const match = prior.findIndex(g => g && txt(g.school) === group.school);
      const old = match < 0 ? {} : prior.splice(match, 1)[0];
      group.senior = num(old.senior);
      return group;
    });
    vc.groupCount = vc.groups.length;
    vc.exGroup = Object.assign({ senior: 0 }, vc.exGroup);
    ['childTh', 'adultTh', 'childFor', 'adultFor'].forEach(cat => {
      vc.exGroup[cat] = vc.groups.reduce((sum, group) => sum + group[cat], 0);
    });
    if (vc.groups.length) vc.exGroup.senior = vc.groups.reduce((sum, group) => sum + group.senior, 0);
  }
  out.visitorCounts = vc;
  out.activityRounds = Object.assign({}, report.activityRounds);
  [['inspire', 'inspireLab'], ['innovation', 'innovationSpace']].forEach(([prefix, room]) => {
    const indices = keys.map(key => (key.match(new RegExp('^' + prefix + '_(?:activity|staff|school|child_th|adult_th|child_intl|adult_intl)_(\\d+)$')) || [])[1])
      .filter(Boolean).map(Number);
    if (!indices.length) return;
    const rows = Array.from({ length: Math.max(8, Math.max(...indices)) }, (_, i) => {
      const row = { activity: txt(source[prefix + '_activity_' + (i + 1)]), leader: txt(source[prefix + '_staff_' + (i + 1)]), school: txt(source[prefix + '_school_' + (i + 1)]) };
      Object.keys(cats).forEach(cat => { row[cats[cat]] = num(source[prefix + '_' + cat + '_' + (i + 1)]); });
      return row;
    });
    while (rows.length > 8 && !Object.values(rows[rows.length - 1]).some(Boolean)) rows.pop();
    out.activityRounds[room] = rows;
  });
  const activities = [['walkrally', 'Walk Rally'], ['dontmiss', "Don't Miss"], ['iscream', 'I-Scream'], ['miniplay', 'Mini Make & Play'], ['other1', ''], ['other2', '']];
  if (keys.some(key => /^activity_[a-z0-9]+_[wg]_/.test(key))) {
    out.otherActivities = activities.map(([key, name]) => {
      const row = { name: name || txt(source['activity_' + key + '_name']), school: txt(source['activity_' + key + '_school']) };
      ['w', 'g'].forEach(side => Object.keys(cats).forEach(cat => {
        row[side + '_' + cats[cat]] = num(source['activity_' + key + '_' + side + '_' + cat]);
      }));
      return row;
    });
  }
  return out;
}

/** Date-only POST invoked by Exhibition after its own database save. */
function emodSyncExhibition_(date) {
  if (!emodValidDate_(date)) return { error: 'วันที่ไม่ถูกต้อง' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const source = emodReadExhibition_(date);
    if (!source) return { error: 'ไม่พบข้อมูลวันที่นี้ใน DBExhibition' };
    const sheet = emodGetSheet_();
    const rowIndex = emodFindRowIndexByDate_(sheet, date);
    const existing = rowIndex === -1 ? null : emodDecorate_(emodRowToObject_(EMOD_HEADERS,
      sheet.getRange(rowIndex, 1, 1, EMOD_HEADERS.length).getValues()[0]));
    const blankRound = () => ({ childTh: 0, adultTh: 0, childFor: 0, adultFor: 0, activity: '', leader: '', school: '' });
    const base = existing || { date: date, recorder: 'Exhibition (อัตโนมัติ)',
      visitorCounts: { exWalkin: { senior: 0 }, exGroup: { senior: 0 }, groups: [], groupCount: 0 },
      activityRounds: { inspireLab: Array.from({ length: 8 }, blankRound), innovationSpace: Array.from({ length: 8 }, blankRound) },
      otherActivities: [], evening: {}, revenue: {}, specialActivities: [] };
    const report = emodMergeExhibition_(base, source);
    const now = new Date().toISOString();
    const record = emodEncode_(report);
    record.id = existing ? existing.id : Utilities.getUuid();
    record.createdAt = existing ? existing.createdAt : now;
    record.updatedAt = now;
    record.exhibitionSyncedAt = now;
    const target = rowIndex === -1 ? sheet.getLastRow() + 1 : rowIndex;
    sheet.getRange(target, EMOD_HEADERS.indexOf('date') + 1).setNumberFormat('@');
    sheet.getRange(target, 1, 1, EMOD_HEADERS.length).setValues([EMOD_HEADERS.map(h => record[h])]);
    SpreadsheetApp.flush();
    return { ok: true, date: date, id: record.id };
  } finally {
    lock.releaseLock();
  }
}

function emodCreate_(data) { return emodSave_(data, true); }
function emodUpdate_(data) { return emodSave_(data, false); }

// Both a sync and a manual income save use this project's ScriptLock.
function emodSave_(data, creating) {
  if (!emodValidDate_(data.date)) return { error: 'วันที่ไม่ถูกต้อง' };
  if (!String(data.recorder || '').trim()) return { error: 'กรุณาระบุผู้บันทึก' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = emodGetSheet_();
    const dateRow = emodFindRowIndexByDate_(sheet, data.date);
    const rowIndex = creating ? dateRow : emodFindRowIndexById_(sheet, data.id);
    if (!creating && rowIndex === -1) return { error: 'ไม่พบรายงานที่ต้องการแก้ไข' };
    if (dateRow !== -1 && dateRow !== rowIndex) return { error: 'มีรายงานวันที่นี้อยู่แล้ว (1 วันมีได้ 1 รายงาน)' };
    const existing = rowIndex === -1 ? null : emodDecorate_(emodRowToObject_(EMOD_HEADERS,
      sheet.getRange(rowIndex, 1, 1, EMOD_HEADERS.length).getValues()[0]));
    const autoCreated = existing && /^Exhibition/.test(String(existing.recorder || ''));
    // Exhibition may create the row while someone is filling in a new E-MOD report.
    if (creating && existing && !autoCreated) return { error: 'มีรายงานวันที่นี้อยู่แล้ว กรุณาโหลดรายงานก่อนแก้ไข' };
    if (existing && !autoCreated && !String(data.editor || '').trim()) return { error: 'กรุณาระบุผู้แก้ไข' };

    // Never let a stale browser snapshot replace newer Exhibition counts.
    const merged = Object.assign({}, data);
    const source = emodReadExhibition_(data.date);
    const report = source ? emodMergeExhibition_(merged, source) : merged;
    const now = new Date().toISOString();
    const record = emodEncode_(report);
    record.id = existing ? existing.id : Utilities.getUuid();
    record.recorder = existing && !autoCreated ? existing.recorder : data.recorder;
    record.createdAt = existing ? existing.createdAt : now;
    record.updatedAt = now;
    record.exhibitionSyncedAt = source ? now : (existing && existing.exhibitionSyncedAt || '');
    const target = rowIndex === -1 ? sheet.getLastRow() + 1 : rowIndex;
    sheet.getRange(target, EMOD_HEADERS.indexOf('date') + 1).setNumberFormat('@');
    sheet.getRange(target, 1, 1, EMOD_HEADERS.length).setValues([EMOD_HEADERS.map(h => record[h])]);
    SpreadsheetApp.flush();
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
    if (action === 'lineSetupHealth') return emodRespond_({ lineSetupReceiver: typeof emodLineCaptureGroup_ === 'function' });
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
    if (Array.isArray(body.events)) {
      const setup = emodLineCaptureGroup_(e, body);
      if (setup.error) console.warn(setup.error);
      // ContentService redirects JSON to googleusercontent; use an HTML ack for
      // this one-time webhook so LINE need not follow the JSON redirect.
      return HtmlService.createHtmlOutput(setup.ok ? 'OK' : 'Setup inactive');
    }
    if (action === 'linePreview' || action === 'lineSend') return emodRespond_(emodLineAction_(body));
    if ((action === 'create' || action === 'update') && !body.data) return emodRespond_({ error: 'missing data' });
    if (action === 'create') return emodRespond_(emodCreate_(body.data));
    if (action === 'update') return emodRespond_(emodUpdate_(body.data));
    if (action === 'syncExhibition') return emodRespond_(emodSyncExhibition_(body.date));
    if (action === 'delete') return emodRespond_(emodDelete_(body.id));
    return emodRespond_({ error: 'unknown action: ' + action });
  } catch (err) {
    return emodRespond_({ error: err.message });
  }
}
